-- 020_ava_message_feedback.sql — P9 F11 消息反馈（点赞/点踩）
-- ava_message_feedback = 用户对某条 assistant 消息提交的反馈，一人一条（对同一条消息可改主意，
-- upsert 覆盖），rating 为 up/down。仅反馈 assistant 消息（user 消息没有反馈入口，路由层把关）。
CREATE TABLE IF NOT EXISTS ava_message_feedback (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message_id  bigint NOT NULL REFERENCES ava_messages(id) ON DELETE CASCADE,
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating      text   NOT NULL CHECK (rating IN ('up', 'down')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_ava_message_feedback_message ON ava_message_feedback(message_id);
