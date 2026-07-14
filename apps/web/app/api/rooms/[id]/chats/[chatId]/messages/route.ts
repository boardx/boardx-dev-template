import { NextResponse } from "next/server";
import {
  canViewRoom,
  getRoomAiInstruction,
  getRoomChat,
  listRoomChatMessages,
  resolveRoomId,
  sendRoomChatMessage,
} from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/rooms/:id/chats/:chatId/messages — 线程消息（房间成员可查看）。
export async function GET(_req: Request, { params }: { params: { id: string; chatId: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const roomId = await resolveRoomId(params.id);
  if (!(await canViewRoom(roomId, user.id))) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  const chat = await getRoomChat(Number(params.chatId));
  if (!chat || Number(chat.room_id) !== roomId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const messages = await listRoomChatMessages(chat.id);
  return NextResponse.json({ messages });
}

// POST /api/rooms/:id/chats/:chatId/messages — 发送一条消息，返回用户消息 + AVA 真实回复
// （p18 room-ava F05：接通 CAP-AI 网关，不再是固定占位字符串）。
// 仅线程创建者可发送（与只读规则一致）；空文本 400。
export async function POST(req: Request, { params }: { params: { id: string; chatId: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const roomId = await resolveRoomId(params.id);
    if (!(await canViewRoom(roomId, user.id))) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }
    const chat = await getRoomChat(Number(params.chatId));
    if (!chat || Number(chat.room_id) !== roomId) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    if (chat.creator_user_id !== user.id) {
      return NextResponse.json({ error: "仅创建者可发送" }, { status: 403 });
    }
    const body = (await req.json().catch(() => ({}))) as { text?: string };
    const text = (body.text ?? "").trim();
    if (!text) return NextResponse.json({ error: "消息不能为空" }, { status: 400 });
    // uc-rr-010（p20/F11）：同房间全部线程共享同一 ai_instruction，注入系统提示（桩层）。
    const aiInstruction = await getRoomAiInstruction(roomId);
    const result = await sendRoomChatMessage(chat.id, roomId, text, aiInstruction);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[rooms/chats/messages] POST failed:", err);
    return NextResponse.json({ error: "发送失败，请重试" }, { status: 500 });
  }
}
