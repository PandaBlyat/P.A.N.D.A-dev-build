ALTER TABLE public.community_conversations
  ADD COLUMN IF NOT EXISTS co_authors TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS co_author_usernames TEXT[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_community_conv_co_authors
  ON public.community_conversations USING GIN (co_authors);

CREATE TABLE IF NOT EXISTS public.collab_sessions (
  id UUID PRIMARY KEY,
  host_publisher_id TEXT NOT NULL,
  conversation_id INTEGER NOT NULL,
  conversation_label TEXT NOT NULL,
  participants TEXT[] NOT NULL DEFAULT '{}'::text[],
  participant_usernames TEXT[] NOT NULL DEFAULT '{}'::text[],
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'published')),
  snapshot JSONB,
  snapshot_version INTEGER NOT NULL DEFAULT 0,
  guest_edit_count INTEGER NOT NULL DEFAULT 0,
  last_guest_edit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  max_users SMALLINT NOT NULL DEFAULT 2
);

CREATE INDEX IF NOT EXISTS collab_sessions_host_idx ON public.collab_sessions (host_publisher_id, status);
CREATE INDEX IF NOT EXISTS collab_sessions_updated_idx ON public.collab_sessions (updated_at DESC);
CREATE INDEX IF NOT EXISTS collab_sessions_participants_idx ON public.collab_sessions USING GIN (participants);

ALTER TABLE public.collab_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS collab_sessions_select ON public.collab_sessions;
CREATE POLICY collab_sessions_select
  ON public.collab_sessions FOR SELECT
  USING (
    auth.jwt() ->> 'publisher_id' = host_publisher_id
    OR (auth.jwt() ->> 'publisher_id') = ANY(participants)
  );

CREATE OR REPLACE FUNCTION public.create_collab_session(
  p_host TEXT,
  p_conversation_id INTEGER,
  p_label TEXT,
  p_snapshot JSONB,
  p_username TEXT DEFAULT NULL
)
RETURNS SETOF public.collab_sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO public.collab_sessions (
    id, host_publisher_id, conversation_id, conversation_label,
    participants, participant_usernames, snapshot, snapshot_version
  )
  VALUES (
    new_id, p_host, p_conversation_id, p_label,
    ARRAY[p_host], ARRAY[coalesce(nullif(p_username, ''), p_host)], p_snapshot, 0
  );
  RETURN QUERY SELECT * FROM public.collab_sessions WHERE id = new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_collab_session(
  p_id UUID,
  p_guest TEXT,
  p_username TEXT DEFAULT NULL
)
RETURNS SETOF public.collab_sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  session_row public.collab_sessions%ROWTYPE;
  existing_index INTEGER;
BEGIN
  SELECT * INTO session_row
  FROM public.collab_sessions
  WHERE id = p_id AND status = 'open'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Open collab session not found';
  END IF;

  existing_index := array_position(session_row.participants, p_guest);
  IF existing_index IS NULL THEN
    IF coalesce(array_length(session_row.participants, 1), 0) >= session_row.max_users THEN
      RAISE EXCEPTION 'Collab session is full';
    END IF;
    session_row.participants := array_append(session_row.participants, p_guest);
    session_row.participant_usernames := array_append(session_row.participant_usernames, coalesce(nullif(p_username, ''), p_guest));
  ELSE
    session_row.participant_usernames[existing_index] := coalesce(nullif(p_username, ''), p_guest);
  END IF;

  UPDATE public.collab_sessions
  SET participants = session_row.participants,
      participant_usernames = session_row.participant_usernames,
      updated_at = now()
  WHERE id = p_id;

  RETURN QUERY SELECT * FROM public.collab_sessions WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_collab_session(
  p_id UUID,
  p_caller TEXT,
  p_snapshot JSONB,
  p_snapshot_version INTEGER DEFAULT 0,
  p_guest_edit_count INTEGER DEFAULT 0
)
RETURNS SETOF public.collab_sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.collab_sessions
  SET status = 'closed',
      snapshot = p_snapshot,
      snapshot_version = greatest(snapshot_version, coalesce(p_snapshot_version, 0)),
      guest_edit_count = greatest(guest_edit_count, coalesce(p_guest_edit_count, 0)),
      last_guest_edit_at = CASE WHEN coalesce(p_guest_edit_count, 0) > 0 THEN now() ELSE last_guest_edit_at END,
      closed_at = now(),
      updated_at = now()
  WHERE id = p_id
    AND host_publisher_id = p_caller;

  RETURN QUERY SELECT * FROM public.collab_sessions WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_collab_session_host(
  p_id UUID,
  p_new_host TEXT
)
RETURNS SETOF public.collab_sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.collab_sessions
  SET host_publisher_id = p_new_host,
      updated_at = now()
  WHERE id = p_id
    AND status = 'open'
    AND p_new_host = ANY(participants);

  RETURN QUERY SELECT * FROM public.collab_sessions WHERE id = p_id;
END;
$$;

CREATE TABLE IF NOT EXISTS public.xp_award_buckets (
  publisher_id TEXT NOT NULL,
  bucket TEXT NOT NULL,
  day_utc TEXT NOT NULL,
  earned INT NOT NULL DEFAULT 0,
  PRIMARY KEY (publisher_id, bucket, day_utc)
);

ALTER TABLE public.xp_award_buckets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS xp_award_buckets_public ON public.xp_award_buckets;
CREATE POLICY xp_award_buckets_public
  ON public.xp_award_buckets FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.award_xp_capped_bucket(
  p_publisher_id TEXT,
  p_amount INT,
  p_bucket TEXT,
  p_daily_cap INT DEFAULT 300
)
RETURNS TABLE(publisher_id TEXT, username TEXT, xp INT, level INT, title TEXT, awarded INT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today_str TEXT := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  current_daily INT;
  actual_amount INT;
  new_xp INT;
  computed RECORD;
BEGIN
  INSERT INTO public.xp_award_buckets (publisher_id, bucket, day_utc, earned)
  VALUES (p_publisher_id, p_bucket, today_str, 0)
  ON CONFLICT (publisher_id, bucket, day_utc) DO NOTHING;

  SELECT earned INTO current_daily
  FROM public.xp_award_buckets
  WHERE xp_award_buckets.publisher_id = p_publisher_id
    AND xp_award_buckets.bucket = p_bucket
    AND xp_award_buckets.day_utc = today_str
  FOR UPDATE;

  actual_amount := LEAST(GREATEST(p_amount, 0), GREATEST(0, p_daily_cap - coalesce(current_daily, 0)));

  IF actual_amount > 0 THEN
    UPDATE public.user_profiles
    SET xp = user_profiles.xp + actual_amount
    WHERE user_profiles.publisher_id = p_publisher_id
    RETURNING user_profiles.xp INTO new_xp;

    computed := (SELECT t FROM public.compute_level_and_title(new_xp) AS t);

    UPDATE public.user_profiles
    SET level = computed.new_level, title = computed.new_title
    WHERE user_profiles.publisher_id = p_publisher_id;

    UPDATE public.xp_award_buckets
    SET earned = earned + actual_amount
    WHERE xp_award_buckets.publisher_id = p_publisher_id
      AND xp_award_buckets.bucket = p_bucket
      AND xp_award_buckets.day_utc = today_str;
  END IF;

  RETURN QUERY
  SELECT up.publisher_id, up.username, up.xp, up.level, up.title, actual_amount, up.created_at, up.updated_at
  FROM public.user_profiles up
  WHERE up.publisher_id = p_publisher_id;
END;
$$;
