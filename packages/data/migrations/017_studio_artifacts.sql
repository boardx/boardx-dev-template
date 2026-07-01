-- 017_studio_artifacts.sql — CAP-AI Studio 生成制品（p12-F01 地基）
-- Studio 面板生成的音频概览/信息图/演示文稿制品，关联房间聊天线程，结果作为消息卡片
-- 出现在聊天中。status 由 API 入队后单向推进（queued → processing → ready/error），
-- worker 异步回写，前端轮询查看进度。

CREATE TABLE IF NOT EXISTS studio_artifacts (
  id              text PRIMARY KEY,
  room_id         bigint NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  chat_id         bigint NOT NULL REFERENCES room_chats(id) ON DELETE CASCADE,
  creator_user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            text NOT NULL CHECK (type IN ('audio', 'infographic', 'presentation')),
  source          text NOT NULL CHECK (source IN ('room_files', 'current_chat')),
  prompt          text NOT NULL DEFAULT '',
  status          text NOT NULL DEFAULT 'queued', -- queued | processing | ready | error
  object_key      text,                            -- 对象存储 key（ready 后才有值，见 @repo/storage）
  title           text,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_studio_artifacts_chat ON studio_artifacts(chat_id, id);
CREATE INDEX IF NOT EXISTS idx_studio_artifacts_room ON studio_artifacts(room_id);
