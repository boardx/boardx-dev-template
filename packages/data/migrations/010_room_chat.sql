-- 010_room_chat.sql — CAP-DATA 房间聊天线程（P4）
-- room_chats = 房间内与 AVA 的聊天线程容器。消息体（messages）随 p9 AVA 运行时接入。
-- 注：本期线程创建即持久化（虚拟线程until首条消息的优化随 p9 发消息再做）。
CREATE TABLE IF NOT EXISTS room_chats (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id         bigint NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  team_id         bigint REFERENCES teams(id) ON DELETE SET NULL,
  name            text NOT NULL,
  creator_user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_room_chats_room ON room_chats(room_id, updated_at DESC);
