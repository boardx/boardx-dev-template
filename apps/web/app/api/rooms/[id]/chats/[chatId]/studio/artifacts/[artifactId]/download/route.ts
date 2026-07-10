import { NextResponse } from "next/server";
import { canViewRoom, getRoomChat, getStudioArtifact, resolveRoomId } from "@repo/data";
import { presignGetUrl } from "@repo/storage";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/rooms/:id/chats/:chatId/studio/artifacts/:artifactId/download
// 已就绪制品的临时下载/播放/预览直链（presigned，5 分钟过期），不泄露对象存储直链/凭据。
export async function GET(
  _req: Request,
  { params }: { params: { id: string; chatId: string; artifactId: string } }
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

    const artifact = await getStudioArtifact(params.artifactId);
    if (!artifact || artifact.chat_id !== chat.id) {
      return NextResponse.json({ error: "制品不存在" }, { status: 404 });
    }
    if (artifact.status !== "ready" || !artifact.object_key) {
      return NextResponse.json({ error: "制品尚未就绪" }, { status: 409 });
    }

    const url = await presignGetUrl(artifact.object_key);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("GET studio/artifacts/download 失败：", err);
    return NextResponse.json({ error: "生成下载链接失败，请重试" }, { status: 500 });
  }
}
