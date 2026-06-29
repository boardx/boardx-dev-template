// packages/data/src/board.ts — CAP-DATA 白板容器仓储（P5）
// Board = 房间内的白板容器（生命周期）。画布内容（items）属 P6，不在此层。
import { query } from "./index";
import { canViewRoom } from "./rooms";

export type BoardVisibility = "room" | "team" | "public";
export type BoardRole = "owner" | "editor" | "viewer";

export interface Board {
  id: number;
  room_id: number;
  team_id: number | null;
  name: string;
  cover: string | null;
  category: string | null;
  description: string | null;
  visibility: BoardVisibility;
  owner_user_id: number;
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
  "id, room_id, team_id, name, cover, category, description, visibility, owner_user_id, created_at, updated_at";

export async function createBoard(
  roomId: number,
  ownerId: number,
  name?: string,
  teamId: number | null = null,
  visibility: BoardVisibility = "room"
): Promise<Board> {
  const rows = await query<Board>(
    `INSERT INTO boards (room_id, team_id, name, owner_user_id, visibility)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${BOARD_COLS}`,
    [roomId, teamId, boardTitleOrDefault(name), ownerId, visibility]
  );
  return rows[0]!;
}

export async function getBoard(boardId: number): Promise<Board | undefined> {
  const rows = await query<Board>(`SELECT ${BOARD_COLS} FROM boards WHERE id = $1`, [boardId]);
  return rows[0];
}

/** 房间内白板，最新在前；可选按名称（ILIKE）过滤。 */
export async function listBoardsInRoom(roomId: number, q?: string): Promise<Board[]> {
  const params: unknown[] = [roomId];
  let nameClause = "";
  if (q && q.trim()) {
    params.push(`%${q.trim()}%`);
    nameClause = ` AND name ILIKE $${params.length}`;
  }
  return query<Board>(
    `SELECT ${BOARD_COLS} FROM boards WHERE room_id = $1${nameClause} ORDER BY id DESC`,
    params
  );
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
    `SELECT b.id, b.room_id, b.team_id, b.name, b.cover, b.category, b.description,
            b.visibility, b.owner_user_id, b.created_at, b.updated_at
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
    `SELECT b.id, b.room_id, b.team_id, b.name, b.cover, b.category, b.description,
            b.visibility, b.owner_user_id, b.created_at, b.updated_at
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

/** 用户能否查看某白板：白板 public，或可查看其所属 room。 */
export async function canViewBoard(boardId: number, userId: number): Promise<boolean> {
  const b = await getBoard(boardId);
  if (!b) return false;
  if (b.visibility === "public") return true;
  return canViewRoom(b.room_id, userId);
}
