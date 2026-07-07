// packages/data/src/rooms.ts — CAP-COLLAB 房间仓储
import { query } from "./index";

export type RoomVisibility = "private" | "team";

export interface Room {
  id: number;
  name: string;
  owner_user_id: number;
  team_id: number | null;
  visibility: RoomVisibility;
  created_at: string;
  description: string | null;
  ai_instruction: string | null;
}

/** ai_instruction 长度上限（uc-rr-010 E2）：超过即校验拒绝。 */
export const AI_INSTRUCTION_MAX_LEN = 4000;

export async function createRoom(
  name: string,
  ownerId: number,
  visibility: RoomVisibility = "private",
  teamId: number | null = null
): Promise<Room> {
  const rows = await query<Room>(
    `INSERT INTO rooms (name, owner_user_id, team_id, visibility) VALUES ($1, $2, $3, $4)
     RETURNING id, name, owner_user_id, team_id, visibility, created_at, description, ai_instruction`,
    [name, ownerId, teamId, visibility]
  );
  const room = rows[0]!;
  await query("INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, 'owner')", [room.id, ownerId]);
  return room;
}

export async function getRoom(roomId: number): Promise<Room | undefined> {
  const rows = await query<Room>(
    "SELECT id, name, owner_user_id, team_id, visibility, created_at, description, ai_instruction FROM rooms WHERE id = $1",
    [roomId]
  );
  return rows[0];
}

/** 房间的 ai_instruction（聊天发消息注入系统提示时用；同房间全部线程共享同一指令）。 */
export async function getRoomAiInstruction(roomId: number): Promise<string | null> {
  const rows = await query<{ ai_instruction: string | null }>(
    "SELECT ai_instruction FROM rooms WHERE id = $1",
    [roomId]
  );
  return rows[0]?.ai_instruction ?? null;
}

/** 列表行：在 Room 之上附带「当前用户是否已是成员」，供前端渲染 Join 入口。 */
export interface VisibleRoom extends Room {
  is_member: boolean;
}

/** 用户可见的 room：自己是 owner/成员，或 team 可见且是该团队成员。可选名字搜索。 */
export async function listVisibleRooms(userId: number, q?: string): Promise<VisibleRoom[]> {
  const params: unknown[] = [userId];
  let nameClause = "";
  if (q && q.trim()) {
    params.push(`%${q.trim()}%`);
    nameClause = ` AND r.name ILIKE $${params.length}`;
  }
  return query<VisibleRoom>(
    `SELECT DISTINCT r.id, r.name, r.owner_user_id, r.team_id, r.visibility, r.created_at,
            (r.owner_user_id = $1 OR rm.user_id IS NOT NULL) AS is_member
     FROM rooms r
     LEFT JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = $1
     LEFT JOIN team_members tm ON tm.team_id = r.team_id AND tm.user_id = $1
     WHERE (r.owner_user_id = $1 OR rm.user_id IS NOT NULL OR (r.visibility = 'team' AND tm.user_id IS NOT NULL))${nameClause}
     ORDER BY r.id DESC`,
    params
  );
}

