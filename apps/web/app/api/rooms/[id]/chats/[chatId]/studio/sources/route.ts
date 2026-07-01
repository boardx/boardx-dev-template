import { NextResponse } from "next/server";
import { canViewRoom, getRoom, getRoomChat, listKbFiles, listRoomChatMessages } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/rooms/:id/chats/:chatId/studio/sources — 当前可用来源（供面板决定是否禁用生成）。
// room_files：个人（或房间所属团队）scope 下存在 ready 的 kb_files；
// current_chat：当前线程至少已有一条消息。
export async function GET(
  _req: Request,
  { params }: { params: { id: string; chatId: string } }
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const roomId = Number(params.id);
  if (!(await canViewRoom(roomId, user.id))) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  const chat = await getRoomChat(Number(params.chatId));
  if (!chat || Number(chat.room_id) !== roomId) {
    return NextResponse.json({ error: "线程不存在" }, { status: 404 });
  }

  const room = await getRoom(roomId);
  const files =
    room?.team_id != null
      ? await listKbFiles({ ownerUserId: user.id, scope: "team", teamId: room.team_id })
      : await listKbFiles({ ownerUserId: user.id, scope: "personal" });
  const roomFilesCount = files.filter((f) => f.status === "ready").length;

  const messages = await listRoomChatMessages(chat.id);

  return NextResponse.json({
    sources: {
      room_files: { available: roomFilesCount > 0, count: roomFilesCount },
      current_chat: { available: messages.length > 0, count: messages.length },
    },
  });
}
