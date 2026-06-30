-- 014_room_chat_messages.sql — CAP-DATA 房间聊天消息体（P9 uc-room-chat-003）
-- 在 room_chats 线程内追加用户/AVA 消息。room_id 冗余便于按房间上下文检索。
CREATE TABLE IF NOT EXISTS room_chat_messages (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chat_id         bigint NOT NULL REFERENCES room_chats(id) ON DELETE CASCADE,
  room_id         bigint NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  role            text   NOT NULL CHECK (role IN ('user', 'assistant')),
  content         text   NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_room_chat_messages_chat ON room_chat_messages(chat_id, id);