/** 用户能否查看某 room。 */
export async function canViewRoom(roomId: number, userId: number): Promise<boolean> {
  const rows = await query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM rooms r
       LEFT JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = $2
       LEFT JOIN team_members tm ON tm.team_id = r.team_id AND tm.user_id = $2
       WHERE r.id = $1
         AND (r.owner_user_id = $2 OR rm.user_id IS NOT NULL OR (r.visibility = 'team' AND tm.user_id IS NOT NULL))
     ) AS ok`,
    [roomId, userId]
  );
  return rows[0]?.ok ?? false;
}

export async function isRoomOwner(roomId: number, userId: number): Promise<boolean> {
  const rows = await query<{ ok: boolean }>(
    "SELECT (owner_user_id = $2) AS ok FROM rooms WHERE id = $1",
    [roomId, userId]
  );
  return rows[0]?.ok ?? false;
}

export type RoomRole = "owner" | "admin" | "member";

/** 取某用户在某 room 的角色（非成员返回 undefined）。room owner 始终回 "owner"。 */
export async function getRoomRole(roomId: number, userId: number): Promise<RoomRole | undefined> {
  const rows = await query<{ role: string; is_owner: boolean }>(
    `SELECT m.role, (r.owner_user_id = $2) AS is_owner
     FROM room_members m JOIN rooms r ON r.id = m.room_id
     WHERE m.room_id = $1 AND m.user_id = $2`,
    [roomId, userId]
  );
  const row = rows[0];
  if (!row) return undefined;
  if (row.is_owner) return "owner";
  return row.role === "admin" ? "admin" : "member";
}

/** owner / admin 可管理房间成员（邀请 / 改角色 / 移除）。 */
export async function canManageRoom(roomId: number, userId: number): Promise<boolean> {
  const role = await getRoomRole(roomId, userId);
  return role === "owner" || role === "admin";
}

export interface RoomMemberRow {
  user_id: number;
  email: string;
  role: string;
}

export async function listRoomMembers(roomId: number): Promise<RoomMemberRow[]> {
  return query<RoomMemberRow>(
    `SELECT m.user_id, u.email, m.role FROM room_members m JOIN users u ON u.id = m.user_id
     WHERE m.room_id = $1 ORDER BY m.created_at`,
    [roomId]
  );
}

export async function addRoomMember(
  roomId: number,
  userId: number,
  role: "admin" | "member" = "member"
): Promise<void> {
  await query(
    "INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
    [roomId, userId, role]
  );
}

/** 改成员角色（不影响 owner，路由层负责拦截 owner）。 */
export async function updateRoomMemberRole(
  roomId: number,
  userId: number,
  role: "admin" | "member"
): Promise<void> {
  await query("UPDATE room_members SET role = $3 WHERE room_id = $1 AND user_id = $2", [roomId, userId, role]);
}

export async function removeRoomMember(roomId: number, userId: number): Promise<void> {
  await query("DELETE FROM room_members WHERE room_id = $1 AND user_id = $2", [roomId, userId]);
}

export async function updateRoom(
  roomId: number,
  fields: { name?: string; visibility?: RoomVisibility; description?: string | null; ai_instruction?: string | null }
): Promise<void> {
  if (fields.name !== undefined) await query("UPDATE rooms SET name = $2 WHERE id = $1", [roomId, fields.name]);
  if (fields.visibility !== undefined)
    await query("UPDATE rooms SET visibility = $2 WHERE id = $1", [roomId, fields.visibility]);
  if (fields.description !== undefined)
    await query("UPDATE rooms SET description = $2 WHERE id = $1", [roomId, fields.description]);
  if (fields.ai_instruction !== undefined)
    await query("UPDATE rooms SET ai_instruction = $2 WHERE id = $1", [roomId, fields.ai_instruction]);
}

export async function deleteRoom(roomId: number): Promise<void> {
  await query("DELETE FROM rooms WHERE id = $1", [roomId]);
}

// ─── 收藏（P20 F05）──────────────────────────────────────────────────────────
// 与 board_favorites（P5 F04）同一模式：独立表、每用户维度、room_id 级联删除自动清理。

export async function addRoomFavorite(roomId: number, userId: number): Promise<void> {
  await query(
    `INSERT INTO room_favorites (user_id, room_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, roomId]
  );
}

export async function removeRoomFavorite(roomId: number, userId: number): Promise<void> {
  await query(`DELETE FROM room_favorites WHERE user_id = $1 AND room_id = $2`, [userId, roomId]);
}

/** 当前用户收藏的 room id 集合（供列表/详情页渲染星标态）。 */
export async function listFavoriteRoomIds(userId: number): Promise<number[]> {
  const rows = await query<{ room_id: number }>(`SELECT room_id FROM room_favorites WHERE user_id = $1`, [userId]);
  return rows.map((r) => r.room_id);
}

// ─── room_invites（p20 F09：邀请未注册邮箱）───────────────────────────────────
// 与 team_invites 同一模式，但按 (room_id, email) 幂等：重复邀请刷新 token/expires_at/status，
// 不产生重复行。status 显式建模：pending | accepted | revoked | expired。

export type RoomInviteStatus = "pending" | "accepted" | "revoked" | "expired";

