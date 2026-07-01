// apps/web/app/api/ava/threads/[id]/route.ts — 单个 AVA 线程详情（P9 F01/F08）
//
// GET /api/ava/threads/:id — 线程 + 历史消息（含每条消息的附件，仅本人线程可访问）。
import { NextResponse } from "next/server";
import { getAvaThread, listAvaMessages, listAvaAttachmentsByMessageIds } from "@repo/data";
import { currentUser, currentTeamId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const threadId = Number(params.id);
  if (!Number.isFinite(threadId)) return NextResponse.json({ error: "无效的线程 id" }, { status: 400 });

  const thread = await getAvaThread(threadId);
  // 鉴权同时校验 user_id 与 team_id：修复 #153（跨团队用可枚举的线程 id 越权读取）。
  if (!thread || thread.user_id !== user.id || thread.team_id !== currentTeamId()) {
    return NextResponse.json({ error: "线程不存在" }, { status: 404 });
  }

  const messages = await listAvaMessages(threadId);
  const attachmentsByMessage = await listAvaAttachmentsByMessageIds(messages.map((m) => m.id));
  const messagesWithAttachments = messages.map((m) => ({
    ...m,
    attachments: attachmentsByMessage.get(m.id) ?? [],
  }));
  return NextResponse.json({ thread, messages: messagesWithAttachments });
}
