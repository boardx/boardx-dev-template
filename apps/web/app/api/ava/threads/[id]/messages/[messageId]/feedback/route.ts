// apps/web/app/api/ava/threads/[id]/messages/[messageId]/feedback/route.ts
// — P9 F11 消息反馈（点赞/点踩）
//
// POST /api/ava/threads/:id/messages/:messageId/feedback  { rating: "up" | "down" }
//  校验登录 + 线程属主（含 team_id）+ 目标消息属于该线程且角色为 assistant（反馈只作用于
//  AI 回复，不作用于用户自己的消息）。同一用户对同一条消息重复提交按最新一次覆盖（upsert）。
import { getAvaThread, listAvaMessages, upsertAvaMessageFeedback } from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isThreadInCurrentContext(
  thread: { user_id: number | string; team_id: number | string | null },
  userId: number,
  teamId: number | null
): boolean {
  const sameUser = String(thread.user_id) === String(userId);
  const sameTeam = thread.team_id == null ? teamId == null : teamId != null && String(thread.team_id) === String(teamId);
  return sameUser && sameTeam;
}

export async function POST(req: Request, { params }: { params: { id: string; messageId: string } }) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "未登录" }, { status: 401 });

  const threadId = Number(params.id);
  const messageId = Number(params.messageId);
  if (!Number.isFinite(threadId) || !Number.isFinite(messageId)) {
    return Response.json({ error: "无效的消息 id" }, { status: 400 });
  }

  const thread = await getAvaThread(threadId);
  // 鉴权同时校验 user_id 与 team_id：与本目录其余 ava 路由保持一致，防跨团队越权读/写（#153 同类）。
  if (!thread || !isThreadInCurrentContext(thread, user.id, currentTeamId())) {
    return Response.json({ error: "线程不存在" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { rating?: unknown };
  const rating = body.rating;
  if (rating !== "up" && rating !== "down") {
    return Response.json({ error: "无效的反馈类型" }, { status: 400 });
  }

  const messages = await listAvaMessages(threadId);
  // pg 驱动把 bigint 列（id）以字符串形式返回，用 String() 归一化再比较，避免 "13" !== 13。
  const target = messages.find((m) => String(m.id) === String(messageId));
  if (!target || target.role !== "assistant") {
    return Response.json({ error: "只能对 AI 回复提交反馈" }, { status: 404 });
  }

  const feedback = await upsertAvaMessageFeedback(messageId, user.id, rating);
  return Response.json({ feedback }, { status: 200 });
}
