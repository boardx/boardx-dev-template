-- 014_feedback.sql — CAP-WEB 用户反馈提交记录

CREATE TABLE IF NOT EXISTS feedback_submissions (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message     text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  user_agent  text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_submissions_user ON feedback_submissions(user_id, created_at DESC);
