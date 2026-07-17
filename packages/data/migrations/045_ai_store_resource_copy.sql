-- P27 F10: independent copies retain provenance but no live relationship state.
ALTER TABLE ai_store_items
  ADD COLUMN IF NOT EXISTS allow_copy boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS copied_from_item_id bigint REFERENCES ai_store_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS copied_from_version integer;

CREATE INDEX IF NOT EXISTS idx_ai_store_items_copied_from
  ON ai_store_items(copied_from_item_id)
  WHERE copied_from_item_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ai_store_copy_requests (
  source_item_id   bigint NOT NULL REFERENCES ai_store_items(id) ON DELETE CASCADE,
  consumer_team_id bigint NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id          bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key  text NOT NULL,
  copied_item_id   bigint NOT NULL REFERENCES ai_store_items(id) ON DELETE CASCADE,
  copied_board_id  bigint REFERENCES boards(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_item_id, consumer_team_id, user_id, idempotency_key)
);
