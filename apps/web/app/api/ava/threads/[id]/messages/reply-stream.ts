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
}): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseEvent(event, data)));
      };

      if (input.initialEvent) {
        send(input.initialEvent.event, input.initialEvent.data);
      }

      const placeholder = await insertAvaMessage(input.threadId, "assistant", "", "failed");

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
            onToken: (token) => send("token", { token }),
          },
          generateNode
        );

        await updateAvaMessage(placeholder.id, result.reply, "complete");
        await touchAvaThread(input.threadId);
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
    status: input.status ?? 201,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
