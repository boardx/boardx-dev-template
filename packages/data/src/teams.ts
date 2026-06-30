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

export async function updateMemberRole(teamId: number, userId: number, role: TeamRole): Promise<void> {
  await query("UPDATE team_members SET role = $3 WHERE team_id = $1 AND user_id = $2", [teamId, userId, role]);
}

export async function removeMember(teamId: number, userId: number): Promise<void> {
  await query("DELETE FROM team_members WHERE team_id = $1 AND user_id = $2", [teamId, userId]);
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
