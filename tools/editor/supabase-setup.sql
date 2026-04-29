-- P.A.N.D.A. Community Library — Supabase Database Setup
-- Run this in your Supabase project's SQL editor (https://supabase.com/dashboard)
-- Safe to rerun on projects that already have an older/partial community_conversations table.
-- This migration will add any missing columns/indexes/policies needed by the current app.

CREATE TABLE IF NOT EXISTS community_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  faction TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT 'Anonymous',
  publisher_id TEXT,
  co_authors TEXT[] NOT NULL DEFAULT '{}'::text[],
  co_author_usernames TEXT[] NOT NULL DEFAULT '{}'::text[],
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  library_section TEXT NOT NULL DEFAULT 'community' CHECK (library_section IN ('community', 'curated', 'demo')),
  branch_count INT,
  complexity TEXT,
  data JSONB NOT NULL,
  downloads INT NOT NULL DEFAULT 0,
  upvotes INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE community_conversations
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS publisher_id TEXT,
  ADD COLUMN IF NOT EXISTS co_authors TEXT[],
  ADD COLUMN IF NOT EXISTS co_author_usernames TEXT[],
  ADD COLUMN IF NOT EXISTS tags JSONB,
  ADD COLUMN IF NOT EXISTS library_section TEXT,
  ADD COLUMN IF NOT EXISTS branch_count INT,
  ADD COLUMN IF NOT EXISTS complexity TEXT,
  ADD COLUMN IF NOT EXISTS upvotes INT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE community_conversations
  ALTER COLUMN label SET DEFAULT '',
  ALTER COLUMN description SET DEFAULT '',
  ALTER COLUMN summary SET DEFAULT '',
  ALTER COLUMN author SET DEFAULT 'Anonymous',
  ALTER COLUMN co_authors SET DEFAULT '{}'::text[],
  ALTER COLUMN co_author_usernames SET DEFAULT '{}'::text[],
  ALTER COLUMN tags SET DEFAULT '[]'::jsonb,
  ALTER COLUMN library_section SET DEFAULT 'community',
  ALTER COLUMN downloads SET DEFAULT 0,
  ALTER COLUMN upvotes SET DEFAULT 0,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

UPDATE community_conversations
SET
  label = coalesce(label, ''),
  description = coalesce(description, ''),
  summary = coalesce(summary, ''),
  author = coalesce(author, 'Anonymous'),
  publisher_id = coalesce(
    nullif(btrim(publisher_id), ''),
    'legacy:' || md5(lower(trim(coalesce(nullif(author, ''), 'Anonymous'))))
  ),
  co_authors = coalesce(co_authors, '{}'::text[]),
  co_author_usernames = coalesce(co_author_usernames, '{}'::text[]),
  tags = coalesce(tags, '[]'::jsonb),
  library_section = CASE WHEN library_section IN ('community', 'curated', 'demo') THEN library_section ELSE 'community' END,
  downloads = coalesce(downloads, 0),
  upvotes = coalesce(upvotes, 0),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, created_at, now());

ALTER TABLE community_conversations
  ALTER COLUMN label SET NOT NULL,
  ALTER COLUMN description SET NOT NULL,
  ALTER COLUMN summary SET NOT NULL,
  ALTER COLUMN author SET NOT NULL,
  ALTER COLUMN co_authors SET NOT NULL,
  ALTER COLUMN co_author_usernames SET NOT NULL,
  ALTER COLUMN tags SET NOT NULL,
  ALTER COLUMN library_section SET NOT NULL,
  ALTER COLUMN data SET NOT NULL,
  ALTER COLUMN downloads SET NOT NULL,
  ALTER COLUMN upvotes SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_community_conv_faction ON community_conversations (faction);
