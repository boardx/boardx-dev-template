// packages/ai/src/qwenProvider.ts — 千问 / DashScope OpenAI-compatible provider
//
// BoardX backend 的 Deep Agent 默认走 DashScope 千问模型；AVA 本地网关也需要同一条
// 真实模型路径，避免普通 /messages 仍落回 stub。这里沿用现有自研 gateway/provider 契约，
// 不引入 SDK，直接解析 OpenAI-compatible SSE。
import type { ChatMessage, ChatProvider, StreamChatInput, TokenStream } from "./gateway";

export const QWEN_MODEL_PREFIX = "qwen";
export const DEFAULT_QWEN_MODEL_ID = "qwen3.7-max";
export const DEFAULT_DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const DEFAULT_TIMEOUT_MS = 60_000;

export interface QwenProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface QwenStreamChunk {
  choices?: Array<{
    delta?: { content?: string };
    message?: { content?: string };
  }>;
  error?: { message?: string; code?: string };
}

function buildRequestBody(input: StreamChatInput): {
  model: string;
  stream: true;
  enable_thinking: false;
  stream_options: { include_usage: true };
  messages: Array<{ role: ChatMessage["role"]; content: string }>;
} {
  return {
    model: input.modelId.trim() || DEFAULT_QWEN_MODEL_ID,
    stream: true,
    enable_thinking: false,
    stream_options: { include_usage: true },
    messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
  };
}

async function* parseOpenAiCompatibleSse(
  body: NonNullable<Response["body"]>
): AsyncGenerator<QwenStreamChunk, void, void> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trimEnd();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === "[DONE]") continue;
        try {
          yield JSON.parse(raw) as QwenStreamChunk;
        } catch {
          // 跳过非 JSON data 行，避免单行脏数据中断整个流。
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function createQwenProvider(options: QwenProviderOptions = {}): ChatProvider {
  const resolveKey = () => options.apiKey ?? process.env.DASHSCOPE_API_KEY ?? process.env.QWEN_API_KEY ?? "";
  const baseUrl = (
    options.baseUrl ??
    process.env.DASHSCOPE_BASE_URL ??
    DEFAULT_DASHSCOPE_BASE_URL
  ).replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const envTimeoutMs = Number(process.env.QWEN_TIMEOUT_MS ?? process.env.DASHSCOPE_TIMEOUT_MS);
  const timeoutMs =
    options.timeoutMs ?? (Number.isFinite(envTimeoutMs) && envTimeoutMs > 0
      ? envTimeoutMs
      : DEFAULT_TIMEOUT_MS);

  return {
    matches(modelId: string) {
      return modelId.toLowerCase().startsWith(QWEN_MODEL_PREFIX);
    },

    async *streamChat(input: StreamChatInput): TokenStream {
      const apiKey = resolveKey();
      if (!apiKey) {
        throw new Error(
          "千问 provider 未配置：缺少 DASHSCOPE_API_KEY 或 QWEN_API_KEY（配置后重试，或手动切换 stub 模型）"
        );
      }

      const timeoutController = new AbortController();
      const timeoutTimer = setTimeout(() => timeoutController.abort(), timeoutMs);
      if (typeof timeoutTimer.unref === "function") timeoutTimer.unref();
      const timeoutSignal = timeoutController.signal;
      const combinedSignal = input.signal
        ? AbortSignal.any([input.signal, timeoutSignal])
        : timeoutSignal;

      try {
        let res: Response;
        try {
          res = await fetchImpl(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              accept: "text/event-stream",
              authorization: `Bearer ${apiKey}`,
              "content-type": "application/json",
            },
            body: JSON.stringify(buildRequestBody(input)),
            signal: combinedSignal,
          });
        } catch (err) {
          if (input.signal?.aborted) throw err;
          if (timeoutSignal.aborted) {
            throw new Error(`千问 API 请求超时（超过 ${timeoutMs}ms 未响应）`);
          }
          throw err;
        }

        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          throw new Error(
            `千问 API 请求失败（HTTP ${res.status}）${detail ? `: ${detail.slice(0, 300)}` : ""}`
          );
        }
        if (!res.body) throw new Error("千问 API 响应缺少流式 body");

        try {
          for await (const chunk of parseOpenAiCompatibleSse(res.body)) {
            if (chunk.error) {
              throw new Error(
                `千问 API 流式错误：${chunk.error.code ?? "unknown"} ${chunk.error.message ?? ""}`.trim()
              );
            }
            const token = chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content;
            if (token) yield token;
          }
        } catch (err) {
          if (input.signal?.aborted) throw err;
          if (timeoutSignal.aborted) {
            throw new Error(`千问 API 请求超时（超过 ${timeoutMs}ms 未响应，流式读取中断）`);
          }
          throw err;
        }
      } finally {
        clearTimeout(timeoutTimer);
      }
    },
  };
}

export const qwenProvider: ChatProvider = createQwenProvider();
