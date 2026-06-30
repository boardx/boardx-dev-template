-- 009_board_favorites.sql — CAP-DATA 收藏白板（P5 F04），每用户独立。
CREATE TABLE IF NOT EXISTS board_favorites (
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  board_id   bigint NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, board_id)
);
CREATE INDEX IF NOT EXISTS idx_board_favorites_user ON board_favorites(user_id, created_at DESC);
