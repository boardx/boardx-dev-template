-- 016_ava_chat.sql — CAP-DATA AVA 聊天线程与消息（P9 uc-ava-001）
-- ava_threads = 用户在 AVA 助手内的独立聊天线程（按 team_id/user_id 组织，team_id 可空 —
-- 用户未加入/未选中团队时线程为个人上下文）。
-- ava_messages = 线程内消息体（user/assistant），status 记录 assistant 消息的生成态，
-- 用于流式生成失败时保留失败态而不丢用户输入。
CREATE TABLE IF NOT EXISTS ava_threads (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id    bigint REFERENCES teams(id) ON DELETE SET NULL,
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ava_threads_user ON ava_threads(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ava_threads_team ON ava_threads(team_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ava_messages (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  thread_id   bigint NOT NULL REFERENCES ava_threads(id) ON DELETE CASCADE,
  role        text   NOT NULL CHECK (role IN ('user', 'assistant')),
  content     text   NOT NULL,
  status      text   NOT NULL DEFAULT 'complete' CHECK (status IN ('complete', 'failed')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ava_messages_thread ON ava_messages(thread_id, id);
