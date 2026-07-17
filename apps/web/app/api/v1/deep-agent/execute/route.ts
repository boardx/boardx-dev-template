import { NextRequest, NextResponse } from "next/server";
import {
  getAvaThread,
  insertAvaMessage,
  renameAvaThreadIfDefault,
  titleFromMessage,
  touchAvaThread,
  updateAvaMessage,
} from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";
import { isThreadInCurrentContext } from "@/lib/ava-thread-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
const SSE_HEARTBEAT_INTERVAL_MS = 15_000;
const SSE_HEARTBEAT_CHUNK = ": keepalive\n\n";

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getRequestInput(body: Record<string, unknown>): string {
  return pickString(body.input) ?? pickString(body.prompt) ?? pickString(body.message) ?? "";
}

function getThreadId(req: NextRequest, body: Record<string, unknown>): number | null {
  const raw = req.headers.get("X-Chat-Thread-Id") ?? body.chatId ?? body.chatThreadId;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

function createHeartbeatSseStream(
  upstreamBody: ReadableStream<Uint8Array>,
  abortSignal: AbortSignal
): ReadableStream<Uint8Array> {
  const reader = upstreamBody.getReader();
  const encoder = new TextEncoder();
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const cleanup = () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    abortSignal.removeEventListener("abort", handleAbort);
  };

  const handleAbort = () => {
    if (closed) return;
    closed = true;
    cleanup();
    reader.cancel().catch(() => undefined);
  };

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      abortSignal.addEventListener("abort", handleAbort);
      heartbeatTimer = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(SSE_HEARTBEAT_CHUNK));
      }, SSE_HEARTBEAT_INTERVAL_MS);

      try {
        while (!closed) {
          const { done, value } = await reader.read();
          if (done) {
            closed = true;
            cleanup();
            controller.close();
            return;
          }
          if (value) controller.enqueue(value);
        }
      } catch (err) {
        if (!closed) {
          closed = true;
          cleanup();
          controller.error(err);
        }
      }
    },
    cancel() {
      if (closed) return;
      closed = true;
      cleanup();
      reader.cancel().catch(() => undefined);
    },
  });
}

async function proxyToBackend(req: NextRequest, body: Record<string, unknown>): Promise<Response> {
  const authHeader = req.headers.get("authorization") || "";
  const threadId = req.headers.get("X-Chat-Thread-Id") || pickString(body.chatId) || pickString(body.chatThreadId) || "";
  const upstream = await fetch(`${BACKEND_BASE_URL}/v1/deep-agent/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(authHeader ? { Authorization: authHeader } : {}),
      ...(threadId ? { "X-Chat-Thread-Id": threadId } : {}),
    },
    body: JSON.stringify(body),
    signal: req.signal,
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: "Deep agent backend request failed", detail: text || upstream.statusText },
      { status: upstream.status }
    );
  }

  if (!upstream.body) {
    return NextResponse.json({ error: "Deep agent backend response body is empty" }, { status: 502 });
  }

  return new Response(createHeartbeatSseStream(upstream.body, req.signal), {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "text/event-stream",
      "Cache-Control": upstream.headers.get("Cache-Control") || "no-cache, no-transform",
      Connection: upstream.headers.get("Connection") || "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Deep-Agent-Backend": "proxy",
    },
  });
}

async function createLocalDeepAgentStub(req: NextRequest, body: Record<string, unknown>): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const threadId = getThreadId(req, body);
  if (threadId == null) return NextResponse.json({ error: "Invalid chat thread" }, { status: 400 });

  const thread = await getAvaThread(threadId);
  if (!thread || !isThreadInCurrentContext(thread, user.id, currentTeamId())) {
    return NextResponse.json({ error: "线程不存在" }, { status: 404 });
  }

  const input = getRequestInput(body);
  if (!input) return NextResponse.json({ errors: { input: "消息不能为空" } }, { status: 400 });

  const userMessage = await insertAvaMessage(threadId, "user", input);
  await renameAvaThreadIfDefault(threadId, titleFromMessage(input));
  const placeholder = await insertAvaMessage(threadId, "assistant", "", "failed");

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(sseEvent(event, data)));
      const reply = [
        "🤖 Deep Agent 已接入当前 AVA 线程。",
        "",
        `收到任务：「${input}」。`,
        "当前本地未配置 `NEXT_PUBLIC_API_URL`，所以返回 deep-agent stub；配置后会代理到 boardx-backend `/v1/deep-agent/execute`。",
        "",
        "- executionMode: tool-auto",
        "- toolScope: agent",
        "- 支持旧版 deep_agent SSE 事件解析",
      ].join("\n");

      send("user", { message: userMessage, attachments: [] });
      send("progress", { type: "progress", stage: "prepare", message: "Deep Agent preparing workspace" });
      for (const token of reply.match(/.{1,12}/gs) ?? [reply]) {
        if (req.signal.aborted) break;
        send("chunk", { type: "chunk", content: token });
        await new Promise((resolve) => setTimeout(resolve, 8));
      }
      await updateAvaMessage(placeholder.id, reply, "complete");
      await touchAvaThread(threadId);
      send("done", {
        type: "done",
        message: { ...placeholder, content: reply, status: "complete" },
      });
      controller.close();
    },
  });

  return new Response(stream, {
    status: 201,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Deep-Agent-Backend": "local-stub",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (BACKEND_BASE_URL) return proxyToBackend(req, body);
    return createLocalDeepAgentStub(req, body);
  } catch (err) {
    console.error("[deep-agent/execute POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
