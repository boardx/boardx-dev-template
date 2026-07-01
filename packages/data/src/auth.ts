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
     RETURNING id, email, password_hash, first_name, last_name, provider, created_at`,
    [input.email, input.passwordHash, input.firstName, input.lastName, input.provider ?? "email"]
  );
  return rows[0]!;
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const rows = await query<User>(
    "SELECT id, email, password_hash, first_name, last_name, provider, created_at FROM users WHERE email = $1",
    [email]
  );
  return rows[0];
}

export async function getUserById(id: number): Promise<User | undefined> {
  const rows = await query<User>(
    // platform_role 必须选出来：P15 F02 review 加固（自我降级/最后一个 SysAdmin 校验）依赖
    // user.platform_role 判断目标当前是不是 sysadmin，此前这里漏选导致 platform_role 恒为
    // undefined、guard 从未真正触发（isSysAdmin(undefined) 恒 false）。
    "SELECT id, email, password_hash, first_name, last_name, provider, created_at, platform_role FROM users WHERE id = $1",
    [id]
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

// ─── P15 Admin 后台：用户管理（F02）──────────────────────────────────────────
// 列表/搜索/分页/增删改 + 手动上分（uc-admin-001）。真实 DB，复用 users 表 + credit_wallets（personal scope）。

export interface AdminUserRow {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  platform_role: string;
  team_count: number;
  credit_balance: number;
  created_at: string;
}

export interface ListAdminUsersInput {
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface ListAdminUsersResult {
  users: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 后台用户列表：邮箱/姓名/平台角色/团队数/个人 Credit 余额（真实聚合）。
 * team_count 来自 team_members 计数；credit_balance 来自该用户的 credit_wallets（无钱包则 0，
 * 不隐式创建——只有手动上分时才会 getOrCreatePersonalWallet）。q 同时匹配邮箱/姓名（不区分大小写）。
 */
export async function listAdminUsers(input: ListAdminUsersInput = {}): Promise<ListAdminUsersResult> {
  const q = (input.q ?? "").trim();
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 10));
  const offset = (page - 1) * pageSize;

  const whereClause = q ? "WHERE u.email ILIKE $1 OR u.first_name ILIKE $1 OR u.last_name ILIKE $1" : "";
  const qParam = q ? [`%${q}%`] : [];

  const totalRows = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM users u ${whereClause}`,
    qParam
  );
  const total = Number(totalRows[0]?.count ?? 0);

  const limitIdx = qParam.length + 1;
  const offsetIdx = qParam.length + 2;
  const rows = await query<AdminUserRow>(
    `SELECT
       u.id,
       u.email,
       u.first_name,
       u.last_name,
       u.platform_role,
       COALESCE((SELECT COUNT(*) FROM team_members m WHERE m.user_id = u.id), 0)::int AS team_count,
       COALESCE((SELECT w.balance FROM credit_wallets w WHERE w.scope = 'personal' AND w.owner_user_id = u.id), 0)::bigint AS credit_balance,
       u.created_at
     FROM users u
     ${whereClause}
     ORDER BY u.id DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    [...qParam, pageSize, offset]
  );

  return { users: rows, total, page, pageSize };
}

export interface UpdateAdminUserFields {
  firstName?: string;
  lastName?: string;
  platformRole?: string;
}

/** 后台编辑用户资料：姓名 + 平台角色（user | sysadmin）。调用方负责校验合法取值。 */
export async function updateAdminUser(userId: number, fields: UpdateAdminUserFields): Promise<void> {
  if (fields.firstName !== undefined)
    await query("UPDATE users SET first_name = $2 WHERE id = $1", [userId, fields.firstName]);
  if (fields.lastName !== undefined)
    await query("UPDATE users SET last_name = $2 WHERE id = $1", [userId, fields.lastName]);
  if (fields.platformRole !== undefined)
    await query("UPDATE users SET platform_role = $2 WHERE id = $1", [userId, fields.platformRole]);
}

/** 后台删除用户（级联删除 sessions/email_tokens/team_members 等，由外键 ON DELETE CASCADE 处理）。 */
export async function deleteUser(userId: number): Promise<void> {
  await query("DELETE FROM users WHERE id = $1", [userId]);
}

/** 平台当前 SysAdmin 总数（review 加固：降级/删除前用于"不能清零最后一个 SysAdmin"校验）。 */
export async function countSysAdmins(): Promise<number> {
  const rows = await query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM users WHERE platform_role = 'sysadmin'"
  );
  return Number(rows[0]?.count ?? 0);
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
            u.display_name, u.avatar, u.platform_role
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
