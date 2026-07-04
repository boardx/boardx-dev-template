// apps/web/app/api/ava/threads/[id]/research/[sessionId]/route.ts — 推进研究阶段（P18 F03）
//
// PATCH：客户端在确认计划 / 逐阶段完成时调用，把当前 status + timeline 写回
// ava_research_sessions——这是"中断前处于哪个阶段"的权威写入点。前端仍然用本地
// 定时器做阶段推进的视觉呈现（F04 落地前没有真实的异步研究引擎），但每次状态变化
// 都持久化，使得动画进行到一半时刷新页面也能恢复到正确的中间阶段，而不是跳回
// draft 或直接呈现最终态。
import { NextResponse } from "next/server";
import {
  getAvaThread,
  getAvaResearchSession,
  updateAvaResearchSessionProgress,
  type AvaResearchStatus,
  type AvaResearchTimelineItem,
} from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";
import { isThreadInCurrentContext } from "@/lib/ava-thread-auth";

const VALID_STATUSES: AvaResearchStatus[] = ["draft", "running", "complete", "error"];

interface AdvanceBody {
  status?: unknown;
  timeline?: unknown;
}

function isValidTimeline(value: unknown): value is AvaResearchTimelineItem[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (item) =>
      item &&
      typeof item === "object" &&
      typeof (item as Record<string, unknown>).phase === "string" &&
      typeof (item as Record<string, unknown>).task === "string" &&
      ["queued", "running", "complete"].includes((item as Record<string, unknown>).status as string)
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; sessionId: string } }
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const threadId = Number(params.id);
  const sessionId = Number(params.sessionId);
  if (!Number.isFinite(threadId) || !Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "无效的 id" }, { status: 400 });
  }

  const thread = await getAvaThread(threadId);
  if (!thread || !isThreadInCurrentContext(thread, user.id, currentTeamId())) {
    return NextResponse.json({ error: "线程不存在" }, { status: 404 });
  }

  const session = await getAvaResearchSession(sessionId);
  // 注意：bigint 列经 node-postgres 以字符串形式返回（同 ava-thread-auth.ts 的既有约定），
  // 严格 !== 比较 number 和 string 恒为真，必须先归一化再比较。
  if (!session || String(session.thread_id) !== String(threadId)) {
    return NextResponse.json({ error: "研究会话不存在" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as AdvanceBody;
  const status =
    typeof body.status === "string" && VALID_STATUSES.includes(body.status as AvaResearchStatus)
      ? (body.status as AvaResearchStatus)
      : undefined;
  const timeline = isValidTimeline(body.timeline) ? body.timeline : undefined;

  if (!status && !timeline) {
    return NextResponse.json({ error: "缺少 status 或 timeline" }, { status: 400 });
  }

  const updated = await updateAvaResearchSessionProgress(sessionId, { status, timeline });
  return NextResponse.json({ session: updated });
}