CREATE INDEX IF NOT EXISTS idx_community_conv_created ON community_conversations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_conv_updated ON community_conversations (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_conv_publisher_id ON community_conversations (publisher_id);
CREATE INDEX IF NOT EXISTS idx_community_conv_co_authors ON community_conversations USING GIN (co_authors);
CREATE INDEX IF NOT EXISTS idx_community_conv_library_section ON community_conversations (library_section);
CREATE UNIQUE INDEX IF NOT EXISTS idx_community_conv_label_unique ON community_conversations (lower(label));

CREATE TABLE IF NOT EXISTS editor_admins (
  publisher_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  granted_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE editor_admins
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS granted_by TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE editor_admins
  ALTER COLUMN created_at SET DEFAULT now();

UPDATE editor_admins SET
  username = coalesce(username, publisher_id),
  created_at = coalesce(created_at, now());

ALTER TABLE editor_admins
  ALTER COLUMN username SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE editor_admins ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'editor_admins' AND policyname = 'Public admin read'
  ) THEN
    CREATE POLICY "Public admin read"
      ON editor_admins FOR SELECT USING (true);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Pair-collab sessions and co-author XP buckets
CREATE TABLE IF NOT EXISTS collab_sessions (
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

ALTER TABLE collab_sessions
  ADD COLUMN IF NOT EXISTS participants TEXT[],
  ADD COLUMN IF NOT EXISTS participant_usernames TEXT[],
  ADD COLUMN IF NOT EXISTS snapshot JSONB,
  ADD COLUMN IF NOT EXISTS snapshot_version INTEGER,
  ADD COLUMN IF NOT EXISTS guest_edit_count INTEGER,
  ADD COLUMN IF NOT EXISTS last_guest_edit_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS max_users SMALLINT;

ALTER TABLE collab_sessions
  ALTER COLUMN participants SET DEFAULT '{}'::text[],
  ALTER COLUMN participant_usernames SET DEFAULT '{}'::text[],
  ALTER COLUMN snapshot_version SET DEFAULT 0,
  ALTER COLUMN guest_edit_count SET DEFAULT 0,
  ALTER COLUMN max_users SET DEFAULT 2;

UPDATE collab_sessions
SET
  participants = coalesce(participants, '{}'::text[]),
  participant_usernames = coalesce(participant_usernames, '{}'::text[]),
  snapshot_version = coalesce(snapshot_version, 0),
  guest_edit_count = coalesce(guest_edit_count, 0),
  max_users = coalesce(max_users, 2);

ALTER TABLE collab_sessions
  ALTER COLUMN participants SET NOT NULL,
  ALTER COLUMN participant_usernames SET NOT NULL,
  ALTER COLUMN snapshot_version SET NOT NULL,
  ALTER COLUMN guest_edit_count SET NOT NULL,
  ALTER COLUMN max_users SET NOT NULL;

CREATE INDEX IF NOT EXISTS collab_sessions_host_idx ON collab_sessions (host_publisher_id, status);
CREATE INDEX IF NOT EXISTS collab_sessions_updated_idx ON collab_sessions (updated_at DESC);
CREATE INDEX IF NOT EXISTS collab_sessions_participants_idx ON collab_sessions USING GIN (participants);

ALTER TABLE collab_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS collab_sessions_select ON collab_sessions;
CREATE POLICY collab_sessions_select
  ON collab_sessions FOR SELECT
  USING (
    auth.jwt() ->> 'publisher_id' = host_publisher_id
    OR (auth.jwt() ->> 'publisher_id') = ANY(participants)
  );

CREATE OR REPLACE FUNCTION create_collab_session(
  p_host TEXT,
  p_conversation_id INTEGER,
  p_label TEXT,
  p_snapshot JSONB,
  p_username TEXT DEFAULT NULL
)
RETURNS SETOF collab_sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO collab_sessions (
    id,
    host_publisher_id,
    conversation_id,
    conversation_label,
    participants,
    participant_usernames,
    snapshot,
    snapshot_version
  )
  VALUES (
    new_id,
    p_host,
    p_conversation_id,
    p_label,
    ARRAY[p_host],
    ARRAY[coalesce(nullif(p_username, ''), p_host)],
    p_snapshot,
    0
  );

  RETURN QUERY SELECT * FROM collab_sessions WHERE id = new_id;
END;
$$;

CREATE OR REPLACE FUNCTION join_collab_session(
  p_id UUID,
  p_guest TEXT,
  p_username TEXT DEFAULT NULL
)
RETURNS SETOF collab_sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  session_row collab_sessions%ROWTYPE;
  existing_index INTEGER;
BEGIN
  SELECT * INTO session_row
  FROM collab_sessions
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

  UPDATE collab_sessions
  SET
    participants = session_row.participants,
    participant_usernames = session_row.participant_usernames,
    updated_at = now()
  WHERE id = p_id;

  RETURN QUERY SELECT * FROM collab_sessions WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION close_collab_session(
  p_id UUID,
  p_caller TEXT,
  p_snapshot JSONB,
  p_snapshot_version INTEGER DEFAULT 0,
  p_guest_edit_count INTEGER DEFAULT 0
)
RETURNS SETOF collab_sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE collab_sessions
  SET
    status = 'closed',
    snapshot = p_snapshot,
    snapshot_version = greatest(snapshot_version, coalesce(p_snapshot_version, 0)),
    guest_edit_count = greatest(guest_edit_count, coalesce(p_guest_edit_count, 0)),
    last_guest_edit_at = CASE WHEN coalesce(p_guest_edit_count, 0) > 0 THEN now() ELSE last_guest_edit_at END,
    closed_at = now(),
    updated_at = now()
  WHERE id = p_id
    AND host_publisher_id = p_caller;

  RETURN QUERY SELECT * FROM collab_sessions WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION promote_collab_session_host(
  p_id UUID,
  p_new_host TEXT
)
RETURNS SETOF collab_sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE collab_sessions
  SET host_publisher_id = p_new_host,
      updated_at = now()
  WHERE id = p_id
    AND status = 'open'
    AND p_new_host = ANY(participants);

  RETURN QUERY SELECT * FROM collab_sessions WHERE id = p_id;
END;
$$;

CREATE TABLE IF NOT EXISTS xp_award_buckets (
  publisher_id TEXT NOT NULL,
  bucket TEXT NOT NULL,
  day_utc TEXT NOT NULL,
  earned INT NOT NULL DEFAULT 0,
  PRIMARY KEY (publisher_id, bucket, day_utc)
);

ALTER TABLE xp_award_buckets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS xp_award_buckets_public ON xp_award_buckets;
CREATE POLICY xp_award_buckets_public
  ON xp_award_buckets FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION award_xp_capped_bucket(
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
  INSERT INTO xp_award_buckets (publisher_id, bucket, day_utc, earned)
  VALUES (p_publisher_id, p_bucket, today_str, 0)
  ON CONFLICT (publisher_id, bucket, day_utc) DO NOTHING;

  SELECT earned INTO current_daily
  FROM xp_award_buckets
  WHERE xp_award_buckets.publisher_id = p_publisher_id
    AND xp_award_buckets.bucket = p_bucket
    AND xp_award_buckets.day_utc = today_str
  FOR UPDATE;

  actual_amount := LEAST(GREATEST(p_amount, 0), GREATEST(0, p_daily_cap - coalesce(current_daily, 0)));

  IF actual_amount > 0 THEN
    UPDATE user_profiles
    SET xp = user_profiles.xp + actual_amount
    WHERE user_profiles.publisher_id = p_publisher_id
    RETURNING user_profiles.xp INTO new_xp;

    computed := (SELECT t FROM compute_level_and_title(new_xp) AS t);

    UPDATE user_profiles
    SET level = computed.new_level, title = computed.new_title
    WHERE user_profiles.publisher_id = p_publisher_id;

    UPDATE xp_award_buckets
    SET earned = earned + actual_amount
    WHERE xp_award_buckets.publisher_id = p_publisher_id
      AND xp_award_buckets.bucket = p_bucket
      AND xp_award_buckets.day_utc = today_str;
  END IF;

  RETURN QUERY
  SELECT up.publisher_id, up.username, up.xp, up.level, up.title, actual_amount, up.created_at, up.updated_at
  FROM user_profiles up
  WHERE up.publisher_id = p_publisher_id;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_community_conversations_updated_at'
  ) THEN
    CREATE TRIGGER trg_community_conversations_updated_at
    BEFORE UPDATE ON community_conversations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
  END IF;
END;
$$;

ALTER TABLE community_conversations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'community_conversations'
      AND policyname = 'Public read'
  ) THEN
    CREATE POLICY "Public read"
      ON community_conversations FOR SELECT
      USING (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'community_conversations'
      AND policyname = 'Public insert'
  ) THEN
    CREATE POLICY "Public insert"
      ON community_conversations FOR INSERT
      WITH CHECK (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'community_conversations'
      AND policyname = 'Metadata counters'
  ) THEN
    CREATE POLICY "Metadata counters"
      ON community_conversations FOR UPDATE
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION increment_download(conv_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE community_conversations SET downloads = downloads + 1 WHERE id = conv_id;
$$;

CREATE OR REPLACE FUNCTION increment_upvote(conv_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE community_conversations SET upvotes = upvotes + 1 WHERE id = conv_id;
$$;

CREATE OR REPLACE FUNCTION get_community_library_stats()
RETURNS TABLE (
  published_conversations BIGINT,
  published_publishers BIGINT,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    count(*)::BIGINT AS published_conversations,
    count(DISTINCT coalesce(
      nullif(btrim(publisher_id), ''),
      'legacy:' || md5(lower(trim(coalesce(nullif(author, ''), 'Anonymous'))))
    ))::BIGINT AS published_publishers,
    coalesce(max(updated_at), max(created_at), now()) AS updated_at
  FROM community_conversations;
$$;

CREATE TABLE IF NOT EXISTS creator_support_metrics (
  id TEXT PRIMARY KEY CHECK (id = 'global'),
  upvotes INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE creator_support_metrics
  ADD COLUMN IF NOT EXISTS upvotes INT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE creator_support_metrics
  ALTER COLUMN upvotes SET DEFAULT 0,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

UPDATE creator_support_metrics
SET
  upvotes = coalesce(upvotes, 0),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, created_at, now());

ALTER TABLE creator_support_metrics
  ALTER COLUMN upvotes SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

INSERT INTO creator_support_metrics (id)
VALUES ('global')
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_creator_support_metrics_updated_at'
  ) THEN
    CREATE TRIGGER trg_creator_support_metrics_updated_at
    BEFORE UPDATE ON creator_support_metrics
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
  END IF;
END;
$$;

ALTER TABLE creator_support_metrics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'creator_support_metrics'
      AND policyname = 'Public support read'
  ) THEN
    CREATE POLICY "Public support read"
      ON creator_support_metrics FOR SELECT
      USING (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'creator_support_metrics'
      AND policyname = 'Support metric insert'
  ) THEN
    CREATE POLICY "Support metric insert"
      ON creator_support_metrics FOR INSERT
      WITH CHECK (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'creator_support_metrics'
      AND policyname = 'Support metric update'
  ) THEN
    CREATE POLICY "Support metric update"
      ON creator_support_metrics FOR UPDATE
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION increment_creator_support_upvote(support_id TEXT DEFAULT 'global')
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO creator_support_metrics (id, upvotes)
  VALUES (coalesce(support_id, 'global'), 1)
  ON CONFLICT (id)
  DO UPDATE SET
    upvotes = creator_support_metrics.upvotes + 1,
    updated_at = now();
$$;

-- Site visitor counter
ALTER TABLE creator_support_metrics ADD COLUMN IF NOT EXISTS visitors INT;
ALTER TABLE creator_support_metrics ALTER COLUMN visitors SET DEFAULT 0;
UPDATE creator_support_metrics SET visitors = coalesce(visitors, 0);
ALTER TABLE creator_support_metrics ALTER COLUMN visitors SET NOT NULL;

CREATE OR REPLACE FUNCTION increment_site_visitor(support_id TEXT DEFAULT 'global')
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO creator_support_metrics (id, visitors)
  VALUES (coalesce(support_id, 'global'), 1)
  ON CONFLICT (id)
  DO UPDATE SET
    visitors = creator_support_metrics.visitors + 1,
    updated_at = now();
$$;

-- Active editor user presence counter
CREATE TABLE IF NOT EXISTS creator_active_users (
  user_id TEXT PRIMARY KEY,
  username TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backfill column for existing installs
ALTER TABLE creator_active_users
  ADD COLUMN IF NOT EXISTS username TEXT;

ALTER TABLE creator_active_users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'creator_active_users'
      AND policyname = 'Public active users read'
  ) THEN
    CREATE POLICY "Public active users read"
      ON creator_active_users FOR SELECT
      USING (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'creator_active_users'
      AND policyname = 'Public active users write'
  ) THEN
    CREATE POLICY "Public active users write"
      ON creator_active_users FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION touch_creator_active_user(
  active_user_id TEXT,
  stale_after_seconds INT DEFAULT 120,
  active_username TEXT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  normalized_user_id TEXT;
  normalized_username TEXT;
  active_count INT;
BEGIN
  normalized_user_id := nullif(btrim(active_user_id), '');
  normalized_username := nullif(btrim(active_username), '');

  IF normalized_user_id IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO creator_active_users (user_id, username, last_seen_at)
  VALUES (normalized_user_id, normalized_username, now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    last_seen_at = now(),
    username = COALESCE(EXCLUDED.username, creator_active_users.username);

  -- Persist to history log so offline visitors remain visible
  INSERT INTO site_visitor_log (user_id, username, last_seen_at)
  VALUES (normalized_user_id, normalized_username, now())
  ON CONFLICT (user_id) DO UPDATE SET
    last_seen_at = now(),
    username = COALESCE(EXCLUDED.username, site_visitor_log.username);

  DELETE FROM creator_active_users
  WHERE last_seen_at < now() - make_interval(secs => GREATEST(stale_after_seconds, 30));

  active_count := (SELECT count(*)::INT FROM creator_active_users);
  RETURN coalesce(active_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION get_active_creator_user_count(stale_after_seconds INT DEFAULT 120)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  active_count INT;
BEGIN
  DELETE FROM creator_active_users
  WHERE last_seen_at < now() - make_interval(secs => GREATEST(stale_after_seconds, 30));

  active_count := (SELECT count(*)::INT FROM creator_active_users);
  RETURN coalesce(active_count, 0);
END;
$$;

-- Returns the list of currently-active editor users (callsigns when registered,
-- NULL for anonymous "guest" sessions). Prunes stale rows before returning.
CREATE OR REPLACE FUNCTION get_active_creator_users(stale_after_seconds INT DEFAULT 120)
RETURNS TABLE (user_id TEXT, username TEXT, last_seen_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM creator_active_users
  WHERE last_seen_at < now() - make_interval(secs => GREATEST(stale_after_seconds, 30));

  RETURN QUERY
    SELECT u.user_id, u.username, u.last_seen_at
    FROM creator_active_users u
    ORDER BY
      CASE WHEN u.username IS NULL THEN 1 ELSE 0 END,
      u.username ASC NULLS LAST,
      u.last_seen_at DESC;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- User Profiles & Gamification (XP / Levels)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_profiles (
  publisher_id TEXT PRIMARY KEY,
  username     TEXT NOT NULL,
  xp           INT NOT NULL DEFAULT 0,
  level        INT NOT NULL DEFAULT 1,
  title        TEXT NOT NULL DEFAULT 'Rookie Stalker',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS xp INT,
  ADD COLUMN IF NOT EXISTS level INT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS avatar_icon TEXT,
  ADD COLUMN IF NOT EXISTS avatar_color TEXT,
  ADD COLUMN IF NOT EXISTS avatar_frame TEXT,
  ADD COLUMN IF NOT EXISTS avatar_frame_color TEXT,
  ADD COLUMN IF NOT EXISTS avatar_frame_intensity NUMERIC,
  ADD COLUMN IF NOT EXISTS avatar_banner TEXT,
  ADD COLUMN IF NOT EXISTS avatar_banner_opacity NUMERIC,
  ADD COLUMN IF NOT EXISTS avatar_banner_speed NUMERIC,
  ADD COLUMN IF NOT EXISTS avatar_effect TEXT,
  ADD COLUMN IF NOT EXISTS avatar_effect_color TEXT,
  ADD COLUMN IF NOT EXISTS avatar_effect_intensity NUMERIC,
  ADD COLUMN IF NOT EXISTS avatar_effect_speed NUMERIC,
  ADD COLUMN IF NOT EXISTS avatar_effect_saturation NUMERIC,
  ADD COLUMN IF NOT EXISTS avatar_effect_size NUMERIC,
  ADD COLUMN IF NOT EXISTS avatar_effect_alpha NUMERIC;

ALTER TABLE user_profiles
  ALTER COLUMN xp SET DEFAULT 0,
  ALTER COLUMN level SET DEFAULT 1,
  ALTER COLUMN title SET DEFAULT 'Rookie Stalker',
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

UPDATE user_profiles SET
  xp = coalesce(xp, 0),
  level = coalesce(level, 1),
  title = coalesce(title, 'Rookie Stalker'),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, created_at, now());

ALTER TABLE user_profiles
  ALTER COLUMN xp SET NOT NULL,
  ALTER COLUMN level SET NOT NULL,
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles (lower(username));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_profiles_updated_at'
  ) THEN
    CREATE TRIGGER trg_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
  END IF;
END;
$$;

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_profiles' AND policyname = 'Public profile read'
  ) THEN
    CREATE POLICY "Public profile read"
      ON user_profiles FOR SELECT USING (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_profiles' AND policyname = 'Public profile insert'
  ) THEN
    CREATE POLICY "Public profile insert"
      ON user_profiles FOR INSERT WITH CHECK (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_profiles' AND policyname = 'Public profile update'
  ) THEN
    CREATE POLICY "Public profile update"
      ON user_profiles FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END;
$$;

-- Level thresholds: { level: xpRequired, title }
-- 1:0 Rookie Stalker, 2:50 Novice Scribe, 3:150 Zone Correspondent,
-- 4:350 Seasoned Storyteller, 5:600 Veteran Narrator, 6:1000 Master Archivist,
-- 7:1500 Zone Legend, 8:2500 Monolith Wordsmith, 9:4000 Wish Granter,
-- 10:6000 Emissary of the Noosphere

CREATE OR REPLACE FUNCTION compute_level_and_title(total_xp INT)
RETURNS TABLE(new_level INT, new_title TEXT)
LANGUAGE sql IMMUTABLE
AS $$
  SELECT
    CASE
      WHEN total_xp >= 6000 THEN 10
      WHEN total_xp >= 4000 THEN 9
      WHEN total_xp >= 2500 THEN 8
      WHEN total_xp >= 1500 THEN 7
      WHEN total_xp >= 1000 THEN 6
      WHEN total_xp >= 600  THEN 5
      WHEN total_xp >= 350  THEN 4
      WHEN total_xp >= 150  THEN 3
      WHEN total_xp >= 50   THEN 2
      ELSE 1
    END,
    CASE
      WHEN total_xp >= 6000 THEN 'Emissary of the Noosphere'
      WHEN total_xp >= 4000 THEN 'Wish Granter'
      WHEN total_xp >= 2500 THEN 'Monolith Wordsmith'
      WHEN total_xp >= 1500 THEN 'Zone Legend'
      WHEN total_xp >= 1000 THEN 'Master Archivist'
      WHEN total_xp >= 600  THEN 'Veteran Narrator'
      WHEN total_xp >= 350  THEN 'Seasoned Storyteller'
      WHEN total_xp >= 150  THEN 'Zone Correspondent'
      WHEN total_xp >= 50   THEN 'Novice Scribe'
      ELSE 'Rookie Stalker'
    END;
$$;

CREATE OR REPLACE FUNCTION register_username(p_publisher_id TEXT, p_username TEXT)
RETURNS TABLE(publisher_id TEXT, username TEXT, xp INT, level INT, title TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  clean_name TEXT := btrim(p_username);
BEGIN
  IF length(clean_name) < 3 OR length(clean_name) > 20 THEN
    RAISE EXCEPTION 'Username must be 3–20 characters.';
  END IF;
  IF clean_name !~ '^[A-Za-z0-9_\-\.]+$' THEN
    RAISE EXCEPTION 'Username may only contain letters, numbers, underscores, hyphens, and dots.';
  END IF;

  INSERT INTO user_profiles (publisher_id, username)
  VALUES (p_publisher_id, clean_name)
  ON CONFLICT ON CONSTRAINT user_profiles_pkey
  DO UPDATE SET username = clean_name, updated_at = now();

  RETURN QUERY
  SELECT up.publisher_id, up.username, up.xp, up.level, up.title, up.created_at, up.updated_at
  FROM user_profiles up
  WHERE up.publisher_id = p_publisher_id;
END;
$$;

-- Drop older signatures so we can widen the return type safely.
DROP FUNCTION IF EXISTS get_user_profile(TEXT);

CREATE OR REPLACE FUNCTION get_user_profile(p_publisher_id TEXT)
RETURNS TABLE(
  publisher_id TEXT, username TEXT, xp INT, level INT, title TEXT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  avatar_icon TEXT, avatar_color TEXT,
  avatar_frame TEXT, avatar_frame_color TEXT, avatar_frame_intensity NUMERIC,
  avatar_banner TEXT, avatar_banner_opacity NUMERIC, avatar_banner_speed NUMERIC,
  avatar_effect TEXT, avatar_effect_color TEXT, avatar_effect_intensity NUMERIC,
  avatar_effect_speed NUMERIC, avatar_effect_saturation NUMERIC,
  avatar_effect_size NUMERIC, avatar_effect_alpha NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT up.publisher_id, up.username, up.xp, up.level, up.title,
         up.created_at, up.updated_at,
         up.avatar_icon, up.avatar_color,
         up.avatar_frame, up.avatar_frame_color, up.avatar_frame_intensity,
         up.avatar_banner, up.avatar_banner_opacity, up.avatar_banner_speed,
         up.avatar_effect, up.avatar_effect_color, up.avatar_effect_intensity,
         up.avatar_effect_speed, up.avatar_effect_saturation,
         up.avatar_effect_size, up.avatar_effect_alpha
  FROM user_profiles up
  WHERE up.publisher_id = p_publisher_id
  LIMIT 1;
$$;

-- Update user cosmetics (avatar icon, color, frame, banner, effect + all tweak fields).
-- Any of the fields may be NULL/omitted; NULLs clear the value.
-- Drop old signatures so we can widen the parameter list and return type.
DROP FUNCTION IF EXISTS update_user_cosmetics(TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS update_user_cosmetics(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION update_user_cosmetics(
  p_publisher_id          TEXT,
  p_avatar_icon           TEXT    DEFAULT NULL,
  p_avatar_color          TEXT    DEFAULT NULL,
  p_avatar_frame          TEXT    DEFAULT NULL,
  p_avatar_frame_color    TEXT    DEFAULT NULL,
  p_avatar_frame_intensity NUMERIC DEFAULT NULL,
  p_avatar_banner         TEXT    DEFAULT NULL,
  p_avatar_banner_opacity NUMERIC DEFAULT NULL,
  p_avatar_banner_speed   NUMERIC DEFAULT NULL,
  p_avatar_effect         TEXT    DEFAULT NULL,
  p_avatar_effect_color   TEXT    DEFAULT NULL,
  p_avatar_effect_intensity NUMERIC DEFAULT NULL,
  p_avatar_effect_speed   NUMERIC DEFAULT NULL,
  p_avatar_effect_saturation NUMERIC DEFAULT NULL,
  p_avatar_effect_size    NUMERIC DEFAULT NULL,
  p_avatar_effect_alpha   NUMERIC DEFAULT NULL
)
RETURNS TABLE(
  publisher_id TEXT, username TEXT, xp INT, level INT, title TEXT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  avatar_icon TEXT, avatar_color TEXT,
  avatar_frame TEXT, avatar_frame_color TEXT, avatar_frame_intensity NUMERIC,
  avatar_banner TEXT, avatar_banner_opacity NUMERIC, avatar_banner_speed NUMERIC,
  avatar_effect TEXT, avatar_effect_color TEXT, avatar_effect_intensity NUMERIC,
  avatar_effect_speed NUMERIC, avatar_effect_saturation NUMERIC,
  avatar_effect_size NUMERIC, avatar_effect_alpha NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_profiles up SET
    avatar_icon              = p_avatar_icon,
    avatar_color             = p_avatar_color,
    avatar_frame             = p_avatar_frame,
    avatar_frame_color       = p_avatar_frame_color,
    avatar_frame_intensity   = p_avatar_frame_intensity,
    avatar_banner            = p_avatar_banner,
    avatar_banner_opacity    = p_avatar_banner_opacity,
    avatar_banner_speed      = p_avatar_banner_speed,
    avatar_effect            = p_avatar_effect,
    avatar_effect_color      = p_avatar_effect_color,
    avatar_effect_intensity  = p_avatar_effect_intensity,
    avatar_effect_speed      = p_avatar_effect_speed,
    avatar_effect_saturation = p_avatar_effect_saturation,
    avatar_effect_size       = p_avatar_effect_size,
    avatar_effect_alpha      = p_avatar_effect_alpha
  WHERE up.publisher_id = p_publisher_id;

  RETURN QUERY
  SELECT up.publisher_id, up.username, up.xp, up.level, up.title,
         up.created_at, up.updated_at,
         up.avatar_icon, up.avatar_color,
         up.avatar_frame, up.avatar_frame_color, up.avatar_frame_intensity,
         up.avatar_banner, up.avatar_banner_opacity, up.avatar_banner_speed,
         up.avatar_effect, up.avatar_effect_color, up.avatar_effect_intensity,
         up.avatar_effect_speed, up.avatar_effect_saturation,
         up.avatar_effect_size, up.avatar_effect_alpha
  FROM user_profiles up
  WHERE up.publisher_id = p_publisher_id;
END;
$$;

CREATE OR REPLACE FUNCTION award_xp(p_publisher_id TEXT, p_amount INT)
RETURNS TABLE(publisher_id TEXT, username TEXT, xp INT, level INT, title TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_xp INT;
  computed RECORD;
BEGIN
  UPDATE user_profiles
  SET xp = user_profiles.xp + p_amount
  WHERE user_profiles.publisher_id = p_publisher_id
  RETURNING user_profiles.xp INTO new_xp;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  computed := (SELECT t FROM compute_level_and_title(new_xp) AS t);

  UPDATE user_profiles
  SET level = computed.new_level, title = computed.new_title
  WHERE user_profiles.publisher_id = p_publisher_id;

  RETURN QUERY
  SELECT up.publisher_id, up.username, up.xp, up.level, up.title, up.created_at, up.updated_at
  FROM user_profiles up
  WHERE up.publisher_id = p_publisher_id;
END;
$$;

-- `CREATE OR REPLACE FUNCTION` cannot change a function's OUT parameter row type,
-- so drop any legacy `get_leaderboard(integer)` definition before recreating it.
DROP FUNCTION IF EXISTS get_leaderboard(INT);

CREATE OR REPLACE FUNCTION get_leaderboard(p_limit INT DEFAULT 10)
RETURNS TABLE(
  publisher_id TEXT, username TEXT, xp INT, level INT, title TEXT,
  avatar_icon TEXT, avatar_color TEXT,
  avatar_frame TEXT, avatar_frame_color TEXT, avatar_frame_intensity NUMERIC,
  avatar_banner TEXT, avatar_banner_opacity NUMERIC, avatar_banner_speed NUMERIC,
  avatar_effect TEXT, avatar_effect_color TEXT, avatar_effect_intensity NUMERIC,
  avatar_effect_speed NUMERIC, avatar_effect_saturation NUMERIC,
  avatar_effect_size NUMERIC, avatar_effect_alpha NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT publisher_id, username, xp, level, title,
         avatar_icon, avatar_color,
         avatar_frame, avatar_frame_color, avatar_frame_intensity,
         avatar_banner, avatar_banner_opacity, avatar_banner_speed,
         avatar_effect, avatar_effect_color, avatar_effect_intensity,
         avatar_effect_speed, avatar_effect_saturation,
         avatar_effect_size, avatar_effect_alpha
  FROM user_profiles
  WHERE xp > 0
  ORDER BY xp DESC, created_at ASC
  LIMIT p_limit;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Gamification: Achievements & Streaks
-- ═══════════════════════════════════════════════════════════════════════════

-- Per-user achievement tracking (server-side truth, prevents abuse via device switching)
CREATE TABLE IF NOT EXISTS user_achievements (
  publisher_id    TEXT NOT NULL,
  achievement_id  TEXT NOT NULL,
  unlocked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (publisher_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_publisher ON user_achievements (publisher_id);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_achievements' AND policyname = 'Public achievement read'
  ) THEN
    CREATE POLICY "Public achievement read"
      ON user_achievements FOR SELECT USING (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_achievements' AND policyname = 'Public achievement insert'
  ) THEN
    CREATE POLICY "Public achievement insert"
      ON user_achievements FOR INSERT WITH CHECK (true);
  END IF;
END;
$$;

-- Unlock an achievement (idempotent — does nothing if already unlocked)
CREATE OR REPLACE FUNCTION unlock_achievement(p_publisher_id TEXT, p_achievement_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  was_new BOOLEAN;
BEGIN
  INSERT INTO user_achievements (publisher_id, achievement_id)
  VALUES (p_publisher_id, p_achievement_id)
  ON CONFLICT ON CONSTRAINT user_achievements_pkey DO NOTHING;

  GET DIAGNOSTICS was_new = ROW_COUNT;
  RETURN was_new > 0;
END;
$$;

-- Get all achievements for a user
CREATE OR REPLACE FUNCTION get_user_achievements(p_publisher_id TEXT)
RETURNS TABLE(achievement_id TEXT, unlocked_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT ua.achievement_id, ua.unlocked_at
  FROM user_achievements ua
  WHERE ua.publisher_id = p_publisher_id
  ORDER BY ua.unlocked_at ASC;
$$;

-- Per-user streak tracking (server-side backup)
CREATE TABLE IF NOT EXISTS user_streaks (
  publisher_id      TEXT PRIMARY KEY,
  publish_streak    INT NOT NULL DEFAULT 0,
  longest_streak    INT NOT NULL DEFAULT 0,
  last_publish_week TEXT NOT NULL DEFAULT '',
  login_streak      INT NOT NULL DEFAULT 0,
  last_login_date   TEXT NOT NULL DEFAULT '',
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_streaks_publisher ON user_streaks (publisher_id);

ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_streaks' AND policyname = 'Public streak read'
  ) THEN
    CREATE POLICY "Public streak read"
      ON user_streaks FOR SELECT USING (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_streaks' AND policyname = 'Public streak upsert'
  ) THEN
    CREATE POLICY "Public streak upsert"
      ON user_streaks FOR INSERT WITH CHECK (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_streaks' AND policyname = 'Public streak update'
  ) THEN
    CREATE POLICY "Public streak update"
      ON user_streaks FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END;
$$;

-- Upsert streak data
CREATE OR REPLACE FUNCTION update_user_streak(
  p_publisher_id TEXT,
  p_publish_streak INT,
  p_longest_streak INT,
  p_last_publish_week TEXT,
  p_login_streak INT,
  p_last_login_date TEXT
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO user_streaks (publisher_id, publish_streak, longest_streak, last_publish_week, login_streak, last_login_date)
  VALUES (p_publisher_id, p_publish_streak, p_longest_streak, p_last_publish_week, p_login_streak, p_last_login_date)
  ON CONFLICT (publisher_id)
  DO UPDATE SET
    publish_streak = GREATEST(user_streaks.publish_streak, p_publish_streak),
    longest_streak = GREATEST(user_streaks.longest_streak, p_longest_streak),
    last_publish_week = p_last_publish_week,
    login_streak = GREATEST(user_streaks.login_streak, p_login_streak),
    last_login_date = p_last_login_date,
    updated_at = now();
$$;

-- Per-user mission progress tracking (daily + weekly mission loop)
CREATE TABLE IF NOT EXISTS user_mission_progress (
  publisher_id  TEXT NOT NULL,
  mission_id    TEXT NOT NULL,
  mission_slot  TEXT NOT NULL,
  cadence       TEXT NOT NULL,
  category      TEXT NOT NULL,
  progress      INT NOT NULL DEFAULT 0,
  goal          INT NOT NULL DEFAULT 1,
  period_key    TEXT NOT NULL,
  completed_at  TIMESTAMPTZ NULL,
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (publisher_id, mission_id, period_key)
);

CREATE INDEX IF NOT EXISTS idx_user_mission_progress_publisher ON user_mission_progress (publisher_id);
CREATE INDEX IF NOT EXISTS idx_user_mission_progress_period ON user_mission_progress (period_key);

ALTER TABLE user_mission_progress ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_mission_progress' AND policyname = 'Public mission read'
  ) THEN
    CREATE POLICY "Public mission read"
      ON user_mission_progress FOR SELECT USING (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_mission_progress' AND policyname = 'Public mission upsert'
  ) THEN
    CREATE POLICY "Public mission upsert"
      ON user_mission_progress FOR INSERT WITH CHECK (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_mission_progress' AND policyname = 'Public mission update'
  ) THEN
    CREATE POLICY "Public mission update"
      ON user_mission_progress FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END;
$$;

-- Add daily_xp_earned to user_profiles for server-side daily cap enforcement
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS daily_xp_earned INT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS daily_xp_date TEXT;

ALTER TABLE user_profiles
  ALTER COLUMN daily_xp_earned SET DEFAULT 0,
  ALTER COLUMN daily_xp_date SET DEFAULT '';

UPDATE user_profiles SET
  daily_xp_earned = coalesce(daily_xp_earned, 0),
  daily_xp_date = coalesce(daily_xp_date, '');

-- Server-enforced XP award with daily cap for gamification bonuses
CREATE OR REPLACE FUNCTION award_xp_capped(p_publisher_id TEXT, p_amount INT, p_daily_cap INT DEFAULT 500)
RETURNS TABLE(publisher_id TEXT, username TEXT, xp INT, level INT, title TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
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
  -- Reset daily counter if new day
  UPDATE user_profiles
  SET daily_xp_earned = 0, daily_xp_date = today_str
  WHERE user_profiles.publisher_id = p_publisher_id
    AND (user_profiles.daily_xp_date IS DISTINCT FROM today_str);

  -- Read current daily earned
  current_daily := (SELECT coalesce(user_profiles.daily_xp_earned, 0) FROM user_profiles WHERE user_profiles.publisher_id = p_publisher_id);

  IF NOT FOUND THEN RETURN; END IF;

  -- Clamp to daily cap
  actual_amount := LEAST(p_amount, GREATEST(0, p_daily_cap - current_daily));
  IF actual_amount <= 0 THEN
    -- Still return the profile
    RETURN QUERY
    SELECT up.publisher_id, up.username, up.xp, up.level, up.title, up.created_at, up.updated_at
    FROM user_profiles up WHERE up.publisher_id = p_publisher_id;
    RETURN;
  END IF;

  -- Award and update daily counter
  UPDATE user_profiles
  SET xp = user_profiles.xp + actual_amount,
      daily_xp_earned = coalesce(user_profiles.daily_xp_earned, 0) + actual_amount
  WHERE user_profiles.publisher_id = p_publisher_id
  RETURNING user_profiles.xp INTO new_xp;

  computed := (SELECT t FROM compute_level_and_title(new_xp) AS t);

  UPDATE user_profiles
  SET level = computed.new_level, title = computed.new_title
  WHERE user_profiles.publisher_id = p_publisher_id;

  RETURN QUERY
  SELECT up.publisher_id, up.username, up.xp, up.level, up.title, up.created_at, up.updated_at
  FROM user_profiles up
  WHERE up.publisher_id = p_publisher_id;
END;
$$;
-- Compatibility helper for older API code. Prefer get_active_creator_users
-- when callers need anonymous guest sessions too.
CREATE OR REPLACE FUNCTION get_active_creator_usernames(stale_after_seconds INT DEFAULT 120)
RETURNS TABLE (username TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM creator_active_users
  WHERE last_seen_at < now() - make_interval(secs => GREATEST(stale_after_seconds, 30));

  RETURN QUERY
    SELECT u.username
    FROM creator_active_users u
    WHERE u.username IS NOT NULL
    ORDER BY u.username ASC;
END;
$$;

-- Persistent visitor history (never pruned, unlike creator_active_users)
CREATE TABLE IF NOT EXISTS site_visitor_log (
  user_id        TEXT PRIMARY KEY,
  username       TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE site_visitor_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public visitor log read" ON site_visitor_log;
CREATE POLICY "Public visitor log read"
  ON site_visitor_log FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public visitor log write" ON site_visitor_log;
CREATE POLICY "Public visitor log write"
  ON site_visitor_log FOR ALL USING (true) WITH CHECK (true);

-- Editor bug reports / complaints
CREATE TABLE IF NOT EXISTS editor_bug_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  author_username TEXT,
  author_publisher_id TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'fixed')),
  admin_reply TEXT NOT NULL DEFAULT '',
  admin_publisher_id TEXT,
  admin_username TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE editor_bug_reports
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS author_username TEXT,
  ADD COLUMN IF NOT EXISTS author_publisher_id TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS admin_reply TEXT,
  ADD COLUMN IF NOT EXISTS admin_publisher_id TEXT,
  ADD COLUMN IF NOT EXISTS admin_username TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE editor_bug_reports
  ALTER COLUMN status SET DEFAULT 'open',
  ALTER COLUMN admin_reply SET DEFAULT '',
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

UPDATE editor_bug_reports
SET
  subject = coalesce(subject, ''),
  message = coalesce(message, ''),
  status = CASE WHEN status IN ('open', 'closed', 'fixed') THEN status ELSE 'open' END,
  admin_reply = coalesce(admin_reply, ''),
  metadata = coalesce(metadata, '{}'::jsonb),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, created_at, now());

ALTER TABLE editor_bug_reports
  ALTER COLUMN subject SET NOT NULL,
  ALTER COLUMN message SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN admin_reply SET NOT NULL,
  ALTER COLUMN metadata SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'editor_bug_reports_status_check'
  ) THEN
    ALTER TABLE editor_bug_reports
      ADD CONSTRAINT editor_bug_reports_status_check
      CHECK (status IN ('open', 'closed', 'fixed'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_editor_bug_reports_status ON editor_bug_reports (status);
CREATE INDEX IF NOT EXISTS idx_editor_bug_reports_created ON editor_bug_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_editor_bug_reports_updated ON editor_bug_reports (updated_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_editor_bug_reports_updated_at'
  ) THEN
    CREATE TRIGGER trg_editor_bug_reports_updated_at
    BEFORE UPDATE ON editor_bug_reports
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
  END IF;
END;
$$;

ALTER TABLE editor_bug_reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'editor_bug_reports'
      AND policyname = 'Public bug report read'
  ) THEN
    CREATE POLICY "Public bug report read"
      ON editor_bug_reports FOR SELECT
      USING (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'editor_bug_reports'
      AND policyname = 'Public bug report insert'
  ) THEN
    CREATE POLICY "Public bug report insert"
      ON editor_bug_reports FOR INSERT
      WITH CHECK (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'editor_bug_reports'
      AND policyname = 'Public bug report update'
  ) THEN
    CREATE POLICY "Public bug report update"
      ON editor_bug_reports FOR UPDATE
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'editor_bug_reports'
      AND policyname = 'Public bug report delete'
  ) THEN
    CREATE POLICY "Public bug report delete"
      ON editor_bug_reports FOR DELETE
      USING (true);
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Profile / Achievement Overhaul — Server-Authoritative Reward Helpers
-- ═══════════════════════════════════════════════════════════════════════════

-- Unlock an achievement AND award its XP in one transaction. Returns whether
-- the achievement was newly unlocked and the updated profile. XP is only
-- awarded when the unlock is new, preventing re-award via replay.
CREATE OR REPLACE FUNCTION unlock_achievement_rewarded(
  p_publisher_id TEXT,
  p_achievement_id TEXT,
  p_xp INT DEFAULT 0
)
RETURNS TABLE(
  was_new BOOLEAN,
  achievement_id TEXT,
  awarded_xp INT,
  publisher_id TEXT,
  username TEXT,
  xp INT,
  level INT,
  title TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inserted_row BIGINT;
  v_was_new BOOLEAN := false;
  v_awarded INT := 0;
  computed RECORD;
  new_xp INT;
BEGIN
  INSERT INTO user_achievements (publisher_id, achievement_id)
  VALUES (p_publisher_id, p_achievement_id)
  ON CONFLICT ON CONSTRAINT user_achievements_pkey DO NOTHING;
  GET DIAGNOSTICS inserted_row = ROW_COUNT;
  v_was_new := inserted_row > 0;

  IF v_was_new AND p_xp > 0 THEN
    UPDATE user_profiles
    SET xp = user_profiles.xp + p_xp
    WHERE user_profiles.publisher_id = p_publisher_id
    RETURNING user_profiles.xp INTO new_xp;

    IF FOUND THEN
      computed := (SELECT t FROM compute_level_and_title(new_xp) AS t);
      UPDATE user_profiles
      SET level = computed.new_level, title = computed.new_title
      WHERE user_profiles.publisher_id = p_publisher_id;
      v_awarded := p_xp;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    v_was_new,
    p_achievement_id,
    v_awarded,
    up.publisher_id,
    up.username,
    up.xp,
    up.level,
    up.title
  FROM user_profiles up
  WHERE up.publisher_id = p_publisher_id;
END;
$$;

-- Evaluate and apply all publish-related rewards after a conversation is
-- saved. Returns an aggregate row including any newly unlocked achievements
-- (as JSONB array) and the updated profile snapshot.
CREATE OR REPLACE FUNCTION apply_publish_rewards(p_conversation_id UUID)
RETURNS TABLE(
  publisher_id TEXT,
  username TEXT,
  xp INT,
  level INT,
  title TEXT,
  publish_xp INT,
  achievement_xp INT,
  newly_unlocked JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  conv RECORD;
  pub_id TEXT;
  complexity_xp INT := 150;
  total_publishes INT := 0;
  distinct_factions INT := 0;
  faction_list TEXT[];
  branch_count INT := 0;
  v_publish_xp INT := 0;
  v_ach_xp INT := 0;
  unlocked JSONB := '[]'::jsonb;
  ach RECORD;
  hour_utc INT;
  computed RECORD;
  new_xp INT;
BEGIN
  SELECT c.publisher_id, c.branch_count, c.faction, c.complexity, c.created_at
    INTO conv
  FROM community_conversations c
  WHERE c.id = p_conversation_id
  LIMIT 1;

  IF NOT FOUND OR conv.publisher_id IS NULL OR conv.publisher_id = '' THEN
    RETURN;
  END IF;

  pub_id := conv.publisher_id;
  branch_count := coalesce(conv.branch_count, 0);

  -- Publish XP by complexity
  IF conv.complexity = 'long' THEN complexity_xp := 300;
  ELSIF conv.complexity = 'medium' THEN complexity_xp := 225;
  ELSE complexity_xp := 150;
  END IF;

  -- Ensure profile row exists; skip rewards if missing (unregistered).
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.publisher_id = pub_id) THEN
    RETURN;
  END IF;

  -- Award publish XP
  UPDATE user_profiles
  SET xp = user_profiles.xp + complexity_xp
  WHERE user_profiles.publisher_id = pub_id
  RETURNING user_profiles.xp INTO new_xp;
  computed := (SELECT t FROM compute_level_and_title(new_xp) AS t);
  UPDATE user_profiles
  SET level = computed.new_level, title = computed.new_title
  WHERE user_profiles.publisher_id = pub_id;
  v_publish_xp := complexity_xp;

  -- Publisher totals
  SELECT count(*)::INT, array_agg(DISTINCT c.faction)
    INTO total_publishes, faction_list
  FROM community_conversations c
  WHERE c.publisher_id = pub_id;
  distinct_factions := coalesce(array_length(faction_list, 1), 0);

  hour_utc := EXTRACT(HOUR FROM (conv.created_at AT TIME ZONE 'UTC'))::INT;

  -- Candidate achievements
  -- (id, xp) pairs evaluated in order; each uses unlock_achievement_rewarded
  -- which skips re-awards.
  IF total_publishes >= 1 THEN
    ach := (SELECT t FROM unlock_achievement_rewarded(pub_id, 'first_publish', 25) AS t);
    IF ach.was_new THEN
      v_ach_xp := v_ach_xp + ach.awarded_xp;
      unlocked := unlocked || jsonb_build_object('achievement_id','first_publish','xp',ach.awarded_xp);
    END IF;
  END IF;
  IF total_publishes >= 2 THEN
    ach := (SELECT t FROM unlock_achievement_rewarded(pub_id, 'first_patrol', 20) AS t);
    IF ach.was_new THEN
      v_ach_xp := v_ach_xp + ach.awarded_xp;
      unlocked := unlocked || jsonb_build_object('achievement_id','first_patrol','xp',ach.awarded_xp);
    END IF;
  END IF;
  IF total_publishes >= 5 THEN
    ach := (SELECT t FROM unlock_achievement_rewarded(pub_id, 'cartographer', 65) AS t);
    IF ach.was_new THEN
      v_ach_xp := v_ach_xp + ach.awarded_xp;
      unlocked := unlocked || jsonb_build_object('achievement_id','cartographer','xp',ach.awarded_xp);
    END IF;
  END IF;
  IF total_publishes >= 10 THEN
    ach := (SELECT t FROM unlock_achievement_rewarded(pub_id, 'prolific_writer', 150) AS t);
    IF ach.was_new THEN
      v_ach_xp := v_ach_xp + ach.awarded_xp;
      unlocked := unlocked || jsonb_build_object('achievement_id','prolific_writer','xp',ach.awarded_xp);
    END IF;
  END IF;
  IF total_publishes >= 50 THEN
    ach := (SELECT t FROM unlock_achievement_rewarded(pub_id, 'zone_veteran', 500) AS t);
    IF ach.was_new THEN
      v_ach_xp := v_ach_xp + ach.awarded_xp;
      unlocked := unlocked || jsonb_build_object('achievement_id','zone_veteran','xp',ach.awarded_xp);
    END IF;
  END IF;
  IF branch_count >= 5 THEN
    ach := (SELECT t FROM unlock_achievement_rewarded(pub_id, 'branching_out', 30) AS t);
    IF ach.was_new THEN
      v_ach_xp := v_ach_xp + ach.awarded_xp;
      unlocked := unlocked || jsonb_build_object('achievement_id','branching_out','xp',ach.awarded_xp);
    END IF;
  END IF;
  IF branch_count >= 8 THEN
    ach := (SELECT t FROM unlock_achievement_rewarded(pub_id, 'branch_architect', 70) AS t);
    IF ach.was_new THEN
      v_ach_xp := v_ach_xp + ach.awarded_xp;
      unlocked := unlocked || jsonb_build_object('achievement_id','branch_architect','xp',ach.awarded_xp);
    END IF;
  END IF;
  IF distinct_factions >= 1 THEN
    ach := (SELECT t FROM unlock_achievement_rewarded(pub_id, 'new_faction_scout', 35) AS t);
    IF ach.was_new THEN
      v_ach_xp := v_ach_xp + ach.awarded_xp;
      unlocked := unlocked || jsonb_build_object('achievement_id','new_faction_scout','xp',ach.awarded_xp);
    END IF;
  END IF;
  IF distinct_factions >= 3 THEN
    ach := (SELECT t FROM unlock_achievement_rewarded(pub_id, 'faction_diplomat', 75) AS t);
    IF ach.was_new THEN
      v_ach_xp := v_ach_xp + ach.awarded_xp;
      unlocked := unlocked || jsonb_build_object('achievement_id','faction_diplomat','xp',ach.awarded_xp);
    END IF;
  END IF;
  IF hour_utc >= 22 OR hour_utc < 5 THEN
    ach := (SELECT t FROM unlock_achievement_rewarded(pub_id, 'night_shift', 45) AS t);
    IF ach.was_new THEN
      v_ach_xp := v_ach_xp + ach.awarded_xp;
      unlocked := unlocked || jsonb_build_object('achievement_id','night_shift','xp',ach.awarded_xp);
    END IF;
  END IF;

  RETURN QUERY
  SELECT up.publisher_id, up.username, up.xp, up.level, up.title,
         v_publish_xp, v_ach_xp, unlocked
  FROM user_profiles up
  WHERE up.publisher_id = pub_id;
END;
$$;

-- Re-evaluate aggregate metric achievements (downloads / upvotes) for a
-- publisher after their metrics change. Idempotent — re-award is suppressed.
CREATE OR REPLACE FUNCTION apply_metric_rewards(p_publisher_id TEXT, p_metric_type TEXT)
RETURNS TABLE(
  publisher_id TEXT,
  xp INT,
  level INT,
  title TEXT,
  achievement_xp INT,
  newly_unlocked JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_dl BIGINT := 0;
  total_up BIGINT := 0;
  v_ach_xp INT := 0;
  unlocked JSONB := '[]'::jsonb;
  ach RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.publisher_id = p_publisher_id) THEN
    RETURN;
  END IF;

  IF p_metric_type = 'downloads' OR p_metric_type = 'both' THEN
    total_dl := (SELECT coalesce(sum(c.downloads), 0) FROM community_conversations c WHERE c.publisher_id = p_publisher_id);

    IF total_dl >= 50 THEN
      ach := (SELECT t FROM unlock_achievement_rewarded(p_publisher_id, 'popular_stalker', 100) AS t);
      IF ach.was_new THEN
        v_ach_xp := v_ach_xp + ach.awarded_xp;
        unlocked := unlocked || jsonb_build_object('achievement_id','popular_stalker','xp',ach.awarded_xp);
      END IF;
    END IF;
    IF total_dl >= 100 THEN
      ach := (SELECT t FROM unlock_achievement_rewarded(p_publisher_id, 'download_centurion', 180) AS t);
      IF ach.was_new THEN
        v_ach_xp := v_ach_xp + ach.awarded_xp;
        unlocked := unlocked || jsonb_build_object('achievement_id','download_centurion','xp',ach.awarded_xp);
      END IF;
    END IF;
    IF total_dl >= 500 THEN
      ach := (SELECT t FROM unlock_achievement_rewarded(p_publisher_id, 'download_legion', 450) AS t);
      IF ach.was_new THEN
        v_ach_xp := v_ach_xp + ach.awarded_xp;
        unlocked := unlocked || jsonb_build_object('achievement_id','download_legion','xp',ach.awarded_xp);
      END IF;
    END IF;
  END IF;

  IF p_metric_type = 'upvotes' OR p_metric_type = 'both' THEN
    total_up := (SELECT coalesce(sum(c.upvotes), 0) FROM community_conversations c WHERE c.publisher_id = p_publisher_id);

    IF total_up >= 1 THEN
      ach := (SELECT t FROM unlock_achievement_rewarded(p_publisher_id, 'first_upvote_received', 20) AS t);
      IF ach.was_new THEN
        v_ach_xp := v_ach_xp + ach.awarded_xp;
        unlocked := unlocked || jsonb_build_object('achievement_id','first_upvote_received','xp',ach.awarded_xp);
      END IF;
    END IF;
    IF total_up >= 10 THEN
      ach := (SELECT t FROM unlock_achievement_rewarded(p_publisher_id, 'rising_signal', 45) AS t);
      IF ach.was_new THEN
        v_ach_xp := v_ach_xp + ach.awarded_xp;
        unlocked := unlocked || jsonb_build_object('achievement_id','rising_signal','xp',ach.awarded_xp);
      END IF;
    END IF;
    IF total_up >= 25 THEN
      ach := (SELECT t FROM unlock_achievement_rewarded(p_publisher_id, 'community_favorite', 100) AS t);
      IF ach.was_new THEN
        v_ach_xp := v_ach_xp + ach.awarded_xp;
        unlocked := unlocked || jsonb_build_object('achievement_id','community_favorite','xp',ach.awarded_xp);
      END IF;
    END IF;
    IF total_up >= 75 THEN
      ach := (SELECT t FROM unlock_achievement_rewarded(p_publisher_id, 'crowd_pleaser', 160) AS t);
      IF ach.was_new THEN
        v_ach_xp := v_ach_xp + ach.awarded_xp;
        unlocked := unlocked || jsonb_build_object('achievement_id','crowd_pleaser','xp',ach.awarded_xp);
      END IF;
    END IF;
    IF total_up >= 250 THEN
      ach := (SELECT t FROM unlock_achievement_rewarded(p_publisher_id, 'upvote_legend', 400) AS t);
      IF ach.was_new THEN
        v_ach_xp := v_ach_xp + ach.awarded_xp;
        unlocked := unlocked || jsonb_build_object('achievement_id','upvote_legend','xp',ach.awarded_xp);
      END IF;
    END IF;
  END IF;

  RETURN QUERY
  SELECT up.publisher_id, up.xp, up.level, up.title, v_ach_xp, unlocked
  FROM user_profiles up
  WHERE up.publisher_id = p_publisher_id;
END;
$$;

-- Re-check historical publish data for users who published before
-- server-side achievement evaluation existed. This awards achievement XP only;
-- it does not replay per-publish XP.
CREATE OR REPLACE FUNCTION recheck_publish_achievements(p_publisher_id TEXT)
RETURNS TABLE(
  publisher_id TEXT,
  achievement_xp INT,
  newly_unlocked JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_publishes INT := 0;
  distinct_factions INT := 0;
  max_branch_score INT := 0;
  max_turn_count INT := 0;
  max_precondition_count INT := 0;
  max_outcome_type_count INT := 0;
  max_combo_outcomes INT := 0;
  max_combo_preconditions INT := 0;
  has_uncommon BOOLEAN := false;
  has_night_publish BOOLEAN := false;
  has_dawn_publish BOOLEAN := false;
  has_weekend_pair BOOLEAN := false;
  longest_publish_streak INT := 0;
  v_ach_xp INT := 0;
  unlocked JSONB := '[]'::jsonb;
  candidate RECORD;
  ach RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.publisher_id = p_publisher_id) THEN
    RETURN;
  END IF;

  WITH convs AS (
    SELECT
      c.id,
      c.faction,
      c.branch_count,
      c.created_at,
      coalesce(c.data->'conversations'->0, c.data) AS conv_json
    FROM community_conversations c
    WHERE c.publisher_id = p_publisher_id
  ),
  turn_stats AS (
    SELECT
      c.id,
      CASE
        WHEN jsonb_typeof(c.conv_json->'turns') = 'array' THEN jsonb_array_length(c.conv_json->'turns')
        ELSE 0
      END AS turn_count,
      CASE
        WHEN jsonb_typeof(c.conv_json->'preconditions') = 'array' THEN jsonb_array_length(c.conv_json->'preconditions')
        ELSE 0
      END AS precondition_count
    FROM convs c
  ),
  outcome_counts AS (
    SELECT
      c.id,
      count(DISTINCT nullif(outcome_obj.outcome_json->>'command', ''))::INT AS outcome_type_count,
      bool_or((outcome_obj.outcome_json->>'command') IN (
        'spawn_custom_npc',
        'spawn_custom_npc_at',
        'teleport_npc_to_smart',
        'teleport_player_to_smart',
        'set_weather',
        'give_game_news',
        'give_task'
      )) AS has_uncommon
    FROM convs c
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(c.conv_json->'turns') = 'array' THEN c.conv_json->'turns' ELSE '[]'::jsonb END
    ) AS turn_obj(turn_json)
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(turn_obj.turn_json->'choices') = 'array' THEN turn_obj.turn_json->'choices' ELSE '[]'::jsonb END
    ) AS choice_obj(choice_json)
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(choice_obj.choice_json->'outcomes') = 'array' THEN choice_obj.choice_json->'outcomes' ELSE '[]'::jsonb END
    ) AS outcome_obj(outcome_json)
    GROUP BY c.id
  ),
  per_conversation AS (
    SELECT
      c.id,
      c.faction,
      c.created_at,
      greatest(coalesce(c.branch_count, 0), coalesce(ts.turn_count, 0)) AS branch_score,
      coalesce(ts.turn_count, 0) AS turn_count,
      coalesce(ts.precondition_count, 0) AS precondition_count,
      coalesce(oc.outcome_type_count, 0) AS outcome_type_count,
      coalesce(oc.has_uncommon, false) AS has_uncommon
    FROM convs c
    LEFT JOIN turn_stats ts ON ts.id = c.id
    LEFT JOIN outcome_counts oc ON oc.id = c.id
  )
  SELECT
    count(*)::INT,
    count(DISTINCT nullif(pc.faction, ''))::INT,
    coalesce(max(pc.branch_score), 0),
    coalesce(max(pc.turn_count), 0),
    coalesce(max(pc.precondition_count), 0),
    coalesce(max(pc.outcome_type_count), 0),
    coalesce(max(CASE WHEN pc.outcome_type_count >= 4 THEN pc.precondition_count ELSE 0 END), 0),
    coalesce(max(CASE WHEN pc.precondition_count >= 3 THEN pc.outcome_type_count ELSE 0 END), 0),
    coalesce(bool_or(pc.has_uncommon), false),
    coalesce(bool_or(EXTRACT(HOUR FROM (pc.created_at AT TIME ZONE 'UTC'))::INT >= 22 OR EXTRACT(HOUR FROM (pc.created_at AT TIME ZONE 'UTC'))::INT < 5), false),
    coalesce(bool_or(EXTRACT(HOUR FROM (pc.created_at AT TIME ZONE 'UTC'))::INT >= 4 AND EXTRACT(HOUR FROM (pc.created_at AT TIME ZONE 'UTC'))::INT < 7), false)
  INTO
    total_publishes,
    distinct_factions,
    max_branch_score,
    max_turn_count,
    max_precondition_count,
    max_outcome_type_count,
    max_combo_preconditions,
    max_combo_outcomes,
    has_uncommon,
    has_night_publish,
    has_dawn_publish
  FROM per_conversation pc;

  WITH convs AS (
    SELECT c.created_at
    FROM community_conversations c
    WHERE c.publisher_id = p_publisher_id
  ),
  weekend_weeks AS (
    SELECT
      date_trunc('week', created_at) AS publish_week,
      bool_or(EXTRACT(DOW FROM created_at)::INT = 6) AS has_saturday,
      bool_or(EXTRACT(DOW FROM created_at)::INT = 0) AS has_sunday
    FROM convs
    GROUP BY date_trunc('week', created_at)
  )
  SELECT EXISTS (
    SELECT 1 FROM weekend_weeks WHERE has_saturday AND has_sunday
  ) INTO has_weekend_pair;

  SELECT greatest(coalesce(s.longest_streak, 0), coalesce(s.publish_streak, 0))
  INTO longest_publish_streak
  FROM user_streaks s
  WHERE s.publisher_id = p_publisher_id;
  longest_publish_streak := coalesce(longest_publish_streak, 0);

  FOR candidate IN
    SELECT *
    FROM (VALUES
      ('first_publish', 25, total_publishes >= 1),
      ('first_patrol', 20, total_publishes >= 2),
      ('cartographer', 65, total_publishes >= 5),
      ('prolific_writer', 150, total_publishes >= 10),
      ('zone_veteran', 500, total_publishes >= 50),
      ('branching_out', 30, max_branch_score >= 5),
      ('branch_architect', 70, max_branch_score >= 8),
      ('web_of_lies', 40, max_turn_count >= 10),
      ('story_weaver', 70, max_turn_count >= 15),
      ('new_faction_scout', 35, distinct_factions >= 1),
      ('faction_diplomat', 75, distinct_factions >= 3),
      ('zone_encyclopedist', 200, distinct_factions >= 13),
      ('night_shift', 45, has_night_publish),
      ('dawn_patrol', 50, has_dawn_publish),
      ('weekend_warrior', 40, has_weekend_pair),
      ('uncommon_operator', 60, has_uncommon),
      ('outcome_engineer', 50, max_outcome_type_count >= 4),
      ('precondition_master', 50, max_precondition_count >= 5),
      ('precondition_tactician', 95, max_precondition_count >= 8),
      ('systems_polymath', 85, max_combo_outcomes >= 4 AND max_combo_preconditions >= 3),
      ('chaos_director', 180, max_branch_score >= 12 AND max_outcome_type_count >= 6),
      ('streak_3', 100, longest_publish_streak >= 3),
      ('streak_10', 500, longest_publish_streak >= 10)
    ) AS checks(achievement_id, xp, should_unlock)
  LOOP
    IF candidate.should_unlock THEN
      ach := (SELECT t FROM unlock_achievement_rewarded(p_publisher_id, candidate.achievement_id, candidate.xp) AS t);
      IF ach.was_new THEN
        v_ach_xp := v_ach_xp + ach.awarded_xp;
        unlocked := unlocked || jsonb_build_object('achievement_id', candidate.achievement_id, 'xp', ach.awarded_xp);
      END IF;
    END IF;
  END LOOP;

  RETURN QUERY SELECT p_publisher_id, v_ach_xp, unlocked;
END;
$$;

-- Re-check every known profile. Includes publish-derived achievements plus
-- metric achievements so older downloaded/upvoted work catches up too.
CREATE OR REPLACE FUNCTION recheck_all_user_achievements()
RETURNS TABLE(
  publisher_id TEXT,
  achievement_xp INT,
  newly_unlocked JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile_row RECORD;
  publish_result RECORD;
  metric_result RECORD;
BEGIN
  FOR profile_row IN
    SELECT up.publisher_id FROM user_profiles up WHERE nullif(btrim(up.publisher_id), '') IS NOT NULL
  LOOP
    publisher_id := profile_row.publisher_id;
    achievement_xp := 0;
    newly_unlocked := '[]'::jsonb;

    publish_result := (SELECT t FROM recheck_publish_achievements(profile_row.publisher_id) AS t LIMIT 1);
    IF publish_result IS NOT NULL THEN
      achievement_xp := achievement_xp + coalesce(publish_result.achievement_xp, 0);
      newly_unlocked := newly_unlocked || coalesce(publish_result.newly_unlocked, '[]'::jsonb);
    END IF;

    metric_result := (SELECT t FROM apply_metric_rewards(profile_row.publisher_id, 'both') AS t LIMIT 1);
    IF metric_result IS NOT NULL THEN
      achievement_xp := achievement_xp + coalesce(metric_result.achievement_xp, 0);
      newly_unlocked := newly_unlocked || coalesce(metric_result.newly_unlocked, '[]'::jsonb);
    END IF;

    RETURN NEXT;
  END LOOP;
END;
$$;

-- One-time historical catch-up. Safe to run repeatedly because each unlock is
-- idempotent and XP is awarded only on first insert.
DO $$
BEGIN
  PERFORM recheck_all_user_achievements();
END;
$$;

-- Record a daily login. Advances the login streak by 1 on a fresh day,
-- resets if a day was skipped. Unlocks login-streak achievements at
-- known thresholds and returns the new streak + any unlocks.
CREATE OR REPLACE FUNCTION record_daily_login(p_publisher_id TEXT)
RETURNS TABLE(
  publisher_id TEXT,
  login_streak INT,
  last_login_date TEXT,
  newly_unlocked JSONB,
  achievement_xp INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today_str TEXT := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  prev_date TEXT;
  prev_streak INT := 0;
  new_streak INT;
  v_ach_xp INT := 0;
  unlocked JSONB := '[]'::jsonb;
  ach RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.publisher_id = p_publisher_id) THEN
    RETURN;
  END IF;

  SELECT s.last_login_date, s.login_streak INTO prev_date, prev_streak
  FROM user_streaks s
  WHERE s.publisher_id = p_publisher_id;

  IF prev_date = today_str THEN
    new_streak := GREATEST(prev_streak, 1);
  ELSIF prev_date = to_char((now() AT TIME ZONE 'UTC')::date - 1, 'YYYY-MM-DD') THEN
    new_streak := COALESCE(prev_streak, 0) + 1;
  ELSE
    new_streak := 1;
  END IF;

  INSERT INTO user_streaks (publisher_id, login_streak, last_login_date)
  VALUES (p_publisher_id, new_streak, today_str)
  ON CONFLICT (publisher_id) DO UPDATE SET
    login_streak = GREATEST(user_streaks.login_streak, new_streak),
    last_login_date = today_str,
    updated_at = now();

  -- Milestone unlocks
  IF new_streak >= 1 THEN
    ach := (SELECT t FROM unlock_achievement_rewarded(p_publisher_id, 'login_streak_1', 20) AS t);
    IF ach.was_new THEN
      v_ach_xp := v_ach_xp + ach.awarded_xp;
      unlocked := unlocked || jsonb_build_object('achievement_id','login_streak_1','xp',ach.awarded_xp);
    END IF;
  END IF;
  IF new_streak >= 7 THEN
    ach := (SELECT t FROM unlock_achievement_rewarded(p_publisher_id, 'login_streak_7', 70) AS t);
    IF ach.was_new THEN
      v_ach_xp := v_ach_xp + ach.awarded_xp;
      unlocked := unlocked || jsonb_build_object('achievement_id','login_streak_7','xp',ach.awarded_xp);
    END IF;
  END IF;
  IF new_streak >= 30 THEN
    ach := (SELECT t FROM unlock_achievement_rewarded(p_publisher_id, 'login_streak_30', 260) AS t);
    IF ach.was_new THEN
      v_ach_xp := v_ach_xp + ach.awarded_xp;
      unlocked := unlocked || jsonb_build_object('achievement_id','login_streak_30','xp',ach.awarded_xp);
    END IF;
  END IF;

  RETURN QUERY
  SELECT p_publisher_id, new_streak, today_str, unlocked, v_ach_xp;
END;
$$;

-- Evaluate tier / category collection completion achievements. Given the
-- full set of achievement IDs, determines whether bronze_complete,
-- silver_complete, gold_circuit, onboarding_complete, faction_complete,
-- hidden_circuit should unlock for this user. Intended to be called after
-- every unlock event.
CREATE OR REPLACE FUNCTION apply_collection_rewards(
  p_publisher_id TEXT,
  p_bronze_ids TEXT[],
  p_silver_ids TEXT[],
  p_gold_ids TEXT[],
  p_onboarding_ids TEXT[],
  p_faction_ids TEXT[],
  p_hidden_ids TEXT[]
)
RETURNS TABLE(newly_unlocked JSONB, achievement_xp INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  owned TEXT[];
  v_ach_xp INT := 0;
  unlocked JSONB := '[]'::jsonb;
  ach RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.publisher_id = p_publisher_id) THEN
    RETURN;
  END IF;

  owned := (SELECT array_agg(ua.achievement_id) FROM user_achievements ua WHERE ua.publisher_id = p_publisher_id);
  owned := COALESCE(owned, ARRAY[]::TEXT[]);

  IF array_length(p_bronze_ids, 1) > 0 AND p_bronze_ids <@ owned THEN
    ach := (SELECT t FROM unlock_achievement_rewarded(p_publisher_id, 'bronze_complete', 120) AS t);
    IF ach.was_new THEN
      v_ach_xp := v_ach_xp + ach.awarded_xp;
      unlocked := unlocked || jsonb_build_object('achievement_id','bronze_complete','xp',ach.awarded_xp);
    END IF;
  END IF;
  IF array_length(p_silver_ids, 1) > 0 AND p_silver_ids <@ owned THEN
    ach := (SELECT t FROM unlock_achievement_rewarded(p_publisher_id, 'silver_complete', 220) AS t);
    IF ach.was_new THEN
      v_ach_xp := v_ach_xp + ach.awarded_xp;
      unlocked := unlocked || jsonb_build_object('achievement_id','silver_complete','xp',ach.awarded_xp);
    END IF;
  END IF;
  IF array_length(p_gold_ids, 1) > 0 AND p_gold_ids <@ owned THEN
    ach := (SELECT t FROM unlock_achievement_rewarded(p_publisher_id, 'gold_circuit', 500) AS t);
    IF ach.was_new THEN
      v_ach_xp := v_ach_xp + ach.awarded_xp;
      unlocked := unlocked || jsonb_build_object('achievement_id','gold_circuit','xp',ach.awarded_xp);
    END IF;
  END IF;
  IF array_length(p_onboarding_ids, 1) > 0 AND p_onboarding_ids <@ owned THEN
    ach := (SELECT t FROM unlock_achievement_rewarded(p_publisher_id, 'onboarding_complete', 140) AS t);
    IF ach.was_new THEN
      v_ach_xp := v_ach_xp + ach.awarded_xp;
      unlocked := unlocked || jsonb_build_object('achievement_id','onboarding_complete','xp',ach.awarded_xp);
    END IF;
  END IF;
  IF array_length(p_faction_ids, 1) > 0 AND p_faction_ids <@ owned THEN
    ach := (SELECT t FROM unlock_achievement_rewarded(p_publisher_id, 'faction_complete', 180) AS t);
    IF ach.was_new THEN
      v_ach_xp := v_ach_xp + ach.awarded_xp;
      unlocked := unlocked || jsonb_build_object('achievement_id','faction_complete','xp',ach.awarded_xp);
    END IF;
  END IF;
  IF array_length(p_hidden_ids, 1) > 0 AND p_hidden_ids <@ owned THEN
    ach := (SELECT t FROM unlock_achievement_rewarded(p_publisher_id, 'hidden_circuit', 300) AS t);
    IF ach.was_new THEN
      v_ach_xp := v_ach_xp + ach.awarded_xp;
      unlocked := unlocked || jsonb_build_object('achievement_id','hidden_circuit','xp',ach.awarded_xp);
    END IF;
  END IF;

  RETURN QUERY SELECT unlocked, v_ach_xp;
END;
$$;

-- Patch register_username to also unlock callsign_chosen (idempotent).
-- We keep the original semantics and append the unlock side-effect.
CREATE OR REPLACE FUNCTION register_username(p_publisher_id TEXT, p_username TEXT)
RETURNS TABLE(publisher_id TEXT, username TEXT, xp INT, level INT, title TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  clean_name TEXT := btrim(p_username);
BEGIN
  IF length(clean_name) < 3 OR length(clean_name) > 20 THEN
    RAISE EXCEPTION 'Username must be 3–20 characters.';
  END IF;
  IF clean_name !~ '^[A-Za-z0-9_\-\.]+$' THEN
    RAISE EXCEPTION 'Username may only contain letters, numbers, underscores, hyphens, and dots.';
  END IF;

  INSERT INTO user_profiles (publisher_id, username)
  VALUES (p_publisher_id, clean_name)
  ON CONFLICT ON CONSTRAINT user_profiles_pkey
  DO UPDATE SET username = clean_name, updated_at = now();

  -- Reward: callsign_chosen (idempotent, awards XP only on first unlock)
  PERFORM unlock_achievement_rewarded(p_publisher_id, 'callsign_chosen', 15);

  RETURN QUERY
  SELECT up.publisher_id, up.username, up.xp, up.level, up.title, up.created_at, up.updated_at
  FROM user_profiles up
  WHERE up.publisher_id = p_publisher_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Achievement Unlock Statistics (rarity calculation)
-- Returns per-achievement unlock counts and the percentage of registered
-- users who have unlocked each achievement.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_achievement_unlock_stats()
RETURNS TABLE(
  achievement_id TEXT,
  unlock_count   BIGINT,
  total_users    BIGINT,
  percent        NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH total AS (
    SELECT count(*)::BIGINT AS n FROM user_profiles
  )
  SELECT
    ua.achievement_id,
    count(*)::BIGINT                                       AS unlock_count,
    (SELECT n FROM total)                                  AS total_users,
    CASE
      WHEN (SELECT n FROM total) > 0
        THEN round((count(*)::NUMERIC / (SELECT n FROM total)::NUMERIC) * 100, 2)
      ELSE 0
    END                                                    AS percent
  FROM user_achievements ua
  GROUP BY ua.achievement_id
  ORDER BY ua.achievement_id;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- PASSWORD AUTH — Add password_hash column to user_profiles
-- ═══════════════════════════════════════════════════════════════════════════

-- Requires pgcrypto extension (enabled by default in Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Update register_username to optionally accept a password
CREATE OR REPLACE FUNCTION register_username(
  p_publisher_id TEXT,
  p_username     TEXT,
  p_password     TEXT DEFAULT NULL
)
RETURNS TABLE(publisher_id TEXT, username TEXT, xp INT, level INT, title TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  clean_name TEXT := btrim(p_username);
  pw_hash    TEXT := NULL;
BEGIN
  IF length(clean_name) < 3 OR length(clean_name) > 20 THEN
    RAISE EXCEPTION 'Username must be 3–20 characters.';
  END IF;
  IF clean_name !~ '^[A-Za-z0-9_\-\.]+$' THEN
    RAISE EXCEPTION 'Username may only contain letters, numbers, underscores, hyphens, and dots.';
  END IF;

  -- Hash the password if provided and at least 6 chars
  IF p_password IS NOT NULL AND length(btrim(p_password)) >= 6 THEN
    pw_hash := crypt(btrim(p_password), gen_salt('bf', 10));
  END IF;

  INSERT INTO user_profiles (publisher_id, username, password_hash)
  VALUES (p_publisher_id, clean_name, pw_hash)
  ON CONFLICT ON CONSTRAINT user_profiles_pkey
  DO UPDATE SET
    username      = clean_name,
    password_hash = COALESCE(
      CASE WHEN pw_hash IS NOT NULL THEN pw_hash ELSE NULL END,
      user_profiles.password_hash
    ),
    updated_at    = now();

  PERFORM unlock_achievement_rewarded(p_publisher_id, 'callsign_chosen', 15);

  RETURN QUERY
  SELECT up.publisher_id, up.username, up.xp, up.level, up.title, up.created_at, up.updated_at
  FROM user_profiles up
  WHERE up.publisher_id = p_publisher_id;
END;
$$;

-- Login with username + password → returns profile or empty if credentials wrong
CREATE OR REPLACE FUNCTION login_user(p_username TEXT, p_password TEXT)
RETURNS TABLE(publisher_id TEXT, username TEXT, xp INT, level INT, title TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT up.publisher_id, up.username, up.xp, up.level, up.title, up.created_at, up.updated_at
  FROM user_profiles up
  WHERE lower(up.username) = lower(btrim(p_username))
    AND up.password_hash IS NOT NULL
    AND up.password_hash = crypt(btrim(p_password), up.password_hash);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROADMAP
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS roadmap_items (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  status      TEXT        NOT NULL DEFAULT 'planned'
                          CHECK (status IN ('development','planned','considering','completed','dropped')),
  category    TEXT        NOT NULL DEFAULT 'feature'
                          CHECK (category IN ('feature','improvement','community','bug')),
  priority    INT         NOT NULL DEFAULT 0,
  upvotes     INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roadmap_status    ON roadmap_items (status);
CREATE INDEX IF NOT EXISTS idx_roadmap_priority  ON roadmap_items (priority DESC);
CREATE INDEX IF NOT EXISTS idx_roadmap_created   ON roadmap_items (created_at DESC);

-- Track which publisher_ids upvoted which items (prevents duplicate votes)
CREATE TABLE IF NOT EXISTS roadmap_upvotes (
  item_id      UUID  NOT NULL REFERENCES roadmap_items(id) ON DELETE CASCADE,
  publisher_id TEXT  NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, publisher_id)
);

CREATE INDEX IF NOT EXISTS idx_roadmap_upvotes_item ON roadmap_upvotes (item_id);

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER roadmap_items_updated_at
  BEFORE UPDATE ON roadmap_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- RLS: public read, no direct write (admin writes via server-side API)
ALTER TABLE roadmap_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_upvotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS roadmap_items_select  ON roadmap_items;
CREATE POLICY roadmap_items_select
  ON roadmap_items FOR SELECT USING (true);

DROP POLICY IF EXISTS roadmap_upvotes_select ON roadmap_upvotes;
CREATE POLICY roadmap_upvotes_select
  ON roadmap_upvotes FOR SELECT USING (true);

-- Allow admin to write roadmap items via direct Supabase fallback
DROP POLICY IF EXISTS roadmap_items_insert ON roadmap_items;
CREATE POLICY roadmap_items_insert
  ON roadmap_items FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS roadmap_items_update ON roadmap_items;
CREATE POLICY roadmap_items_update
  ON roadmap_items FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS roadmap_items_delete ON roadmap_items;
CREATE POLICY roadmap_items_delete
  ON roadmap_items FOR DELETE USING (true);

-- Allow inserts into roadmap_upvotes (for upvoting)
DROP POLICY IF EXISTS roadmap_upvotes_insert ON roadmap_upvotes;
CREATE POLICY roadmap_upvotes_insert
  ON roadmap_upvotes FOR INSERT WITH CHECK (true);

-- Function: increment upvotes atomically (safe for concurrent calls)
CREATE OR REPLACE FUNCTION increment_roadmap_upvote(p_item_id UUID, p_publisher_id TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Record the upvote (idempotent via ON CONFLICT DO NOTHING)
  IF p_publisher_id IS NOT NULL AND p_publisher_id <> '' THEN
    INSERT INTO roadmap_upvotes (item_id, publisher_id)
    VALUES (p_item_id, p_publisher_id)
    ON CONFLICT DO NOTHING;
    -- Only increment if the insert was new (i.e., not a duplicate)
    IF FOUND THEN
      UPDATE roadmap_items SET upvotes = upvotes + 1, updated_at = now() WHERE id = p_item_id;
    END IF;
  ELSE
    -- Anonymous upvote: just increment (best-effort, no dedup)
    UPDATE roadmap_items SET upvotes = upvotes + 1, updated_at = now() WHERE id = p_item_id;
  END IF;
END;
$$;
