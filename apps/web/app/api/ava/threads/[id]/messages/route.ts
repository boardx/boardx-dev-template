// apps/web/app/api/ava/threads/[id]/messages/route.ts — 发消息 + AI 流式回复（P9 F01）
//
// POST /api/ava/threads/:id/messages
//  1. 校验登录 + 线程属主 + 非空文本。
//  2. 落库用户消息（立即持久化，即使后续生成失败也不丢）。
//  3. 用 CAP-AI 网关（packages/ai）流式生成回复，通过 SSE 边生成边推给客户端。
//  4. 生成成功：落库完整 assistant 消息（status=complete），首条消息成功后按需重命名线程标题。
//     生成失败：落库一条 status=failed 的 assistant 消息（内容为空提示失败），SSE 发 error 事件。
//
// SSE 事件类型：
//   event: user     — 用户消息已持久化（含 id），供客户端立即渲染。
//   event: token    — 逐 token 增量文本。
//   event: done     — 生成完成，携带完整 assistant 消息记录。
//   event: error    — 生成失败，携带失败态 assistant 消息记录（用户输入已保留在 event:user）。
import {
  getAvaThread,
  insertAvaMessage,
  listAvaMessages,
  renameAvaThreadIfDefault,
  titleFromMessage,
  touchAvaThread,
} from "@repo/data";
import { currentUser } from "@/lib/session";
import { createAvaReplyStreamResponse } from "./reply-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return new Response(JSON.stringify({ error: "未登录" }), { status: 401 });

  const threadId = Number(params.id);
  if (!Number.isFinite(threadId)) {
    return new Response(JSON.stringify({ error: "无效的线程 id" }), { status: 400 });
  }

  const thread = await getAvaThread(threadId);
  if (!thread || thread.user_id !== user.id) {
    return new Response(JSON.stringify({ error: "线程不存在" }), { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { text?: unknown };
  const text = String(body.text ?? "").trim();
  if (!text) {
    return new Response(JSON.stringify({ errors: { text: "消息不能为空" } }), { status: 400 });
  }

  // 用户消息先落库：即使下面生成失败，用户输入也不会丢失。
  const userMessage = await insertAvaMessage(threadId, "user", text);
  await renameAvaThreadIfDefault(threadId, titleFromMessage(text));
  await touchAvaThread(threadId);

  const history = await listAvaMessages(threadId);

  return createAvaReplyStreamResponse({
    threadId,
    history,
    initialEvent: { event: "user", data: { message: userMessage } },
    status: 201,
  });
}
