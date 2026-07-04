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

/**
 * 频控（p18 F11 硬前置，PR #321 review 登记）：某收件人 + 某类邮件在最近 windowMs 内
 * 已发出的邮件数。查真实落库表 outbound_emails（不引入 Redis/内存 Map 等新基础设施），
 * 调用方按业务口径设阈值（例如「同一分钟最多 1 封」→ N=1, windowMs=60_000）。
 */
export async function countRecentOutboundEmails(
  toEmail: string,
  kind: string,
  windowMs: number
): Promise<number> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM outbound_emails
     WHERE to_email = $1 AND kind = $2 AND created_at > now() - ($3 || ' milliseconds')::interval`,
    [toEmail, kind, String(windowMs)]
  );
  return Number(rows[0]?.count ?? 0);
}
