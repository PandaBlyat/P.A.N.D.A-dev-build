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
