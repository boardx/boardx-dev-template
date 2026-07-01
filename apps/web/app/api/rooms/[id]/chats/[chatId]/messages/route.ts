import { NextResponse } from "next/server";
import { canViewRoom, getRoomChat, listRoomChatMessages, sendRoomChatMessage } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/rooms/:id/chats/:chatId/messages — 线程消息（房间成员可查看）。
export async function GET(_req: Request, { params }: { params: { id: string; chatId: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const roomId = Number(params.id);
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

// POST /api/rooms/:id/chats/:chatId/messages — 发送一条消息，返回用户消息 + AVA 占位回复。
// 仅线程创建者可发送（与只读规则一致）；空文本 400。
export async function POST(req: Request, { params }: { params: { id: string; chatId: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const roomId = Number(params.id);
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
    const result = await sendRoomChatMessage(chat.id, roomId, text);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
