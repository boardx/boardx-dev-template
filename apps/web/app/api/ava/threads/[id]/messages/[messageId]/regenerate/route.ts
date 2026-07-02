// apps/web/app/api/ava/threads/[id]/messages/[messageId]/regenerate/route.ts
// — P9 F11 重新生成最后一条 assistant 回复
//
// POST /api/ava/threads/:id/messages/:messageId/regenerate
//  1. 校验登录 + 线程属主（含 team_id）+ messageId 必须是该线程当前最后一条消息且角色为
//     assistant（防止对历史消息重新生成，破坏线程顺序）。
//  2. 删除该 assistant 消息，保留其前面的原问题（最后一条 user 消息）不动——不丢原问题。
//  3. 复用 reply-stream 的 SSE 生成管线，对保留下来的 history 重新请求一次回复，
//     客户端据此展示"生成中"态直到收到 done/error 事件。
import {
  deleteLastAvaAssistantMessageForRegenerate,
  getAvaThread,
  listAvaMessages,
} from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";
import { createAvaReplyStreamResponse } from "../../reply-stream";

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

export async function POST(_req: Request, { params }: { params: { id: string; messageId: string } }) {
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

  const deleted = await deleteLastAvaAssistantMessageForRegenerate(threadId, messageId);
  if (!deleted) {
    return Response.json({ error: "只能对最后一条回复重新生成" }, { status: 409 });
  }

  const history = await listAvaMessages(threadId);
  return createAvaReplyStreamResponse({
    threadId,
    history,
    status: 200,
  });
}
