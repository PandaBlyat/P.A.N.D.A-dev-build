-- P.A.N.D.A. Community Library — Supabase Database Setup
-- Run this in your Supabase project's SQL editor (https://supabase.com/dashboard)
-- If PostgREST reports that branch_count or complexity is missing from the schema cache after applying this,
-- verify you ran the migration against the same project your app points at and refresh the Supabase API schema cache.

CREATE TABLE community_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  faction TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT 'Anonymous',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  branch_count INT,
  complexity TEXT,
  data JSONB NOT NULL,
  downloads INT NOT NULL DEFAULT 0,
  upvotes INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_community_conv_faction ON community_conversations (faction);
CREATE INDEX idx_community_conv_created ON community_conversations (created_at DESC);
CREATE INDEX idx_community_conv_updated ON community_conversations (updated_at DESC);
CREATE UNIQUE INDEX idx_community_conv_label_unique ON community_conversations (lower(label));

CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_community_conversations_updated_at
BEFORE UPDATE ON community_conversations
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

ALTER TABLE community_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read"
  ON community_conversations FOR SELECT
  USING (true);

CREATE POLICY "Public insert"
  ON community_conversations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Metadata counters"
  ON community_conversations FOR UPDATE
  USING (true)
  WITH CHECK (true);

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

CREATE TABLE creator_support_metrics (
  id TEXT PRIMARY KEY CHECK (id = 'global'),
  upvotes INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO creator_support_metrics (id)
VALUES ('global')
ON CONFLICT (id) DO NOTHING;

CREATE TRIGGER trg_creator_support_metrics_updated_at
BEFORE UPDATE ON creator_support_metrics
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

ALTER TABLE creator_support_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public support read"
  ON creator_support_metrics FOR SELECT
  USING (true);

CREATE POLICY "Support metric insert"
  ON creator_support_metrics FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Support metric update"
  ON creator_support_metrics FOR UPDATE
  USING (true)
  WITH CHECK (true);

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

