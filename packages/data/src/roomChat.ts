// packages/data/src/roomChat.ts — CAP-DATA 房间聊天线程仓储（P4）
import { query } from "./index";

export interface RoomChat {
  id: number;
  room_id: number;
  team_id: number | null;
  name: string;
  creator_user_id: number;
  created_at: string;
  updated_at: string;
}

export interface RoomChatRow extends RoomChat {
  creator_email: string;
}

export const DEFAULT_CHAT_NAME = "新对话";

/** 线程名为空时回退默认（纯函数，可单测）。 */
export function chatNameOrDefault(name: string | null | undefined): string {
  const t = (name ?? "").trim();
  return t || DEFAULT_CHAT_NAME;
}

export async function createRoomChat(
  roomId: number,
  creatorId: number,
  name?: string,
  teamId: number | null = null
): Promise<RoomChat> {
  const rows = await query<RoomChat>(
    `INSERT INTO room_chats (room_id, team_id, name, creator_user_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, room_id, team_id, name, creator_user_id, created_at, updated_at`,
    [roomId, teamId, chatNameOrDefault(name), creatorId]
  );
  return rows[0]!;
}

export async function getRoomChat(chatId: number): Promise<RoomChat | undefined> {
  const rows = await query<RoomChat>(
    `SELECT id, room_id, team_id, name, creator_user_id, created_at, updated_at FROM room_chats WHERE id = $1`,
    [chatId]
  );
  return rows[0];
}

/** 房间内线程，最近更新在前，带创建者邮箱。 */
export async function listRoomChats(roomId: number): Promise<RoomChatRow[]> {
  return query<RoomChatRow>(
    `SELECT c.id, c.room_id, c.team_id, c.name, c.creator_user_id, c.created_at, c.updated_at, u.email AS creator_email
     FROM room_chats c JOIN users u ON u.id = c.creator_user_id
     WHERE c.room_id = $1 ORDER BY c.updated_at DESC, c.id DESC`,
    [roomId]
  );
}

export async function deleteRoomChat(chatId: number): Promise<void> {
  await query(`DELETE FROM room_chats WHERE id = $1`, [chatId]);
}
