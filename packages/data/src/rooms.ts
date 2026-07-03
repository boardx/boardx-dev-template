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
}

export async function createRoom(
  name: string,
  ownerId: number,
  visibility: RoomVisibility = "private",
  teamId: number | null = null
): Promise<Room> {
  const rows = await query<Room>(
    `INSERT INTO rooms (name, owner_user_id, team_id, visibility) VALUES ($1, $2, $3, $4)
     RETURNING id, name, owner_user_id, team_id, visibility, created_at`,
    [name, ownerId, teamId, visibility]
  );
  const room = rows[0]!;
  await query("INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, 'owner')", [room.id, ownerId]);
  return room;
}

export async function getRoom(roomId: number): Promise<Room | undefined> {
  const rows = await query<Room>(
    "SELECT id, name, owner_user_id, team_id, visibility, created_at FROM rooms WHERE id = $1",
    [roomId]
  );
  return rows[0];
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
  fields: { name?: string; visibility?: RoomVisibility }
): Promise<void> {
  if (fields.name !== undefined) await query("UPDATE rooms SET name = $2 WHERE id = $1", [roomId, fields.name]);
  if (fields.visibility !== undefined)
    await query("UPDATE rooms SET visibility = $2 WHERE id = $1", [roomId, fields.visibility]);
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
