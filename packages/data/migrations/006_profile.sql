-- 006_profile.sql — CAP-AUTH 账号中心：用户资料字段 + 偏好设置

ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar text;

CREATE TABLE IF NOT EXISTS user_settings (
  user_id         bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  ai_model        text NOT NULL DEFAULT 'claude-opus-4-8',
  default_privacy text NOT NULL DEFAULT 'private',     -- private | team
  updated_at      timestamptz NOT NULL DEFAULT now()
);
