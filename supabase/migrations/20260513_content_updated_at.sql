ALTER TABLE public.community_conversations
  ADD COLUMN IF NOT EXISTS content_updated_at TIMESTAMPTZ;

UPDATE public.community_conversations
SET content_updated_at = coalesce(content_updated_at, created_at, updated_at, now());

ALTER TABLE public.community_conversations
  ALTER COLUMN content_updated_at SET DEFAULT now(),
  ALTER COLUMN content_updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_community_conv_content_updated
  ON public.community_conversations (content_updated_at DESC);
