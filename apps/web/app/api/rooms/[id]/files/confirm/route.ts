import { NextResponse } from "next/server";
import { canViewRoom, createRoomFile, getRoom, getRoomChat, resolveRoomId } from "@repo/data";
import { validateRoomFileUpload, extOf, buildRoomFileObjectKey } from "@repo/storage";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// fileId 必须匹配预签名阶段（/api/rooms/:id/files POST）签发的格式，且不得含路径分隔符——
// 它会被直接拼进对象存储 key，必须先校验格式再拼接，防止路径穿越/跨命名空间注入。
const FILE_ID_PATTERN = /^rmf_\d+_\d+$/;

// POST /api/rooms/:id/files/confirm — 上传第二步：前端已用 presigned PUT 直传对象存储成功，
// 这里才真正落库（room_id 恒非空；chatThreadId 可选，仅作来源标注，不构成绑定）。
// 不重新校验对象是否真的存在于存储（信任直传已成功，与 confirm 语义一致）；但仍对
// 文件名/大小做与预签名阶段同口径的二次校验，防止绕过第一步直接伪造 confirm 请求。
//
// 安全：storage_path 绝不信任客户端传入的 objectKey——必须由服务端用当前 URL 里的
// roomId（可信上下文，非客户端可控）+ 校验过格式的 fileId 重新推导，与预签名阶段
// 用的是同一个纯函数（buildRoomFileObjectKey）。否则任何房间的合法成员都能在
// confirm 时把 objectKey 伪造成别的房间/别的命名空间（如 kb/...）的对象 key，
// 落库成自己房间的一条文件记录，再通过 preview 拿到指向他人数据的签名 URL——
// 跨房间/跨模块越权读取。客户端传来的 objectKey 只用于兼容旧调用方传参，不参与计算。
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const roomId = await resolveRoomId(params.id);
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

    if (!fileId || !fileName) {
      return NextResponse.json({ error: "缺少必要字段" }, { status: 400 });
    }
    if (!FILE_ID_PATTERN.test(fileId)) {
      return NextResponse.json({ error: "fileId 格式无效" }, { status: 400 });
    }
    // chatThreadId 仅作来源标注（非绑定），但仍需确认该线程确实属于当前房间，
    // 防止把文件标注成挂到别的房间的线程下（影响面小，仅来源标注维度）。
    if (chatThreadId !== null) {
      const chat = await getRoomChat(chatThreadId);
      // room_id 是 bigint，node-postgres 回传为字符串，需 String() 归一化后比较
      // （同一个陷阱在 F02/F05 已踩过）。
      if (!chat || String(chat.room_id) !== String(roomId)) {
        return NextResponse.json({ error: "chatThreadId 不属于当前房间" }, { status: 400 });
      }
    }

    const validation = validateRoomFileUpload(fileName, fileSize);
    if (!validation.ok) {
      const field = validation.reason === "unsupported_type" ? "type" : "size";
      return NextResponse.json({ errors: { [field]: validation.message } }, { status: 400 });
    }

    // 服务端重新推导 storage_path（不信任客户端传入的 objectKey，见上方安全注释）。
    const storagePath = buildRoomFileObjectKey({ roomId, fileId, fileName });

    const file = await createRoomFile({
      id: fileId,
      roomId,
      chatThreadId,
      uploaderId: user.id,
      fileName,
      fileType: extOf(fileName),
      fileSize,
      storagePath,
    });

    return NextResponse.json({ file }, { status: 201 });
  } catch (err) {
    console.error("[rooms/files/confirm] 操作失败:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
