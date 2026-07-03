// packages/ai/src/anthropicProvider.ts — 真实模型 provider：Anthropic Messages API（P18 F01）
//
// 网关的第一个真实 provider。零 SDK 依赖：直接 fetch Anthropic Messages API 的流式端点，
// 解析 SSE 事件流，逐 text_delta yield——与 stub provider 遵守同一 ChatProvider 契约，
// 上层（graph/reply-stream）无需感知差异。
//
// modelId 约定：`anthropic:<真实模型 id>`，如 anthropic:claude-sonnet-5。
// 网关按前缀路由到本 provider，请求体里的 model 为剥离前缀后的真实 id。
//
// 配置（均走环境变量，凭证不进代码库）：
//   ANTHROPIC_API_KEY   必填。缺失时首次调用抛出可读错误（上层落库失败态，用户输入不丢）。
//   ANTHROPIC_BASE_URL  可选。默认官方端点；可指向代理/网关，也是 F02 故障注入的入口。
//
// P18 F02：请求级超时。真实网络请求可能一直挂起不响应（连接建立后对端既不发数据也不关闭），
// 光靠调用方的 AbortController（用户点击停止）无法覆盖这种情况——没人会替"卡住的请求"点停止。
// 用 AbortSignal.any() 把调用方 signal 与超时 signal 合并成一个，任一触发都会真实中断 fetch。
import type { ChatProvider, StreamChatInput, TokenStream, ChatMessage } from "./gateway";

export const ANTHROPIC_MODEL_PREFIX = "anthropic:";
export const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com";
export const DEFAULT_ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 4096;
/** 请求超时（毫秒）。可通过 ANTHROPIC_TIMEOUT_MS 覆盖，测试环境可调小以加速验证。 */
const DEFAULT_TIMEOUT_MS = 60_000;

export interface AnthropicProviderOptions {
  /** 显式传入 key；缺省时每次调用读 process.env.ANTHROPIC_API_KEY（支持运行中更换）。 */
  apiKey?: string;
  baseUrl?: string;
  /** 测试注入用；缺省用全局 fetch。 */
  fetchImpl?: typeof fetch;
  maxTokens?: number;
  /** 请求超时（毫秒）；缺省读 ANTHROPIC_TIMEOUT_MS，再缺省 DEFAULT_TIMEOUT_MS。 */
  timeoutMs?: number;
}

interface AnthropicRequestBody {
  model: string;
  max_tokens: number;
  stream: true;
  system?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

/** 把网关消息转成 Anthropic 请求体：system 消息单独提取（API 要求），其余保序透传。 */
function buildRequestBody(input: StreamChatInput, maxTokens: number): AnthropicRequestBody {
  const systemParts: string[] = [];
  const messages: AnthropicRequestBody["messages"] = [];
  for (const m of input.messages as ChatMessage[]) {
    if (m.role === "system") systemParts.push(m.content);
    else messages.push({ role: m.role, content: m.content });
  }
  const body: AnthropicRequestBody = {
    model: input.modelId.slice(ANTHROPIC_MODEL_PREFIX.length),
    max_tokens: maxTokens,
    stream: true,
    messages,
  };
  if (systemParts.length > 0) body.system = systemParts.join("\n\n");
  return body;
}

/** 逐行解析 SSE：yield 每个 data: 后的 JSON 对象（跨 chunk 缓冲，容忍半行）。
 *  参数类型取自 fetch Response["body"]（lib 未开 DOM，全局无 ReadableStream 名字）。 */
async function* parseSseData(body: NonNullable<Response["body"]>): AsyncGenerator<unknown, void, void> {
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
          yield JSON.parse(raw);
        } catch {
          // 非 JSON 的 data 行（不应出现）：跳过，不让单行脏数据中断整个流。
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function createAnthropicProvider(options: AnthropicProviderOptions = {}): ChatProvider {
  const resolveKey = () => options.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "";
  const baseUrl = (
    options.baseUrl ??
    process.env.ANTHROPIC_BASE_URL ??
    DEFAULT_ANTHROPIC_BASE_URL
  ).replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const envTimeoutMs = Number(process.env.ANTHROPIC_TIMEOUT_MS);
  const timeoutMs =
    options.timeoutMs ?? (Number.isFinite(envTimeoutMs) && envTimeoutMs > 0
      ? envTimeoutMs
      : DEFAULT_TIMEOUT_MS);

  return {
    matches(modelId: string) {
      return modelId.startsWith(ANTHROPIC_MODEL_PREFIX);
    },

    async *streamChat(input: StreamChatInput): TokenStream {
      const apiKey = resolveKey();
      if (!apiKey) {
        throw new Error(
          "Anthropic provider 未配置：缺少 ANTHROPIC_API_KEY（在 .env 配置后重试，或改用 stub 模型）"
        );
      }

      // 把调用方（用户点击停止）的 signal 与超时 signal 合并：任一先触发都真实中断 fetch，
      // 而不是"卡住的请求"永远等不到任何人来喊停。
      const timeoutSignal = AbortSignal.timeout(timeoutMs);
      const combinedSignal = input.signal
        ? AbortSignal.any([input.signal, timeoutSignal])
        : timeoutSignal;

      let res: Response;
      try {
        res = await fetchImpl(`${baseUrl}/v1/messages`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": DEFAULT_ANTHROPIC_VERSION,
          },
          body: JSON.stringify(buildRequestBody(input, maxTokens)),
          // P18 F02：停止生成透传到真实网络请求——signal 触发 abort 时 fetch 直接抛
          // AbortError（而不是等这次流式回复自然结束），上层 reply-stream 据此提前收尾。
          signal: combinedSignal,
        });
      } catch (err) {
        // 用户主动停止（input.signal 先触发）：原样抛出 AbortError，上层据此区分"停止"
        // 而非"失败"。超时触发（timeoutSignal 先触发，input.signal 未 abort）：转成一个
        // 可读的超时错误，走正常失败态路径（不是用户操作，应该展示失败提示）。
        if (input.signal?.aborted) throw err;
        if (timeoutSignal.aborted) {
          throw new Error(`Anthropic API 请求超时（超过 ${timeoutMs}ms 未响应）`);
        }
        throw err;
      }

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(
          `Anthropic API 请求失败（HTTP ${res.status}）${detail ? `: ${detail.slice(0, 300)}` : ""}`
        );
      }
      if (!res.body) {
        throw new Error("Anthropic API 响应缺少流式 body");
      }

      try {
        for await (const event of parseSseData(res.body)) {
          const e = event as {
            type?: string;
            delta?: { type?: string; text?: string };
            error?: { type?: string; message?: string };
          };
          if (e.type === "error") {
            throw new Error(
              `Anthropic API 流式错误：${e.error?.type ?? "unknown"} ${e.error?.message ?? ""}`.trim()
            );
          }
          if (e.type === "content_block_delta" && e.delta?.type === "text_delta" && e.delta.text) {
            yield e.delta.text;
          }
        }
      } catch (err) {
        if (input.signal?.aborted) throw err;
        if (timeoutSignal.aborted) {
          throw new Error(`Anthropic API 请求超时（超过 ${timeoutMs}ms 未响应，流式读取中断）`);
        }
        throw err;
      }
    },
  };
}

/** 默认实例：key/baseUrl 全部走环境变量（每次调用时读取，无 key 环境仅在真正选用
 *  anthropic: 模型时才报错，不影响 stub 路径）。 */
export const anthropicProvider: ChatProvider = createAnthropicProvider();
