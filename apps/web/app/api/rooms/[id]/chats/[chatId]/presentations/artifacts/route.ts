import { NextResponse } from "next/server";
import { canViewRoom, getRoomChat, listPresentationArtifactsByChat } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/rooms/:id/chats/:chatId/presentations/artifacts — 线程内演示文稿制品列表
// （含进度中/失败）。前端轮询本接口驱动「生成中 → ready/error」的预览卡片状态刷新。
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

    const artifacts = await listPresentationArtifactsByChat(chat.id);
    return NextResponse.json({ artifacts });
  } catch (err) {
    console.error("GET presentations/artifacts 失败：", err);
    return NextResponse.json({ error: "加载制品列表失败，请重试" }, { status: 500 });
  }
}
