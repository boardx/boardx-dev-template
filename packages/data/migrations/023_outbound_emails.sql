-- 023_outbound_emails.sql — CAP-DATA：出站邮件本地 sink（dev 邮件捕捉桩，p18 F08）
-- 与 auth 的邮件能力同一底层口径：dev 环境邮件不真正走 SMTP，而是落库 + 打日志，
-- e2e 通过 /api/dev/outbox 断言"真实发信请求已发出且内容含分享链接"。
-- 将来接真实 provider（SMTP/Resend）时，本表退化为发送审计日志。

CREATE TABLE IF NOT EXISTS outbound_emails (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  to_email   text NOT NULL,
  kind       text NOT NULL,               -- ava_share_link | reset_password | ...
  subject    text NOT NULL DEFAULT '',
  body       text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outbound_emails_to ON outbound_emails(to_email, kind, created_at DESC);
