-- 018_ava_thread_share.sql — P9 F04 AVA thread public share links
ALTER TABLE ava_threads
  ADD COLUMN IF NOT EXISTS share_token text,
  ADD COLUMN IF NOT EXISTS share_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_updated_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ava_threads_share_token
  ON ava_threads(share_token)
  WHERE share_token IS NOT NULL;
