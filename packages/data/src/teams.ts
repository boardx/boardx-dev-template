// packages/data/src/teams.ts — CAP-AUTH 团队仓储
import { query } from "./index";

export type TeamRole = "owner" | "admin" | "member";

export interface Team {
  id: number;
  name: string;
  description: string;
  team_type: string;
  owner_user_id: number;
  created_at: string;
}

export interface TeamWithRole extends Team {
  role: TeamRole;
}

/** 创建团队并把创建者设为 owner（一个事务内）。 */
export async function createTeam(name: string, ownerId: number): Promise<Team> {
  const rows = await query<Team>(
    "INSERT INTO teams (name, owner_user_id) VALUES ($1, $2) RETURNING id, name, description, team_type, owner_user_id, created_at",
    [name, ownerId]
  );
  const team = rows[0]!;
  await query("INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'owner')", [team.id, ownerId]);
  return team;
}

export async function getTeam(teamId: number): Promise<Team | undefined> {
  const rows = await query<Team>(
    "SELECT id, name, description, team_type, owner_user_id, created_at FROM teams WHERE id = $1",
    [teamId]
  );
  return rows[0];
}

export async function listUserTeams(userId: number): Promise<TeamWithRole[]> {
  return query<TeamWithRole>(
    `SELECT t.id, t.name, t.description, t.team_type, t.owner_user_id, t.created_at, m.role
     FROM team_members m JOIN teams t ON t.id = m.team_id
     WHERE m.user_id = $1 ORDER BY t.id DESC`,
    [userId]
  );
}

/** 取某用户在某团队的角色（非成员返回 undefined）。 */
export async function getMembership(teamId: number, userId: number): Promise<TeamRole | undefined> {
  const rows = await query<{ role: TeamRole }>(
    "SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2",
    [teamId, userId]
  );
  return rows[0]?.role;
}

export interface MemberRow {
  user_id: number;
  email: string;
  role: TeamRole;
}

export async function listMembers(teamId: number): Promise<MemberRow[]> {
  return query<MemberRow>(
    `SELECT m.user_id, u.email, m.role FROM team_members m JOIN users u ON u.id = m.user_id
     WHERE m.team_id = $1 ORDER BY m.created_at`,
    [teamId]
  );
}

export async function addMember(teamId: number, userId: number, role: TeamRole = "member"): Promise<void> {
  await query(
    `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (team_id, user_id) DO NOTHING`,
    [teamId, userId, role]
  );
}

/**
 * 改成员角色（p21-F02 owner 保护，数据层兜底）。SQL 里直接排除 role='owner' 的目标行，
 * 即使调用方绕过路由层校验也无法改到 owner；owner 自己转让所有权不在本函数范围内。
 */
export async function updateMemberRole(teamId: number, userId: number, role: TeamRole): Promise<void> {
  await query(
    "UPDATE team_members SET role = $3 WHERE team_id = $1 AND user_id = $2 AND role <> 'owner'",
    [teamId, userId, role]
  );
}

/** 移除成员（p21-F02 owner 保护，数据层兜底）。SQL 里直接排除 role='owner' 的目标行。 */
export async function removeMember(teamId: number, userId: number): Promise<void> {
  await query("DELETE FROM team_members WHERE team_id = $1 AND user_id = $2 AND role <> 'owner'", [teamId, userId]);
}

export async function renameTeam(teamId: number, name: string): Promise<void> {
  await query("UPDATE teams SET name = $2 WHERE id = $1", [teamId, name]);
}

/** uc-team-007：更新团队通用设置（name 必填，description 可选）。 */
export async function updateTeam(
  teamId: number,
  fields: { name: string; description?: string }
): Promise<void> {
  await query("UPDATE teams SET name = $2, description = $3 WHERE id = $1", [
    teamId,
    fields.name,
    fields.description ?? "",
  ]);
}

export async function deleteTeam(teamId: number): Promise<void> {
  await query("DELETE FROM teams WHERE id = $1", [teamId]);
}

