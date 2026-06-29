-- 008_board_visits.sql — CAP-DATA 最近访问白板（P5 F03）
-- 每用户每白板一行，记录最近一次访问时间，用于「最近访问」排序。
CREATE TABLE IF NOT EXISTS board_visits (
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  board_id   bigint NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  visited_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, board_id)
);
CREATE INDEX IF NOT EXISTS idx_board_visits_user_time ON board_visits(user_id, visited_at DESC);
