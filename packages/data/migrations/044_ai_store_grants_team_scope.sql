-- Management grants are accepted into one receiving Team and never become global user grants.
ALTER TABLE ai_store_item_grants
  ADD COLUMN IF NOT EXISTS consumer_team_id bigint REFERENCES teams(id) ON DELETE CASCADE;

-- Legacy grants do not contain trustworthy receiving-Team provenance.
DELETE FROM ai_store_item_grants WHERE consumer_team_id IS NULL;

ALTER TABLE ai_store_item_grants
  ALTER COLUMN consumer_team_id SET NOT NULL;

ALTER TABLE ai_store_item_grants
  DROP CONSTRAINT IF EXISTS ai_store_item_grants_pkey;

ALTER TABLE ai_store_item_grants
  ADD CONSTRAINT ai_store_item_grants_pkey PRIMARY KEY (item_id, user_id, consumer_team_id);

DROP INDEX IF EXISTS idx_ai_store_item_grants_user;
CREATE INDEX idx_ai_store_item_grants_user_team
  ON ai_store_item_grants(user_id, consumer_team_id, created_at DESC);
