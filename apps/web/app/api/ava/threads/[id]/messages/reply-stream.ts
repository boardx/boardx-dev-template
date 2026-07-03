import {
  insertAvaMessage,
  touchAvaThread,
  updateAvaMessage,
  type AvaMessage,
} from "@repo/data";
import { defaultGateway, DEFAULT_MODEL_ID, runChatGraph, makeGenerateNode } from "@repo/ai";

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function createAvaReplyStreamResponse(input: {
  threadId: number;
  history: AvaMessage[];
  initialEvent?: { event: string; data: unknown };
  modelId?: string;
  agentId?: string;
  toolIds?: string[];
  status?: number;
  /** P18 F02：客户端点击停止/断开连接时由路由传入的 request.signal，
   *  透传给网关/provider 实现真实中断（而非等待完整回显后再丢弃结果）。 */
  signal?: AbortSignal;
}): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      const send = (event: string, data: unknown) => {
        // 客户端已经 abort：底层连接可能已经关闭，enqueue 会抛错——这种情况下静默丢弃，
        // 不让「停止生成」在服务端表现为未处理异常。
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(sseEvent(event, data)));
        } catch {
          closed = true;
        }
      };

      if (input.initialEvent) {
        send(input.initialEvent.event, input.initialEvent.data);
      }

      const placeholder = await insertAvaMessage(input.threadId, "assistant", "", "failed");
      // 停止生成时用于落库的「已生成部分」——onToken 逐块追加，abort 发生在两个 token 之间时
      // 仍能保留已经吐出来的内容，而不是整段丢弃（比展示空气泡更符合「停止」的直觉）。
      let partial = "";

      try {
        if (input.history.some((m) => m.content.includes("__ava_force_fail__"))) {
          throw new Error("forced AVA failure for e2e");
        }

        const generateNode = makeGenerateNode(defaultGateway.streamChat.bind(defaultGateway));
        const result = await runChatGraph(
          {
            threadId: input.threadId,
            modelId: input.modelId ?? DEFAULT_MODEL_ID,
            agentId: input.agentId,
            toolIds: input.toolIds,
            messages: input.history.map((m) => ({ role: m.role, content: m.content })),
            onToken: (token) => {
              partial += token;
              send("token", { token });
            },
            signal: input.signal,
          },
          generateNode
        );

        await updateAvaMessage(placeholder.id, result.reply, "complete");
        await touchAvaThread(input.threadId);
        send("done", {
          message: { ...placeholder, content: result.reply, status: "complete" },
        });
      } catch (err) {
        // 用户主动停止：AbortError（真实 provider fetch 被 signal 中断）。这不是失败，
        // 是预期的用户操作——落库为 complete（保留已生成的部分内容），不展示失败态。
        const aborted = input.signal?.aborted === true;
        if (aborted) {
          await updateAvaMessage(placeholder.id, partial, "complete");
          await touchAvaThread(input.threadId);
          send("done", {
            message: { ...placeholder, content: partial, status: "complete" },
          });
        } else {
          const failMessage = "AVA 生成回复失败，请重试。";
          await updateAvaMessage(placeholder.id, failMessage, "failed");
          send("error", {
            message: { ...placeholder, content: failMessage, status: "failed" },
            error: String(err),
          });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // 已经因为客户端断开而无法 close，忽略。
        }
      }
    },
  });

  return new Response(stream, {
    status: input.status ?? 201,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
