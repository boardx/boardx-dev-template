// packages/data/src/mailbox.ts — 出站邮件本地 sink（dev 邮件捕捉桩，p18 F08）
// 与 email_tokens 同一套"dev 邮件"口径：邮件内容落库，e2e 经 dev-only 端点断言。
import { query } from "./index";

export interface OutboundEmail {
  id: number;
  to_email: string;
  kind: string;
  subject: string;
  body: string;
  created_at: string;
}

/** 记录一封已"发出"的邮件（dev transport 的落库部分）。 */
export async function recordOutboundEmail(
  toEmail: string,
  kind: string,
  subject: string,
  body: string
): Promise<OutboundEmail> {
  const rows = await query<OutboundEmail>(
    `INSERT INTO outbound_emails (to_email, kind, subject, body)
     VALUES ($1, $2, $3, $4)
     RETURNING id, to_email, kind, subject, body, created_at`,
    [toEmail, kind, subject, body]
  );
  return rows[0]!;
}

/** 仅供 dev/测试：取某收件人最新一封某类型邮件（e2e 断言用，绝不在生产暴露）。 */
export async function getLatestOutboundEmail(
  toEmail: string,
  kind: string
): Promise<OutboundEmail | undefined> {
  const rows = await query<OutboundEmail>(
    `SELECT id, to_email, kind, subject, body, created_at FROM outbound_emails
     WHERE to_email = $1 AND kind = $2
     ORDER BY created_at DESC, id DESC LIMIT 1`,
    [toEmail, kind]
  );
  return rows[0];
}
