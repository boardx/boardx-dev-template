// packages/data/src/roomChat.ts — CAP-DATA 房间聊天线程仓储（P4；P18 room-ava F05 接入真实网关）
import { query } from "./index";
import {
  defaultGateway,
  runChatGraph,
  makeGenerateNode,
  DEFAULT_AVA_MODEL_ID,
  DEFAULT_AVA_AGENT_ID,
  DEFAULT_AVA_TOOL_IDS,
  type ChatMessage,
} from "@repo/ai";

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

/** 房间下聊天线程数量（p20/F06 删除房间确认弹窗的级联数量摘要）。 */
export async function countRoomChats(roomId: number): Promise<number> {
  const rows = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM room_chats WHERE room_id = $1`, [
    roomId,
  ]);
  return Number(rows[0]?.count ?? 0);
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

/** 组装喂给 CAP-AI 网关的消息数组（纯函数，可单测）：
 *  uc-rr-010（p20/F11）：若房间配置了 ai_instruction，作为 system 消息注入到最前面
 *  （同房间全部线程共享同一指令）；随后是线程历史，最后追加本次用户消息。
 *  房间 id 本身不再拼进回复文案里——真实模型不需要靠字符串模板体现"关联当前房间"，
 *  房间关联体现在这条消息序列本身就是该房间该线程的历史（调用方按 chatId/roomId 隔离）。 */
export function buildRoomChatMessages(
  history: Array<Pick<RoomChatMessage, "role" | "content">>,
  text: string,
  roomId: number,
  aiInstruction?: string | null
): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const instruction = (aiInstruction ?? "").trim();
  if (instruction) {
    messages.push({
      role: "system",
      content: `你正在房间 ${roomId} 的聊天线程中协助用户。房间管理员设置的系统提示（ai_instruction）：${instruction}`,
    });
  }
  for (const m of history) {
    messages.push({ role: m.role, content: m.content });
  }
  messages.push({ role: "user", content: (text ?? "").trim() });
  return messages;
}

/** 调 CAP-AI 网关生成一条完整回复（非流式：内部把网关的流式 token 收集成一整段字符串
 *  再返回，room chat 目前是"一次 POST 拿到两条消息"的非流式契约，不在本次改造成 SSE）。
 *  与 /ava 消息路由（apps/web/app/api/ava/threads/[id]/messages/reply-stream.ts）复用同一套
 *  runChatGraph + makeGenerateNode(defaultGateway.streamChat) 调用方式，不重新发明网关调用约定。 */
async function generateRoomChatReply(
  history: RoomChatMessage[],
  roomId: number,
  text: string,
  aiInstruction?: string | null
): Promise<string> {
  const messages = buildRoomChatMessages(history, text, roomId, aiInstruction);
  const generateNode = makeGenerateNode(defaultGateway.streamChat.bind(defaultGateway));
  const result = await runChatGraph(
    {
      threadId: roomId,
      modelId: DEFAULT_AVA_MODEL_ID,
      agentId: DEFAULT_AVA_AGENT_ID,
      toolIds: DEFAULT_AVA_TOOL_IDS,
      messages,
    },
    generateNode
  );
  return result.reply;
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

/** 发送一条用户消息并调 CAP-AI 网关生成真实回复（p18 room-ava F05：接通真实链路，
 *  替换此前的固定占位字符串）；两条都持久化，线程 updated_at 刷新。
 *  uc-rr-010（p20/F11）：房间任一线程发消息都会把 rooms.ai_instruction 注入系统提示
 *  （同房间全部线程共享同一指令），调用方从 getRoomAiInstruction(roomId) 取值传入。 */
export async function sendRoomChatMessage(
  chatId: number,
  roomId: number,
  text: string,
  aiInstruction?: string | null
): Promise<{ userMessage: RoomChatMessage; replyMessage: RoomChatMessage }> {
  const priorHistory = await listRoomChatMessages(chatId);
  const userMessage = await insertMessage(chatId, roomId, "user", text.trim());
  const replyText = await generateRoomChatReply(priorHistory, roomId, text, aiInstruction);
  const replyMessage = await insertMessage(chatId, roomId, "assistant", replyText);
  await query(`UPDATE room_chats SET updated_at = now() WHERE id = $1`, [chatId]);
  return { userMessage, replyMessage };
}
