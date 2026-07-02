// apps/web/app/api/ava/threads/[id]/messages/[messageId]/route.ts — F03 编辑/删除最后一次 AVA 请求
import {
  deleteLastAvaUserMessageAndFollowing,
  getAvaThread,
  listAvaMessages,
  replaceLastAvaUserMessageAndDeleteFollowing,
} from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";
import { createAvaReplyStreamResponse } from "../reply-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseIds(params: { id: string; messageId: string }): { threadId: number; messageId: number } | undefined {
  const threadId = Number(params.id);
  const messageId = Number(params.messageId);
  if (!Number.isFinite(threadId) || !Number.isFinite(messageId)) return undefined;
  return { threadId, messageId };
}

function isThreadInCurrentContext(
  thread: { user_id: number | string; team_id: number | string | null },
  userId: number,
  teamId: number | null
): boolean {
  const sameUser = String(thread.user_id) === String(userId);
  const sameTeam = thread.team_id == null ? teamId == null : teamId != null && String(thread.team_id) === String(teamId);
  return sameUser && sameTeam;
}

async function assertOwner(threadId: number): Promise<Response | undefined> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "未登录" }, { status: 401 });

  const thread = await getAvaThread(threadId);
  // 鉴权同时校验 user_id 与 team_id：与 threads/[id]/route.ts、threads/[id]/messages/route.ts
  // 保持一致，修复 #153 同类跨团队越权读/写风险。
  if (!thread || !isThreadInCurrentContext(thread, user.id, currentTeamId())) {
    return Response.json({ error: "线程不存在" }, { status: 404 });
  }
  return undefined;
}

export async function PATCH(req: Request, { params }: { params: { id: string; messageId: string } }) {
  const ids = parseIds(params);
  if (!ids) return Response.json({ error: "无效的消息 id" }, { status: 400 });

  const ownerError = await assertOwner(ids.threadId);
  if (ownerError) return ownerError;

  const body = (await req.json().catch(() => ({}))) as { text?: unknown };
  const text = String(body.text ?? "").trim();
  if (!text) {
    return Response.json({ errors: { text: "消息不能为空" } }, { status: 400 });
  }

  const updated = await replaceLastAvaUserMessageAndDeleteFollowing(
    ids.threadId,
    ids.messageId,
    text
  );
  if (!updated) {
    return Response.json({ error: "只能编辑最后一条用户消息" }, { status: 409 });
  }

  const history = await listAvaMessages(ids.threadId);
  return createAvaReplyStreamResponse({
    threadId: ids.threadId,
    history,
    initialEvent: { event: "updated", data: { message: updated } },
    status: 200,
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string; messageId: string } }) {
  const ids = parseIds(params);
  if (!ids) return Response.json({ error: "无效的消息 id" }, { status: 400 });

  const ownerError = await assertOwner(ids.threadId);
  if (ownerError) return ownerError;

  const deleted = await deleteLastAvaUserMessageAndFollowing(ids.threadId, ids.messageId);
  if (!deleted) {
    return Response.json({ error: "只能删除最后一次请求" }, { status: 409 });
  }

  return Response.json({ ok: true });
}
