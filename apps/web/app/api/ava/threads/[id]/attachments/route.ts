// apps/web/app/api/ava/threads/[id]/attachments/route.ts — AVA 聊天附件上传（P9 F08）
//
// POST /api/ava/threads/:id/attachments（multipart/form-data，字段名 file）
//  1. 校验登录 + 线程属主（含 team_id，见下方说明）+ 服务端二次校验类型/大小（不可信前端）。
//  2. 先写对象存储成功后才落 ava_message_attachments 记录（message_id 为空 = 暂存态，
//     供 composer 预览条展示；发消息时再关联到具体消息，见 messages/route.ts）。
//  3. 数量上限（每条消息最多 AVA_MAX_ATTACHMENTS_PER_MESSAGE 个）由前端预览条 + 这里
//     的暂存计数共同把关：已存在的暂存附件数 + 本次 >= 上限则拒绝。
//
// DELETE /api/ava/threads/:id/attachments/:attachmentId 见同目录 [attachmentId]/route.ts。
//
// 复用 p10 CAP-FILE 的对象存储层（@repo/storage），object key 前缀 ava/ 与知识库 kb/ 隔离。
import { NextResponse } from "next/server";
import { getAvaThread, createAvaAttachment } from "@repo/data";
import {
  validateAvaUpload,
  avaAttachmentKind,
  buildAvaObjectKey,
  putObject,
  ensureBucket,
  AVA_MAX_ATTACHMENTS_PER_MESSAGE,
} from "@repo/storage";
import { query } from "@repo/data";
import { currentUser, currentTeamId } from "@/lib/session";
import { isThreadInCurrentContext } from "@/lib/ava-thread-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function countPendingAttachments(threadId: number, ownerUserId: number): Promise<number> {
  const rows = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM ava_message_attachments
     WHERE thread_id = $1 AND owner_user_id = $2 AND message_id IS NULL`,
    [threadId, ownerUserId]
  );
  return Number(rows[0]?.count ?? "0");
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const threadId = Number(params.id);
    if (!Number.isFinite(threadId)) {
      return NextResponse.json({ error: "无效的线程 id" }, { status: 400 });
    }

    const thread = await getAvaThread(threadId);
    // 鉴权同时校验 user_id 与 team_id：线程在某个团队上下文创建，就只能在同一团队上下文
    // 访问，防止跨团队用可枚举的线程 id 越权（见 #153）。
    if (!thread || !isThreadInCurrentContext(thread, user.id, currentTeamId())) {
      return NextResponse.json({ error: "线程不存在" }, { status: 404 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ errors: { file: "缺少文件" } }, { status: 400 });
    }

    // 数量上限：暂存态 + 本次 1 个 超过上限则拒绝，给出可读提示。
    const pendingCount = await countPendingAttachments(threadId, user.id);
    if (pendingCount >= AVA_MAX_ATTACHMENTS_PER_MESSAGE) {
      return NextResponse.json(
        { errors: { count: `每条消息最多附加 ${AVA_MAX_ATTACHMENTS_PER_MESSAGE} 个文件` } },
        { status: 400 }
      );
    }

    // 服务端二次校验（前端预检不可信，防绕过）——不合法就直接拒绝，不写任何存储/DB。
    const validation = validateAvaUpload(file.name, file.size);
    if (!validation.ok) {
      const field = validation.reason === "unsupported_type" ? "type" : "size";
      return NextResponse.json({ errors: { [field]: validation.message } }, { status: 400 });
    }

    const attachmentId = `avaatt_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const objectKey = buildAvaObjectKey({ ownerId: user.id, attachmentId, fileName: file.name });

    // 先写对象存储；失败则直接报错，不产生半条记录。
    try {
      await ensureBucket();
      const buffer = Buffer.from(await file.arrayBuffer());
      await putObject(objectKey, buffer, file.type || "application/octet-stream");
    } catch (err) {
      return NextResponse.json({ error: `对象存储写入失败：${String(err)}` }, { status: 502 });
    }

    const attachment = await createAvaAttachment({
      id: attachmentId,
      threadId,
      ownerUserId: user.id,
      kind: avaAttachmentKind(file.name),
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      objectKey,
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
