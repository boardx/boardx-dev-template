// packages/data/src/auth.ts — CAP-AUTH 仓储（users / sessions / email_tokens）
// 只暴露仓储函数；调用方不碰裸 SQL。

import { query } from "./index";

export interface User {
  id: number;
  email: string;
  password_hash: string | null;
  first_name: string;
  last_name: string;
  provider: string;
  created_at: string;
  plan_id?: "free" | "pro";
  display_name?: string | null;
  avatar?: string | null;
  platform_role?: string;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string | null;
  firstName: string;
  lastName: string;
  provider?: string;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const rows = await query<User>(
    `INSERT INTO users (email, password_hash, first_name, last_name, provider)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, password_hash, first_name, last_name, provider, created_at, plan_id`,
    [input.email, input.passwordHash, input.firstName, input.lastName, input.provider ?? "email"]
  );
  return rows[0]!;
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const rows = await query<User>(
    `SELECT id, email, password_hash, first_name, last_name, provider, created_at, plan_id
     FROM users WHERE email = $1`,
    [email]
  );
  return rows[0];
}

export async function getUserById(id: number): Promise<User | undefined> {
  const rows = await query<User>(
    `SELECT id, email, password_hash, first_name, last_name, provider, created_at, plan_id
     FROM users WHERE id = $1`,
    [id]
  );
  return rows[0];
}

export async function updateUserPlan(userId: number, planId: "free" | "pro"): Promise<User | undefined> {
  const rows = await query<User>(
    `UPDATE users SET plan_id = $2 WHERE id = $1
     RETURNING id, email, password_hash, first_name, last_name, provider, created_at, plan_id`,
    [userId, planId]
  );
  return rows[0];
}

export async function updateUserPassword(userId: number, passwordHash: string): Promise<void> {
  await query("UPDATE users SET password_hash = $2 WHERE id = $1", [userId, passwordHash]);
}

/** 仅供 dev/测试：把用户提升为平台 SysAdmin（P15 Admin 门控 e2e 用）。 */
export async function setPlatformRole(userId: number, role: string): Promise<void> {
  await query("UPDATE users SET platform_role = $2 WHERE id = $1", [userId, role]);
}

// ─── sessions ────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  user_id: number;
  expires_at: string;
}

export async function createSession(id: string, userId: number, expiresAt: Date): Promise<void> {
  await query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)", [id, userId, expiresAt]);
}

/** 取未过期会话对应的用户（联表，单查）。 */
export async function getSessionUser(sessionId: string): Promise<User | undefined> {
  const rows = await query<User>(
    `SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, u.provider, u.created_at,
            u.display_name, u.avatar, u.platform_role, u.plan_id
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > now()`,
    [sessionId]
  );
  return rows[0];
}

export async function deleteSession(sessionId: string): Promise<void> {
  await query("DELETE FROM sessions WHERE id = $1", [sessionId]);
}

/** 密码变更后失效该用户全部会话。 */
export async function deleteUserSessions(userId: number): Promise<void> {
  await query("DELETE FROM sessions WHERE user_id = $1", [userId]);
}

// ─── email_tokens（一次性、可过期）────────────────────────────────────────────

export interface EmailToken {
  token: string;
  user_id: number;
  type: string;
  expires_at: string;
  consumed_at: string | null;
}

export async function createEmailToken(
  token: string,
  userId: number,
  type: string,
  expiresAt: Date
): Promise<void> {
  await query("INSERT INTO email_tokens (token, user_id, type, expires_at) VALUES ($1, $2, $3, $4)", [
    token,
    userId,
    type,
    expiresAt,
  ]);
}

/** 取有效（未消费、未过期）令牌。 */
export async function getValidEmailToken(token: string, type: string): Promise<EmailToken | undefined> {
  const rows = await query<EmailToken>(
    `SELECT token, user_id, type, expires_at, consumed_at FROM email_tokens
     WHERE token = $1 AND type = $2 AND consumed_at IS NULL AND expires_at > now()`,
    [token, type]
  );
  return rows[0];
}

export async function consumeEmailToken(token: string): Promise<void> {
  await query("UPDATE email_tokens SET consumed_at = now() WHERE token = $1", [token]);
}

/** 仅供 dev/测试：按邮箱取最新有效令牌（e2e 用，绝不在生产暴露）。 */
export async function getLatestTokenByEmail(
  email: string,
  type: string
): Promise<EmailToken | undefined> {
  const rows = await query<EmailToken>(
    `SELECT t.token, t.user_id, t.type, t.expires_at, t.consumed_at
     FROM email_tokens t JOIN users u ON u.id = t.user_id
     WHERE u.email = $1 AND t.type = $2 AND t.consumed_at IS NULL AND t.expires_at > now()
     ORDER BY t.created_at DESC LIMIT 1`,
    [email, type]
  );
  return rows[0];
}
