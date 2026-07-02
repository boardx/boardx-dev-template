// apps/web/app/api/ava/threads/[id]/attachments/[attachmentId]/route.ts — 移除暂存附件（P9 F08）
//
// DELETE：composer 预览条「移除」按钮。只能删除尚未随消息发出（message_id 为空）且属于
// 当前用户的暂存附件；已发出的附件是聊天历史的一部分，不可删除。
import { NextResponse } from "next/server";
import { getAvaThread, deleteAvaAttachmentIfPending } from "@repo/data";
import { deleteObject } from "@repo/storage";
import { currentUser, currentTeamId } from "@/lib/session";
import { isThreadInCurrentContext } from "@/lib/ava-thread-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; attachmentId: string } }
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const threadId = Number(params.id);
  if (!Number.isFinite(threadId)) {
    return NextResponse.json({ error: "无效的线程 id" }, { status: 400 });
  }

  const thread = await getAvaThread(threadId);
  if (!thread || !isThreadInCurrentContext(thread, user.id, currentTeamId())) {
    return NextResponse.json({ error: "线程不存在" }, { status: 404 });
  }

  const deleted = await deleteAvaAttachmentIfPending(params.attachmentId, user.id);
  if (!deleted) {
    return NextResponse.json({ error: "附件不存在或已随消息发出，无法移除" }, { status: 404 });
  }

  try {
    await deleteObject(deleted.object_key);
  } catch (err) {
    // 对象存储删除失败不影响记录已删除的响应（用户视角附件已移除）；记录警告供排查孤儿对象。
    console.error(`ava attachment 对象存储删除失败（key=${deleted.object_key}）：`, err);
  }

  return NextResponse.json({ ok: true });
}
