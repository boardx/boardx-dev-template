-- 002_auth.sql — CAP-AUTH：用户、会话、邮箱令牌
-- schema 只经 migrations 改。

CREATE TABLE IF NOT EXISTS users (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  password_hash text,                              -- 第三方账号可为 NULL（无邮箱密码）
  first_name    text NOT NULL DEFAULT '',
  last_name     text NOT NULL DEFAULT '',
  provider      text NOT NULL DEFAULT 'email',     -- email | google | facebook | wechat
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id          text PRIMARY KEY,                    -- 会话 id（放进 httpOnly cookie）
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS email_tokens (
  token       text PRIMARY KEY,                    -- 一次性令牌（重置密码/确认邮箱）
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        text NOT NULL,                       -- reset_password | confirm_email
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,                         -- 已使用则非空（一次性）
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_tokens(user_id);
