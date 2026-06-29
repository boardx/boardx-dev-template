-- 007_board.sql — CAP-DATA 白板容器（P5）：boards
-- Board = 房间内的一块白板（容器/生命周期，非画布编辑）。一个 room 可有多个 board。
-- visibility: room（房间成员可见，默认）| team（团队可见）| public（公开链接可见）。

CREATE TABLE IF NOT EXISTS boards (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id       bigint NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  team_id       bigint REFERENCES teams(id) ON DELETE SET NULL,   -- 随所属 room 的团队（个人 room 为 NULL）
  name          text NOT NULL,
  cover         text,
  category      text,
  description   text,
  visibility    text NOT NULL DEFAULT 'room',
  owner_user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_boards_room ON boards(room_id);
CREATE INDEX IF NOT EXISTS idx_boards_team ON boards(team_id);
CREATE INDEX IF NOT EXISTS idx_boards_owner ON boards(owner_user_id);
