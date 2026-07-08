-- 031_board_backups.sql — CAP-DATA 白板备份（p7 F08，uc-board-header-007）
-- 备份 = 某一时刻 board_items 的 jsonb 快照数组；恢复 = 事务内整板替换。
-- id 用 bigint identity，对齐本库既有惯例（boards/users 等均无 uuid PK）。

CREATE TABLE IF NOT EXISTS board_backups (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  board_id   bigint NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  label      text NOT NULL,
  snapshot   jsonb NOT NULL,          -- items 快照数组（BoardItemRow[]）
  created_by bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_board_backups_board ON board_backups(board_id, created_at DESC);