export interface RoomInvite {
  id: number;
  email: string;
  room_id: number;
  role: "admin" | "member";
  token: string;
  status: RoomInviteStatus;
  invited_by: number;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * 邀请未注册邮箱加入房间：幂等 upsert（同房间+同邮箱只保留一条记录）。
 * 重复邀请 → 刷新 token、过期时间、状态回 pending（覆盖此前 revoked/expired/accepted）。
 *
 * 语义说明（rev-security M3）：这意味着"撤销后再次邀请同一邮箱"会让 pending 状态复活——
 * 旧 token 因为整行被覆盖（含 token 列）而失效，新邀请拿到全新 token，旧的撤销动作不会被
 * 绕过（撤销掉的令牌永远查不到），这是有意的产品行为（owner/admin 反悔撤销后可以重新邀请），
 * 不是漏洞；只是"撤销"在这张表里不是终态而是可覆盖态，记录在此避免以后被误当 bug 修掉。
 *
 * review 修复（rev-code minor）：本期邀请角色锁死为 member——不接受调用方传入 role，
 * 避免出现"看似支持 admin 邀请但从无测试覆盖、也从无 UI 入口"的死分支。如未来要支持
 * 邀请直接给 admin 角色，需要新增对应 UI + e2e 后再放开这个参数。
 */
export async function upsertRoomInvite(
  roomId: number,
  email: string,
  token: string,
  invitedBy: number,
  expiresAt: Date
): Promise<RoomInvite> {
  const rows = await query<RoomInvite>(
    `INSERT INTO room_invites (email, room_id, role, token, status, invited_by, expires_at)
     VALUES ($1, $2, 'member', $3, 'pending', $4, $5)
     ON CONFLICT (room_id, email) DO UPDATE SET
       token = EXCLUDED.token,
       role = 'member',
       status = 'pending',
       invited_by = EXCLUDED.invited_by,
       expires_at = EXCLUDED.expires_at,
       updated_at = now()
     RETURNING id, email, room_id, role, token, status, invited_by, expires_at, created_at, updated_at`,
    [email, roomId, token, invitedBy, expiresAt]
  );
  return rows[0]!;
}

/** 某房间当前 pending 的邀请列表（Members tab 展示，owner/admin 可撤销）。 */
export async function listPendingRoomInvites(roomId: number): Promise<RoomInvite[]> {
  return query<RoomInvite>(
    `SELECT id, email, room_id, role, token, status, invited_by, expires_at, created_at, updated_at
     FROM room_invites
     WHERE room_id = $1 AND status = 'pending' AND expires_at > now()
     ORDER BY created_at DESC`,
    [roomId]
  );
}

/** 按 token 取有效（未消费/未撤销、未过期）邀请。 */
export async function getValidRoomInvite(token: string): Promise<RoomInvite | undefined> {
  const rows = await query<RoomInvite>(
    `SELECT id, email, room_id, role, token, status, invited_by, expires_at, created_at, updated_at
     FROM room_invites
     WHERE token = $1 AND status = 'pending' AND expires_at > now()`,
    [token]
  );
  return rows[0];
}

/**
 * 按 token 取邀请，不管状态/是否过期（p20 F09 review 修复：区分"过期"与"未知 token"两种
 * 前端提示需要看到原始记录，而不能只看 getValidRoomInvite 的"有效"视图）。
 * 调用方必须自行校验 email 是否匹配、status 是否仍是 pending，不能只凭"查到记录"就当作有效邀请。
 */
export async function getRoomInviteByToken(token: string): Promise<RoomInvite | undefined> {
  const rows = await query<RoomInvite>(
    `SELECT id, email, room_id, role, token, status, invited_by, expires_at, created_at, updated_at
     FROM room_invites WHERE token = $1`,
    [token]
  );
  return rows[0];
}

export async function markRoomInviteAccepted(id: number): Promise<void> {
  await query("UPDATE room_invites SET status = 'accepted', updated_at = now() WHERE id = $1", [id]);
}

/** 撤销邀请（owner/admin 在 Members tab 操作）；只允许撤销 pending 态，防止覆盖 accepted 记录。 */
export async function revokeRoomInvite(roomId: number, inviteId: number): Promise<boolean> {
  const rows = await query<{ id: number }>(
    `UPDATE room_invites SET status = 'revoked', updated_at = now()
     WHERE id = $1 AND room_id = $2 AND status = 'pending'
     RETURNING id`,
    [inviteId, roomId]
  );
  return rows.length > 0;
}

/**
 * 仅供 dev/测试：把某房间下某邮箱的邀请过期时间强制拨回过去（e2e 覆盖"令牌过期"场景）。
 * review 修复（rev-security B2）：按 (room_id, email) 收敛，不再一把过期该邮箱在所有房间的邀请
 * ——调用方（dev 端点）必须先校验调用者对该 room_id 有 owner/admin 权限。
 */
export async function expireRoomInvite(roomId: number, email: string): Promise<void> {
  await query(
    "UPDATE room_invites SET expires_at = now() - interval '1 minute' WHERE room_id = $1 AND email = $2",
    [roomId, email]
  );
}
