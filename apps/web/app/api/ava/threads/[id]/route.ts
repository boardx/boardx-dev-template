// apps/web/app/api/ava/threads/[id]/route.ts — 单个 AVA 线程详情（P9 F01/F08）
//
// GET    /api/ava/threads/:id — 线程 + 历史消息（含每条消息的附件，仅本人当前团队上下文可访问）。
// PATCH  /api/ava/threads/:id — 重命名当前团队上下文内的本人线程。
// DELETE /api/ava/threads/:id — 删除当前团队上下文内的本人线程（消息级联删除）。
import { NextResponse } from "next/server";
import {
  deleteAvaThread,
  getAvaThread,
  listAvaAttachmentsByMessageIds,
  listAvaMessageFeedbackByMessageIds,
  listAvaMessages,
  renameAvaThread,
} from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";
import { isThreadInCurrentContext } from "@/lib/ava-thread-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const threadId = Number(params.id);
  if (!Number.isFinite(threadId)) return NextResponse.json({ error: "无效的线程 id" }, { status: 400 });

  const thread = await getAvaThread(threadId);
  // 鉴权同时校验 user_id 与 team_id：修复 #153（跨团队用可枚举的线程 id 越权读取）。
  if (!thread || !isThreadInCurrentContext(thread, user.id, currentTeamId())) {
    return NextResponse.json({ error: "线程不存在" }, { status: 404 });
  }

  const messages = await listAvaMessages(threadId);
  const messageIds = messages.map((m) => m.id);
  const attachmentsByMessage = await listAvaAttachmentsByMessageIds(messageIds);
  const feedbackByMessage = await listAvaMessageFeedbackByMessageIds(messageIds, user.id);
  const messagesWithAttachments = messages.map((m) => ({
    ...m,
    attachments: attachmentsByMessage.get(m.id) ?? [],
    feedback: feedbackByMessage.get(m.id) ?? null,
  }));
  return NextResponse.json({ thread, messages: messagesWithAttachments });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const threadId = Number(params.id);
    if (!Number.isFinite(threadId)) return NextResponse.json({ error: "无效的线程 id" }, { status: 400 });
    const body = (await req.json().catch(() => ({}))) as { title?: unknown };
    const title = String(body.title ?? "").trim().replace(/\s+/g, " ");
    if (!title) return NextResponse.json({ errors: { title: "标题不能为空" } }, { status: 400 });
    if (title.length > 120) return NextResponse.json({ errors: { title: "标题不能超过 120 个字符" } }, { status: 400 });
    const thread = await renameAvaThread(threadId, user.id, currentTeamId(), title);
    if (!thread) return NextResponse.json({ error: "线程不存在" }, { status: 404 });
    return NextResponse.json({ thread });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const threadId = Number(params.id);
    if (!Number.isFinite(threadId)) return NextResponse.json({ error: "无效的线程 id" }, { status: 400 });
    const deleted = await deleteAvaThread(threadId, user.id, currentTeamId());
    if (!deleted) return NextResponse.json({ error: "线程不存在" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
