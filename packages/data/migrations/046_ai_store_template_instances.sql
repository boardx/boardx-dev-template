CREATE TABLE IF NOT EXISTS ai_store_template_instances (
  template_item_id bigint NOT NULL REFERENCES ai_store_items(id) ON DELETE CASCADE,
  consumer_team_id bigint NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  board_id bigint NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (template_item_id, consumer_team_id, user_id, idempotency_key)
);
