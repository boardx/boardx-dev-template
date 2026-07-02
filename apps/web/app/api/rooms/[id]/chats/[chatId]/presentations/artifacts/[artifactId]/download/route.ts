import { NextResponse } from "next/server";
import { canViewRoom, getRoomChat, getPresentationArtifact } from "@repo/data";
import { presignGetUrl } from "@repo/storage";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/rooms/:id/chats/:chatId/presentations/artifacts/:artifactId/download?format=pptx|pdf
// 已就绪制品的临时下载直链（presigned，5 分钟过期），不泄露对象存储直链/凭据。
// 默认 format=pptx（未识别的 format 值同样回退到 pptx）。
export async function GET(
  req: Request,
  { params }: { params: { id: string; chatId: string; artifactId: string } }
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

    const artifact = await getPresentationArtifact(params.artifactId);
    if (!artifact || artifact.chat_id !== chat.id) {
      return NextResponse.json({ error: "制品不存在" }, { status: 404 });
    }
    if (artifact.status !== "ready" || !artifact.pptx_object_key || !artifact.pdf_object_key) {
      return NextResponse.json({ error: "制品尚未就绪" }, { status: 409 });
    }

    const format = new URL(req.url).searchParams.get("format");
    const objectKey = format === "pdf" ? artifact.pdf_object_key : artifact.pptx_object_key;

    const url = await presignGetUrl(objectKey);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("GET presentations/artifacts/download 失败：", err);
    return NextResponse.json({ error: "生成下载链接失败，请重试" }, { status: 500 });
  }
}
