-- AI Store engagement belongs to the consumer Team context.
ALTER TABLE ai_store_favorites
  ADD COLUMN IF NOT EXISTS consumer_team_id bigint REFERENCES teams(id) ON DELETE CASCADE;

-- Legacy favorites have no trustworthy Team provenance. Remove only those detail rows and
-- subtract their contribution from the cached aggregate instead of guessing a Team.
WITH removed AS (
  DELETE FROM ai_store_favorites
  WHERE consumer_team_id IS NULL
  RETURNING item_id
), counts AS (
  SELECT item_id, count(*)::int AS amount
  FROM removed
  GROUP BY item_id
)
UPDATE ai_store_items AS item
SET likes = GREATEST(0, item.likes - counts.amount)
FROM counts
WHERE item.id = counts.item_id;

ALTER TABLE ai_store_favorites
  ALTER COLUMN consumer_team_id SET NOT NULL;

ALTER TABLE ai_store_favorites
  DROP CONSTRAINT IF EXISTS ai_store_favorites_pkey;

ALTER TABLE ai_store_favorites
  ADD CONSTRAINT ai_store_favorites_pkey PRIMARY KEY (user_id, consumer_team_id, item_id);

CREATE INDEX IF NOT EXISTS idx_ai_store_favorites_user_team
  ON ai_store_favorites(user_id, consumer_team_id, created_at DESC);