/**
 * 该用户拥有（owner_user_id）的团队数（P15 F02 review 加固）。
 * teams.owner_user_id 是 ON DELETE CASCADE（见 003_team.sql），删除一个拥有团队的用户会级联
 * 删掉整个团队（team_members/team_invites/该团队下的 rooms/boards 等），影响的是团队里其他
 * 成员的数据，不只是被删用户自己的——后台删除用户前必须先查这个，>0 就拒绝，要求先转移
 * 团队所有权，而不是让级联静默触发。
 */
export async function countOwnedTeams(userId: number): Promise<number> {
  const rows = await query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM teams WHERE owner_user_id = $1",
    [userId]
  );
  return Number(rows[0]?.count ?? 0);
}

// ─── P15 Admin 后台：团队管理（F03）────────────────────────────────────────────

export type TeamType = "standard" | "enterprise";

export function isTeamType(s: string): s is TeamType {
  return s === "standard" || s === "enterprise";
}

export interface AdminTeamRow {
  id: number;
  name: string;
  team_type: string;
  member_count: number;
  credit_balance: number;
  created_at: string;
}

export interface ListAdminTeamsInput {
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface ListAdminTeamsResult {
  teams: AdminTeamRow[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 后台团队列表：名称/类型/成员数/Credit 余额（真实聚合）。
 * member_count 来自 team_members 计数；credit_balance 来自该团队的 credit_wallets（无钱包则 0，
 * 不隐式创建——只有手动上分时才会 getOrCreateTeamWallet）。
 */
export async function listAdminTeams(input: ListAdminTeamsInput = {}): Promise<ListAdminTeamsResult> {
  const q = (input.q ?? "").trim();
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 10));
  const offset = (page - 1) * pageSize;

  const whereClause = q ? "WHERE t.name ILIKE $1" : "";
  const qParam = q ? [`%${q}%`] : [];

  const totalRows = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM teams t ${whereClause}`,
    qParam
  );
  const total = Number(totalRows[0]?.count ?? 0);

  const limitIdx = qParam.length + 1;
  const offsetIdx = qParam.length + 2;
  const rows = await query<AdminTeamRow>(
    `SELECT
       t.id,
       t.name,
       t.team_type,
       COALESCE((SELECT COUNT(*) FROM team_members m WHERE m.team_id = t.id), 0)::int AS member_count,
       COALESCE((SELECT w.balance FROM credit_wallets w WHERE w.scope = 'team' AND w.team_id = t.id), 0)::bigint AS credit_balance,
       t.created_at
     FROM teams t
     ${whereClause}
     ORDER BY t.id DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    [...qParam, pageSize, offset]
  );

  return { teams: rows, total, page, pageSize };
}

/** 更新团队类型（standard | enterprise）。调用方负责校验合法取值。 */
export async function updateTeamType(teamId: number, teamType: TeamType): Promise<void> {
  await query("UPDATE teams SET team_type = $2 WHERE id = $1", [teamId, teamType]);
}

// ─── 邀请 ────────────────────────────────────────────────────────────────────

export interface TeamInvite {
  token: string;
  team_id: number;
  role: TeamRole;
  expires_at: string;
  consumed_at: string | null;
}

export async function createTeamInvite(token: string, teamId: number, role: TeamRole, expiresAt: Date): Promise<void> {
  await query("INSERT INTO team_invites (token, team_id, role, expires_at) VALUES ($1, $2, $3, $4)", [
    token,
    teamId,
    role,
    expiresAt,
  ]);
}

export async function getValidInvite(token: string): Promise<TeamInvite | undefined> {
  const rows = await query<TeamInvite>(
    `SELECT token, team_id, role, expires_at, consumed_at FROM team_invites
     WHERE token = $1 AND consumed_at IS NULL AND expires_at > now()`,
    [token]
  );
  return rows[0];
}

export async function consumeInvite(token: string): Promise<void> {
  await query("UPDATE team_invites SET consumed_at = now() WHERE token = $1", [token]);
}
