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
  updateAvaMessage,
} from "@repo/data";
import { defaultGateway, DEFAULT_MODEL_ID, runChatGraph, makeGenerateNode } from "@repo/ai";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

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

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseEvent(event, data)));
      };

      send("user", { message: userMessage });

      // 生成态占位消息：先插入一条空内容的 assistant 消息（failed 状态起步，
      // 成功后再回写为 complete + 完整内容），保证异常中断时数据库也有失败态记录。
      const placeholder = await insertAvaMessage(threadId, "assistant", "", "failed");

      try {
        const generateNode = makeGenerateNode(defaultGateway.streamChat.bind(defaultGateway));
        const result = await runChatGraph(
          {
            threadId,
            modelId: DEFAULT_MODEL_ID,
            messages: history.map((m) => ({ role: m.role, content: m.content })),
            onToken: (token) => send("token", { token }),
          },
          generateNode
        );

        await updateAvaMessage(placeholder.id, result.reply, "complete");
        await touchAvaThread(threadId);
        send("done", {
          message: { ...placeholder, content: result.reply, status: "complete" },
        });
      } catch (err) {
        const failMessage = "AVA 生成回复失败，请重试。";
        await updateAvaMessage(placeholder.id, failMessage, "failed");
        send("error", {
          message: { ...placeholder, content: failMessage, status: "failed" },
          error: String(err),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 201,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
