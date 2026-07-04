import { NextResponse } from "next/server";
import { getRoom, canViewRoom, listRoomFiles } from "@repo/data";
import { validateRoomFileUpload, buildRoomFileObjectKey, presignPutUrl, ensureBucket } from "@repo/storage";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-rr-003-room-level-files — 房间级文件库（p20-F03，推翻 uc-room-005 的线程绑定建模）。
// GET  /api/rooms/:id/files?q=&chatThreadId=：列出房间文件库（房间成员可见，不要求打开任何聊天线程）。
// POST /api/rooms/:id/files：预签名上传第一步——服务端二次校验类型/大小后返回直传用的
// presigned PUT URL；真正落库延后到 /files/confirm（对象存储直传成功后前端再调用）。

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const roomId = Number(params.id);
    const room = await getRoom(roomId);
    if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!(await canViewRoom(roomId, user.id))) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? undefined;
    const chatThreadIdRaw = url.searchParams.get("chatThreadId");
    const chatThreadId = chatThreadIdRaw ? Number(chatThreadIdRaw) : undefined;

    const files = await listRoomFiles({ roomId, chatThreadId, q });
    return NextResponse.json({ files });
  } catch (err) {
    console.error("[rooms/files] 列表加载失败:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const roomId = Number(params.id);
    const room = await getRoom(roomId);
    if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!(await canViewRoom(roomId, user.id))) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      fileName?: unknown;
      fileSize?: unknown;
      contentType?: unknown;
    };
    const fileName = typeof body.fileName === "string" ? body.fileName : "";
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : NaN;
    const contentType = typeof body.contentType === "string" ? body.contentType : "application/octet-stream";

    // 服务端二次校验（前端预检不可信，防绕过）——不合法直接拒绝，不签发直传 URL。
    const validation = validateRoomFileUpload(fileName, fileSize);
    if (!validation.ok) {
      const field = validation.reason === "unsupported_type" ? "type" : "size";
      return NextResponse.json({ errors: { [field]: validation.message } }, { status: 400 });
    }

    const fileId = `rmf_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const objectKey = buildRoomFileObjectKey({ roomId, fileId, fileName });

    await ensureBucket();
    const uploadUrl = await presignPutUrl(objectKey, contentType);

    return NextResponse.json({ fileId, objectKey, uploadUrl }, { status: 200 });
  } catch (err) {
    console.error("[rooms/files] 操作失败:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
