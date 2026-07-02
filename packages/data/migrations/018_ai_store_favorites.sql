-- 018_ai_store_favorites.sql — CAP-DATA AI Store 项目喜欢/收藏（P11 F04），每用户独立。
-- 与 board_favorites 同构：复合主键 (user_id, item_id)，删除项目/用户级联清理。
CREATE TABLE IF NOT EXISTS ai_store_favorites (
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id    bigint NOT NULL REFERENCES ai_store_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_store_favorites_item ON ai_store_favorites(item_id);
