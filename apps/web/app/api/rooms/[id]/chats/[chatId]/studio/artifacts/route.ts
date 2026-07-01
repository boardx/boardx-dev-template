import { NextResponse } from "next/server";
import { canViewRoom, getRoomChat, listStudioArtifactsByChat } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/rooms/:id/chats/:chatId/studio/artifacts — 线程内 Studio 制品列表（含进度中/失败）。
// 前端轮询本接口驱动「生成中 → ready/error」的面板 + 聊天结果卡片状态刷新。
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

  const artifacts = await listStudioArtifactsByChat(chat.id);
  return NextResponse.json({ artifacts });
}
