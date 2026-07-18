-- 041_ai_store_authoring_archive.sql — P27 F04
-- Archive resources without destroying subscriptions, grants, or revision history.

ALTER TABLE ai_store_items
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ai_store_items_active
  ON ai_store_items(origin_team_id, updated_at DESC)
  WHERE migration_quarantined_at IS NULL AND archived_at IS NULL;
