// packages/data/src/items.ts — CAP-CANVAS 板 item 仓储
import { query } from "./index";

export interface BoardItemRow {
  id: string;
  room_id: number;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
}

export async function listRoomItems(roomId: number): Promise<BoardItemRow[]> {
  return query<BoardItemRow>(
    "SELECT id, room_id, type, x, y, w, h, text FROM board_items WHERE room_id = $1 ORDER BY created_at",
    [roomId]
  );
}

export async function getItem(itemId: string): Promise<BoardItemRow | undefined> {
  const rows = await query<BoardItemRow>(
    "SELECT id, room_id, type, x, y, w, h, text FROM board_items WHERE id = $1",
    [itemId]
  );
  return rows[0];
}

export async function insertItem(item: BoardItemRow): Promise<BoardItemRow> {
  const rows = await query<BoardItemRow>(
    `INSERT INTO board_items (id, room_id, type, x, y, w, h, text)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, room_id, type, x, y, w, h, text`,
    [item.id, item.room_id, item.type, item.x, item.y, item.w, item.h, item.text]
  );
  return rows[0]!;
}

export async function updateItem(
  itemId: string,
  fields: { x?: number; y?: number; text?: string }
): Promise<void> {
  if (fields.x !== undefined && fields.y !== undefined) {
    await query("UPDATE board_items SET x = $2, y = $3 WHERE id = $1", [itemId, fields.x, fields.y]);
  }
  if (fields.text !== undefined) {
    await query("UPDATE board_items SET text = $2 WHERE id = $1", [itemId, fields.text]);
  }
}

export async function deleteItem(itemId: string): Promise<void> {
  await query("DELETE FROM board_items WHERE id = $1", [itemId]);
}
