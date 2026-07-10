// packages/data/src/board.ts — CAP-DATA 白板容器仓储（P5）
// Board = 房间内的白板容器（生命周期）。画布内容（items）属 P6，不在此层。
import { query } from "./index";
import { canViewRoom, isRoomOwner } from "./rooms";
import { getMembership } from "./teams";

export type BoardVisibility = "room" | "team" | "public";
export type BoardRole = "owner" | "editor" | "viewer";

export interface Board {
  id: number;
  room_id: number;
  team_id: number | null;
  name: string;
  cover: string | null;
  category: string | null;
  tags: string[];
  description: string | null;
  visibility: BoardVisibility;
  owner_user_id: number;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_BOARD_TITLE = "Untitled Board";

/** 名称为空/全空白时回退默认标题（纯函数，可单测）。 */
export function boardTitleOrDefault(name: string | null | undefined): string {
  const t = (name ?? "").trim();
  return t || DEFAULT_BOARD_TITLE;
}

const BOARD_COLS =
  "id, room_id, team_id, name, cover, category, description, visibility, owner_user_id, settings, created_at, updated_at, tags";

export async function createBoard(
  roomId: number,
  ownerId: number,
  name?: string,
  teamId: number | null = null,
  visibility: BoardVisibility = "room",
  tags: string[] = []
): Promise<Board> {
  const rows = await query<Board>(
    `INSERT INTO boards (room_id, team_id, name, owner_user_id, visibility, tags)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${BOARD_COLS}`,
    [roomId, teamId, boardTitleOrDefault(name), ownerId, visibility, tags]
  );
  return rows[0]!;
}

export async function getBoard(boardId: number): Promise<Board | undefined> {
  const rows = await query<Board>(`SELECT ${BOARD_COLS} FROM boards WHERE id = $1`, [boardId]);
  return rows[0];
}

/** 房间内白板，最新在前；可选按名称（ILIKE）过滤。 */
export async function listBoardsInRoom(roomId: number, q?: string, tags?: string[]): Promise<Board[]> {
  const params: unknown[] = [roomId];
  let nameClause = "";
  if (q && q.trim()) {
    params.push(`%${q.trim()}%`);
    nameClause = ` AND name ILIKE $${params.length}`;
  }
  let tagClause = "";
  if (tags?.length) {
    params.push(tags);
    tagClause = ` AND tags && $${params.length}::text[]`;
  }
  return query<Board>(
    `SELECT ${BOARD_COLS} FROM boards WHERE room_id = $1${nameClause}${tagClause} ORDER BY id DESC`,
    params
  );
}

/** 房间下白板数量（p20/F06 删除房间确认弹窗的级联数量摘要）。 */
export async function countBoardsInRoom(roomId: number): Promise<number> {
  const rows = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM boards WHERE room_id = $1`, [
    roomId,
  ]);
  return Number(rows[0]?.count ?? 0);
}

/** 记录一次访问（upsert，刷新 visited_at），供「最近访问」排序。 */
export async function recordBoardVisit(boardId: number, userId: number): Promise<void> {
  await query(
    `INSERT INTO board_visits (user_id, board_id, visited_at) VALUES ($1, $2, now())
     ON CONFLICT (user_id, board_id) DO UPDATE SET visited_at = now()`,
    [userId, boardId]
  );
}

/** 用户最近访问且仍可见的白板，按访问时间倒序；可选名称过滤。 */
export async function listRecentBoards(userId: number, q?: string): Promise<Board[]> {
  const params: unknown[] = [userId];
  let nameClause = "";
  if (q && q.trim()) {
    params.push(`%${q.trim()}%`);
    nameClause = ` AND b.name ILIKE $${params.length}`;
  }
  return query<Board>(
    `SELECT b.id, b.room_id, b.team_id, b.name, b.cover, b.category, b.tags, b.description,
            b.visibility, b.owner_user_id, b.settings, b.created_at, b.updated_at
     FROM board_visits v
     JOIN boards b ON b.id = v.board_id
     JOIN rooms r ON r.id = b.room_id
     LEFT JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = $1
     LEFT JOIN team_members tm ON tm.team_id = r.team_id AND tm.user_id = $1
     WHERE v.user_id = $1
       AND (b.visibility = 'public' OR r.owner_user_id = $1 OR rm.user_id IS NOT NULL
            OR (r.visibility = 'team' AND tm.user_id IS NOT NULL)
            OR (b.visibility = 'team' AND tm.user_id IS NOT NULL))${nameClause}
     ORDER BY v.visited_at DESC`,
    params
  );
}

/**
 * 由三个布尔条件推导用户在某白板的角色（纯函数，可单测）。
 * - 可访问房间者：owner（白板属主）/ editor（房间成员）
 * - 仅白板 public：viewer（只读）
 * - 都不满足：null（无权访问）
 */
export function boardRole(isOwner: boolean, canRoom: boolean, isPublic: boolean): BoardRole | null {
  if (canRoom) return isOwner ? "owner" : "editor";
  if (isPublic) return "viewer";
  return null;
}

/** 删除白板。board_favorites / board_visits 经 FK ON DELETE CASCADE 自动清理。 */
export async function deleteBoard(boardId: number): Promise<void> {
  await query(`DELETE FROM boards WHERE id = $1`, [boardId]);
}

/** 移动白板到其他房间（同时更新归属团队为目标房间的团队）。 */
export async function moveBoard(
  boardId: number,
  targetRoomId: number,
  targetTeamId: number | null
): Promise<Board | undefined> {
  await query(`UPDATE boards SET room_id = $2, team_id = $3, updated_at = now() WHERE id = $1`, [
    boardId,
    targetRoomId,
    targetTeamId,
  ]);
  return getBoard(boardId);
}

/** 复制白板：在同房间创建副本（名称带「（副本）」后缀），复制元信息。
 *  画布内容（items，board-keyed）在 p6 接入后随之复制。新副本属主为复制者。 */
export async function duplicateBoard(boardId: number, userId: number): Promise<Board | undefined> {
  const src = await getBoard(boardId);
  if (!src) return undefined;
  const rows = await query<Board>(
    `INSERT INTO boards (room_id, team_id, name, cover, category, description, visibility, owner_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${BOARD_COLS}`,
    [src.room_id, src.team_id, `${src.name}（副本）`, src.cover, src.category, src.description, src.visibility, userId]
  );
  return rows[0];
}

// ─── 收藏（P5 F04）──────────────────────────────────────────────────────────

export async function addFavorite(boardId: number, userId: number): Promise<void> {
  await query(
    `INSERT INTO board_favorites (user_id, board_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, boardId]
  );
}

export async function removeFavorite(boardId: number, userId: number): Promise<void> {
  await query(`DELETE FROM board_favorites WHERE user_id = $1 AND board_id = $2`, [userId, boardId]);
}

/** 当前用户收藏的 board id 集合（供列表渲染星标态）。 */
export async function listFavoriteBoardIds(userId: number): Promise<number[]> {
  const rows = await query<{ board_id: number }>(
    `SELECT board_id FROM board_favorites WHERE user_id = $1`,
    [userId]
  );
  return rows.map((r) => r.board_id);
}

/** 用户收藏且仍可见的白板，按收藏时间倒序；可选名称过滤。 */
export async function listFavoriteBoards(userId: number, q?: string): Promise<Board[]> {
  const params: unknown[] = [userId];
  let nameClause = "";
  if (q && q.trim()) {
    params.push(`%${q.trim()}%`);
    nameClause = ` AND b.name ILIKE $${params.length}`;
  }
  return query<Board>(
    `SELECT b.id, b.room_id, b.team_id, b.name, b.cover, b.category, b.tags, b.description,
            b.visibility, b.owner_user_id, b.settings, b.created_at, b.updated_at
     FROM board_favorites f
     JOIN boards b ON b.id = f.board_id
     JOIN rooms r ON r.id = b.room_id
     LEFT JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = $1
     LEFT JOIN team_members tm ON tm.team_id = r.team_id AND tm.user_id = $1
     WHERE f.user_id = $1
       AND (b.visibility = 'public' OR r.owner_user_id = $1 OR rm.user_id IS NOT NULL
            OR (r.visibility = 'team' AND tm.user_id IS NOT NULL)
            OR (b.visibility = 'team' AND tm.user_id IS NOT NULL))${nameClause}
     ORDER BY f.created_at DESC`,
    params
  );
}

/**
 * 用户有编辑权限（owner/editor）的白板列表（p18 F11：AVA「发送到 Board」选择器）。
 * 口径与 boardRole 一致：白板属主，或可访问（owner/成员）其所属房间。不含仅 viewer 的
 * public/team 只读白板——那些没有编辑权限，选择器里不应出现。
 */
export async function listEditableBoardsForUser(userId: number, q?: string): Promise<Board[]> {
  const params: unknown[] = [userId];
  let nameClause = "";
  if (q && q.trim()) {
    params.push(`%${q.trim()}%`);
    nameClause = ` AND b.name ILIKE $${params.length}`;
  }
  return query<Board>(
    `SELECT DISTINCT b.id, b.room_id, b.team_id, b.name, b.cover, b.category, b.tags, b.description,
            b.visibility, b.owner_user_id, b.settings, b.created_at, b.updated_at
     FROM boards b
     JOIN rooms r ON r.id = b.room_id
     LEFT JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = $1
     WHERE (b.owner_user_id = $1 OR r.owner_user_id = $1 OR rm.user_id IS NOT NULL)${nameClause}
     ORDER BY b.updated_at DESC`,
    params
  );
}

/**
 * 计算用户在某白板的访问角色，含 team 可见性：
 *  - 房间可见者：owner（属主）/ editor（房间成员）
 *  - 白板 public：viewer
 *  - 白板 team 且用户属该房间的团队：viewer
 *  - 否则 null（无权）
 */
export async function getBoardAccessRole(boardId: number, userId: number): Promise<BoardRole | null> {
  const b = await getBoard(boardId);
  if (!b) return null;
  const r = boardRole(b.owner_user_id === userId, await canViewRoom(b.room_id, userId), b.visibility === "public");
  if (r) return r;
  if (b.visibility === "team" && b.team_id != null && (await getMembership(b.team_id, userId))) {
    return "viewer";
  }
  return null;
}

/** 用户能否查看某白板（含 public / team 访问级别）。 */
export async function canViewBoard(boardId: number, userId: number): Promise<boolean> {
  return (await getBoardAccessRole(boardId, userId)) !== null;
}

/** 用户能否管理某白板（改元信息/移动/删除）：白板属主或所属房间 owner。 */
export async function canManageBoard(boardId: number, userId: number): Promise<boolean> {
  const b = await getBoard(boardId);
  if (!b) return false;
  if (b.owner_user_id === userId) return true;
  return isRoomOwner(b.room_id, userId);
}

/** 合并更新白板设置（jsonb 浅合并）。 */
export async function updateBoardSettings(
  boardId: number,
  patch: Record<string, unknown>
): Promise<Board | undefined> {
  await query(`UPDATE boards SET settings = settings || $2::jsonb, updated_at = now() WHERE id = $1`, [
    boardId,
    JSON.stringify(patch),
  ]);
  return getBoard(boardId);
}

/** 谁能改白板可见范围：所属房间 owner（uc-board-access-001：Room Owner/Admin）。 */
export async function canSetBoardVisibility(boardId: number, userId: number): Promise<boolean> {
  const b = await getBoard(boardId);
  if (!b) return false;
  return isRoomOwner(b.room_id, userId);
}

/** 设置白板可见范围。 */
export async function setBoardVisibility(boardId: number, visibility: BoardVisibility): Promise<Board | undefined> {
  await query(`UPDATE boards SET visibility = $2, updated_at = now() WHERE id = $1`, [boardId, visibility]);
  return getBoard(boardId);
}

// ─── 更新元信息（P5 F05）────────────────────────────────────────────────────

export interface BoardMetaFields {
  name?: string;
  category?: string | null;
  description?: string | null;
  cover?: string | null;
  tags?: string[];
}

const META_COLS = ["name", "category", "description", "cover"] as const;

/** 更新白板元信息（仅白名单列）。返回更新后的 board；无可更新字段时原样返回。 */
export async function updateBoard(boardId: number, fields: BoardMetaFields): Promise<Board | undefined> {
  const sets: string[] = [];
  const params: unknown[] = [boardId];
  for (const col of META_COLS) {
    const v = (fields as Record<string, unknown>)[col];
    if (v !== undefined) {
      params.push(v);
      sets.push(`${col} = $${params.length}`);
    }
  }
  if (fields.tags !== undefined) {
    params.push(fields.tags);
    sets.push(`tags = $${params.length}::text[]`);
  }
  if (sets.length) {
    sets.push("updated_at = now()");
    await query(`UPDATE boards SET ${sets.join(", ")} WHERE id = $1`, params);
  }
  return getBoard(boardId);
}
