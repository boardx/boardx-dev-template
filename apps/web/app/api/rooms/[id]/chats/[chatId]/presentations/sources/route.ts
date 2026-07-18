import { NextResponse } from "next/server";
import { canViewRoom, getRoom, getRoomChat, listRoomChatMessages, resolveRoomId } from "@repo/data";
import { currentUser } from "@/lib/session";
import { listRoomFiles } from "@/lib/studio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/rooms/:id/chats/:chatId/presentations/sources — 当前可用来源（供配置弹窗
// 决定是否禁用生成）。current_chat/room_files 复用与 Studio（p12-F01）相同的判定逻辑
// （见 apps/web/lib/studio.ts 的 KNOWN LIMITATION 注释）；instructions 来源无固定可用性
// 判定——是否可生成取决于用户是否填写了说明文本，交由前端就地校验。
export async function GET(
  _req: Request,
  { params }: { params: { id: string; chatId: string } }
) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const roomId = await resolveRoomId(params.id);
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
        current_chat: { available: messages.length > 0, count: messages.length },
        room_files: { available: roomFilesCount > 0, count: roomFilesCount },
        instructions: { available: true, count: 0 },
      },
    });
  } catch (err) {
    console.error("GET presentations/sources 失败：", err);
    return NextResponse.json({ error: "加载来源可用性失败，请重试" }, { status: 500 });
  }
}
