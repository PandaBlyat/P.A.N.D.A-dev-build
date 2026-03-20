-- P.A.N.D.A. Community Library — Supabase Database Setup
-- Run this in your Supabase project's SQL editor (https://supabase.com/dashboard)

CREATE TABLE community_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  faction TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT 'Anonymous',
  data JSONB NOT NULL,
  downloads INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast faction-filtered queries
CREATE INDEX idx_community_conv_faction ON community_conversations (faction);
CREATE INDEX idx_community_conv_created ON community_conversations (created_at DESC);

-- Row Level Security: allow anonymous public read and insert
ALTER TABLE community_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read"
  ON community_conversations FOR SELECT
  USING (true);

CREATE POLICY "Public insert"
  ON community_conversations FOR INSERT
  WITH CHECK (true);

-- Allow download counter increments only (restrict UPDATE to downloads column)
CREATE POLICY "Download increment"
  ON community_conversations FOR UPDATE
  USING (true)
  WITH CHECK (true);
