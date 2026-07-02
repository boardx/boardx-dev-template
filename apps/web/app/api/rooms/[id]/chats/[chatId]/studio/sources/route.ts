import { NextResponse } from "next/server";
import { canViewRoom, getRoom, getRoomChat, listRoomChatMessages } from "@repo/data";
import { currentUser } from "@/lib/session";
import { listRoomFiles } from "@/lib/studio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/rooms/:id/chats/:chatId/studio/sources — 当前可用来源（供面板决定是否禁用生成）。
// current_chat：当前线程至少已有一条消息。
// room_files：kb_files 表没有 room_id 外键（p10 交付时是用户/团队级知识库，不是房间级），
// 所以"房间文件"只能按现有 schema 近似：团队房间(room.team_id != null) → 该团队全部
// ready 的 kb_files（team scope 天然对同团队成员共享，语义上站得住）；个人房间 → 房间
// **owner** 的 personal scope 文件（不是当前请求者的——否则房间内不同成员会看到彼此互不
// 相关的私人文件集，同一个"房间文件"的说法在不同人眼里对不上）。这仍不是真正的
// "这个房间专属文件"，是已知限制：见 KNOWN LIMITATION 注释与 session-handoff.md。
export async function GET(
  _req: Request,
  { params }: { params: { id: string; chatId: string } }
) {
  try {
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
    const roomFilesCount = room ? (await listRoomFiles(room)).filter((f) => f.status === "ready").length : 0;

    const messages = await listRoomChatMessages(chat.id);

    return NextResponse.json({
      sources: {
        room_files: { available: roomFilesCount > 0, count: roomFilesCount },
        current_chat: { available: messages.length > 0, count: messages.length },
      },
    });
  } catch (err) {
    console.error("GET studio/sources 失败：", err);
    return NextResponse.json({ error: "加载来源可用性失败，请重试" }, { status: 500 });
  }
}
