-- 040_ai_store_skills_versioning.sql — P27 F02
-- Merge legacy text/image tool types into Skill and add optimistic versioning.

ALTER TABLE ai_store_items
  DROP CONSTRAINT IF EXISTS ai_store_items_type_check;

ALTER TABLE ai_store_items
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

UPDATE ai_store_items
SET
  config = jsonb_set(
    COALESCE(config, '{}'::jsonb),
    '{skillKind}',
    to_jsonb(
      CASE
        WHEN type IN ('ai-tool', 'AI_TOOL') THEN 'text'
        WHEN type IN ('image-tool', 'AI_IMAGE_TOOL') THEN 'image'
      END
    ),
    true
  ),
  type = 'skill'
WHERE type IN ('ai-tool', 'AI_TOOL', 'image-tool', 'AI_IMAGE_TOOL');

ALTER TABLE ai_store_items
  ADD CONSTRAINT ai_store_items_type_check
  CHECK (type IN ('agent', 'skill', 'template'));

CREATE TABLE IF NOT EXISTS ai_store_revision_audit (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id        bigint NOT NULL REFERENCES ai_store_items(id) ON DELETE CASCADE,
  version        integer NOT NULL,
  action         text NOT NULL,
  actor_user_id  bigint REFERENCES users(id) ON DELETE SET NULL,
  actor_team_id  bigint REFERENCES teams(id) ON DELETE SET NULL,
  changed_fields text[] NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_store_revision_audit_item
  ON ai_store_revision_audit(item_id, version DESC, created_at DESC);
