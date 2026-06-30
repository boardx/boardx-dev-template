// packages/data/src/items.ts — CAP-CANVAS 板 item 仓储
import { query } from "./index";

export interface BoardItemRow {
  id: string;
  room_id: number;
  board_id?: number | null;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color?: string | null;
}

const ITEM_COLS = "id, room_id, board_id, type, x, y, w, h, text, color";

export async function listRoomItems(roomId: number): Promise<BoardItemRow[]> {
  return query<BoardItemRow>(
    `SELECT ${ITEM_COLS} FROM board_items WHERE room_id = $1 ORDER BY created_at`,
    [roomId]
  );
}

/** board-keyed item 列表（ADR-0002）。 */
export async function listBoardItems(boardId: number): Promise<BoardItemRow[]> {
  return query<BoardItemRow>(
    `SELECT ${ITEM_COLS} FROM board_items WHERE board_id = $1 ORDER BY created_at`,
    [boardId]
  );
}

export async function getItem(itemId: string): Promise<BoardItemRow | undefined> {
  const rows = await query<BoardItemRow>(`SELECT ${ITEM_COLS} FROM board_items WHERE id = $1`, [itemId]);
  return rows[0];
}

export async function insertItem(item: BoardItemRow): Promise<BoardItemRow> {
  const rows = await query<BoardItemRow>(
    `INSERT INTO board_items (id, room_id, board_id, type, x, y, w, h, text, color)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${ITEM_COLS}`,
    [item.id, item.room_id, item.board_id ?? null, item.type, item.x, item.y, item.w, item.h, item.text, item.color ?? null]
  );
  return rows[0]!;
}

export async function updateItem(
  itemId: string,
  fields: { x?: number; y?: number; text?: string; color?: string | null }
): Promise<void> {
  if (fields.x !== undefined && fields.y !== undefined) {
    await query("UPDATE board_items SET x = $2, y = $3 WHERE id = $1", [itemId, fields.x, fields.y]);
  }
  if (fields.text !== undefined) {
    await query("UPDATE board_items SET text = $2 WHERE id = $1", [itemId, fields.text]);
  }
  if (fields.color !== undefined) {
    await query("UPDATE board_items SET color = $2 WHERE id = $1", [itemId, fields.color]);
  }
}

export async function deleteItem(itemId: string): Promise<void> {
  await query("DELETE FROM board_items WHERE id = $1", [itemId]);
}
