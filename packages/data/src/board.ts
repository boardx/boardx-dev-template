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

/** 房间内全部白板，最新在前。 */
export async function listBoardsInRoom(roomId: number): Promise<Board[]> {
  return query<Board>(`SELECT ${BOARD_COLS} FROM boards WHERE room_id = $1 ORDER BY id DESC`, [roomId]);
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

/** 用户能否查看某白板：白板 public，或可查看其所属 room。 */
export async function canViewBoard(boardId: number, userId: number): Promise<boolean> {
  const b = await getBoard(boardId);
  if (!b) return false;
  if (b.visibility === "public") return true;
  return canViewRoom(b.room_id, userId);
}
