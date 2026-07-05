-- 029_email_confirmation.sql — uc-auth-005 确认邮箱（P21 F03）
-- confirm-email 此前是硬编码 Set(["demo"]) 的内存桩，从未真正更新任何账号状态。
-- 补一个真实的、可被查询/展示的落地点：users.email_confirmed_at。
-- NULL = 未确认；非 NULL = 确认邮箱这条 email_tokens(type='confirm_email') 记录被消费的时间。
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz;

-- 附带加固（P21 F03 notes）：login/forgot-password 最小速率限制。
-- forgot-password 已有 email_tokens 表可直接按 (user_id, type, created_at) 计数，不需要新表。
-- login 没有对应的落库点（失败不发邮件、不建 token），补一张极简的尝试记录表，
-- 只记 key（这里用归一化后的邮箱）+ kind + 时间，与 outbound_emails 的"按时间窗口计数"
-- 思路一致，不引入 Redis/内存 Map 等新基础设施。
CREATE TABLE IF NOT EXISTS auth_rate_limit_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rate_key    text NOT NULL,                       -- 归一化邮箱等限流维度
  kind        text NOT NULL,                       -- login_attempt | ...
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_rate_limit_events_key_kind_time
  ON auth_rate_limit_events(rate_key, kind, created_at);
