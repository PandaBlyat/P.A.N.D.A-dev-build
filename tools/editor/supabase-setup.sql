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
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
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
  ADD COLUMN IF NOT EXISTS tags JSONB,
  ADD COLUMN IF NOT EXISTS branch_count INT,
  ADD COLUMN IF NOT EXISTS complexity TEXT,
  ADD COLUMN IF NOT EXISTS upvotes INT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE community_conversations
  ALTER COLUMN label SET DEFAULT '',
  ALTER COLUMN description SET DEFAULT '',
  ALTER COLUMN summary SET DEFAULT '',
  ALTER COLUMN author SET DEFAULT 'Anonymous',
  ALTER COLUMN tags SET DEFAULT '[]'::jsonb,
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
  tags = coalesce(tags, '[]'::jsonb),
  downloads = coalesce(downloads, 0),
  upvotes = coalesce(upvotes, 0),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, created_at, now());

ALTER TABLE community_conversations
  ALTER COLUMN label SET NOT NULL,
  ALTER COLUMN description SET NOT NULL,
  ALTER COLUMN summary SET NOT NULL,
  ALTER COLUMN author SET NOT NULL,
  ALTER COLUMN tags SET NOT NULL,
  ALTER COLUMN data SET NOT NULL,
  ALTER COLUMN downloads SET NOT NULL,
  ALTER COLUMN upvotes SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_community_conv_faction ON community_conversations (faction);
CREATE INDEX IF NOT EXISTS idx_community_conv_created ON community_conversations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_conv_updated ON community_conversations (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_conv_publisher_id ON community_conversations (publisher_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_community_conv_label_unique ON community_conversations (lower(label));

CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
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
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

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
  ON CONFLICT (publisher_id)
  DO UPDATE SET username = clean_name, updated_at = now();

  RETURN QUERY
  SELECT up.publisher_id, up.username, up.xp, up.level, up.title, up.created_at, up.updated_at
  FROM user_profiles up
  WHERE up.publisher_id = p_publisher_id;
END;
$$;

CREATE OR REPLACE FUNCTION get_user_profile(p_publisher_id TEXT)
RETURNS TABLE(publisher_id TEXT, username TEXT, xp INT, level INT, title TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT up.publisher_id, up.username, up.xp, up.level, up.title, up.created_at, up.updated_at
  FROM user_profiles up
  WHERE up.publisher_id = p_publisher_id
  LIMIT 1;
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

  SELECT * INTO computed FROM compute_level_and_title(new_xp);

  UPDATE user_profiles
  SET level = computed.new_level, title = computed.new_title
  WHERE user_profiles.publisher_id = p_publisher_id;

  RETURN QUERY
  SELECT up.publisher_id, up.username, up.xp, up.level, up.title, up.created_at, up.updated_at
  FROM user_profiles up
  WHERE up.publisher_id = p_publisher_id;
END;
$$;

CREATE OR REPLACE FUNCTION get_leaderboard(p_limit INT DEFAULT 10)
RETURNS TABLE(username TEXT, xp INT, level INT, title TEXT)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT username, xp, level, title
  FROM user_profiles
  WHERE xp > 0
  ORDER BY xp DESC, created_at ASC
  LIMIT p_limit;
$$;
