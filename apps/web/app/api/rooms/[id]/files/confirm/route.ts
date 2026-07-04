import { NextResponse } from "next/server";
import { getRoom, canViewRoom, createRoomFile } from "@repo/data";
import { validateRoomFileUpload, extOf } from "@repo/storage";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/rooms/:id/files/confirm — 上传第二步：前端已用 presigned PUT 直传对象存储成功，
// 这里才真正落库（room_id 恒非空；chatThreadId 可选，仅作来源标注，不构成绑定）。
// 不重新校验对象是否真的存在于存储（信任直传已成功，与 confirm 语义一致）；但仍对
// 文件名/大小做与预签名阶段同口径的二次校验，防止绕过第一步直接伪造 confirm 请求。
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
      fileId?: unknown;
      objectKey?: unknown;
      fileName?: unknown;
      fileSize?: unknown;
      chatThreadId?: unknown;
    };
    const fileId = typeof body.fileId === "string" ? body.fileId : "";
    const objectKey = typeof body.objectKey === "string" ? body.objectKey : "";
    const fileName = typeof body.fileName === "string" ? body.fileName : "";
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : NaN;
    // chatThreadId 可能来自 JSON body 的 number，也可能来自"取上一个 API 响应的 id 原样传回"
    // 这一常见调用方式——而 room_chats.id 是 bigint，node-postgres 把 bigint 序列化成
    // string（避免精度丢失），所以调用方传回的值经常是字符串形态的数字。两种输入都接受，
    // 只有真正无法解析成有限数字时才落回 null（保持"来源标注可选"的语义，不是绑定必填）。
    const rawChatThreadId = body.chatThreadId;
    const chatThreadId =
      typeof rawChatThreadId === "number"
        ? Number.isFinite(rawChatThreadId)
          ? rawChatThreadId
          : null
        : typeof rawChatThreadId === "string" && rawChatThreadId.trim() !== "" && Number.isFinite(Number(rawChatThreadId))
          ? Number(rawChatThreadId)
          : null;

    if (!fileId || !objectKey || !fileName) {
      return NextResponse.json({ error: "缺少必要字段" }, { status: 400 });
    }

    const validation = validateRoomFileUpload(fileName, fileSize);
    if (!validation.ok) {
      const field = validation.reason === "unsupported_type" ? "type" : "size";
      return NextResponse.json({ errors: { [field]: validation.message } }, { status: 400 });
    }

    const file = await createRoomFile({
      id: fileId,
      roomId,
      chatThreadId,
      uploaderId: user.id,
      fileName,
      fileType: extOf(fileName),
      fileSize,
      storagePath: objectKey,
    });

    return NextResponse.json({ file }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
