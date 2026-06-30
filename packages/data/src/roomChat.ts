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

// ─── 消息体（room_chat_messages / P9 uc-room-chat-003）──────────────────────

export type RoomChatRole = "user" | "assistant";

export interface RoomChatMessage {
  id: number;
  chat_id: number;
  room_id: number;
  role: RoomChatRole;
  content: string;
  created_at: string;
}

/** AVA 占位回复：以 room chat 类型 + 当前 roomId 关联当前房间上下文（纯函数，可单测）。
 *  p9 接入真实模型前的确定性桩；不含模型选择/计费（见 UC 不包含）。 */
export function avaReply(userText: string, roomId: number): string {
  const t = (userText ?? "").trim();
  const quoted = t.length > 80 ? `${t.slice(0, 80)}…` : t;
  return `AVA（房间 ${roomId} 上下文）已收到：“${quoted}”。`;
}

/** 线程内消息，按时间升序。 */
export async function listRoomChatMessages(chatId: number): Promise<RoomChatMessage[]> {
  return query<RoomChatMessage>(
    `SELECT id, chat_id, room_id, role, content, created_at
     FROM room_chat_messages WHERE chat_id = $1 ORDER BY id ASC`,
    [chatId]
  );
}

async function insertMessage(
  chatId: number,
  roomId: number,
  role: RoomChatRole,
  content: string
): Promise<RoomChatMessage> {
  const rows = await query<RoomChatMessage>(
    `INSERT INTO room_chat_messages (chat_id, room_id, role, content)
     VALUES ($1, $2, $3, $4)
     RETURNING id, chat_id, room_id, role, content, created_at`,
    [chatId, roomId, role, content]
  );
  return rows[0]!;
}

/** 发送一条用户消息并生成 AVA 占位回复；两条都持久化，线程 updated_at 刷新。 */
export async function sendRoomChatMessage(
  chatId: number,
  roomId: number,
  text: string
): Promise<{ userMessage: RoomChatMessage; replyMessage: RoomChatMessage }> {
  const userMessage = await insertMessage(chatId, roomId, "user", text.trim());
  const replyMessage = await insertMessage(chatId, roomId, "assistant", avaReply(text, roomId));
  await query(`UPDATE room_chats SET updated_at = now() WHERE id = $1`, [chatId]);
  return { userMessage, replyMessage };
}
