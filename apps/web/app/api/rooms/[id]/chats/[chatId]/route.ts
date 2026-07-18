import { NextResponse } from "next/server";
import { canViewRoom, deleteRoomChat, getRoomChat, resolveRoomId } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/rooms/:id/chats/:chatId — 线程详情 + 当前用户是否可编辑（创建者）。
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
  return NextResponse.json({ chat, canEdit: chat.creator_user_id === user.id });
}

// DELETE /api/rooms/:id/chats/:chatId — 仅创建者可删，否则 403。
export async function DELETE(_req: Request, { params }: { params: { id: string; chatId: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const roomId = await resolveRoomId(params.id);
    const chat = await getRoomChat(Number(params.chatId));
    if (!chat || Number(chat.room_id) !== roomId) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    if (chat.creator_user_id !== user.id) {
      return NextResponse.json({ error: "仅创建者可删除" }, { status: 403 });
    }
    await deleteRoomChat(chat.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
