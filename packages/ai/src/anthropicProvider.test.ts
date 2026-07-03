import { describe, it, expect, vi } from "vitest";
import { ReadableStream } from "node:stream/web";
import {
  createAnthropicProvider,
  ANTHROPIC_MODEL_PREFIX,
  DEFAULT_ANTHROPIC_VERSION,
} from "./anthropicProvider";
import { ChatGateway, stubProvider } from "./gateway";

/** 把若干 SSE 行编码成 Anthropic Messages API 流式响应体。 */
function sseBody(events: Array<{ event: string; data: unknown }>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const payload = events
    .map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`)
    .join("");
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
}

function okStreamResponse(events: Array<{ event: string; data: unknown }>): Response {
  return new Response(sseBody(events) as unknown as ConstructorParameters<typeof Response>[0], {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

const DELTA_EVENTS = [
  { event: "message_start", data: { type: "message_start" } },
  {
    event: "content_block_delta",
    data: { type: "content_block_delta", delta: { type: "text_delta", text: "你好" } },
  },
  {
    event: "content_block_delta",
    data: { type: "content_block_delta", delta: { type: "text_delta", text: "，世界" } },
  },
  { event: "message_stop", data: { type: "message_stop" } },
];

describe("anthropicProvider.matches", () => {
  it("匹配 anthropic: 前缀，不匹配 stub: 与未知前缀", () => {
    const p = createAnthropicProvider({ apiKey: "k" });
    expect(p.matches("anthropic:claude-sonnet-5")).toBe(true);
    expect(p.matches("stub:default")).toBe(false);
    expect(p.matches("gpt-4o")).toBe(false);
  });
});

describe("anthropicProvider.streamChat 请求组装", () => {
  it("URL/headers/body 正确：去前缀的 model、x-api-key、system 消息单独提取", async () => {
    const fetchMock = vi.fn(async () => okStreamResponse(DELTA_EVENTS));
    const p = createAnthropicProvider({
      apiKey: "test-key",
      baseUrl: "https://example.test",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const tokens: string[] = [];
    for await (const t of p.streamChat({
      modelId: "anthropic:claude-sonnet-5",
      messages: [
        { role: "system", content: "你是 AVA" },
        { role: "user", content: "打个招呼" },
      ],
    })) {
      tokens.push(t);
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.test/v1/messages");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("test-key");
    expect(headers["anthropic-version"]).toBe(DEFAULT_ANTHROPIC_VERSION);
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("claude-sonnet-5"); // 前缀已剥离
    expect(body.stream).toBe(true);
    expect(body.system).toBe("你是 AVA"); // system 单独提取，不进 messages
    expect(body.messages).toEqual([{ role: "user", content: "打个招呼" }]);
    expect(tokens.join("")).toBe("你好，世界");
  });
});

describe("anthropicProvider.streamChat 流式解析", () => {
  it("只提取 text_delta，忽略其它事件类型", async () => {
    const events = [
      ...DELTA_EVENTS.slice(0, 1),
      { event: "ping", data: { type: "ping" } },
      ...DELTA_EVENTS.slice(1),
    ];
    const p = createAnthropicProvider({
      apiKey: "k",
      fetchImpl: (async () => okStreamResponse(events)) as unknown as typeof fetch,
    });
    const tokens: string[] = [];
    for await (const t of p.streamChat({
      modelId: "anthropic:claude-sonnet-5",
      messages: [{ role: "user", content: "hi" }],
    })) {
      tokens.push(t);
    }
    expect(tokens.join("")).toBe("你好，世界");
  });

  it("API 返回流式 error 事件时抛错", async () => {
    const events = [
      {
        event: "error",
        data: { type: "error", error: { type: "overloaded_error", message: "Overloaded" } },
      },
    ];
    const p = createAnthropicProvider({
      apiKey: "k",
      fetchImpl: (async () => okStreamResponse(events)) as unknown as typeof fetch,
    });
    const iter = p.streamChat({
      modelId: "anthropic:claude-sonnet-5",
      messages: [{ role: "user", content: "hi" }],
    });
    await expect(iter.next()).rejects.toThrow(/Overloaded/);
  });
});

describe("anthropicProvider 错误面", () => {
  it("缺 API key 时抛出可读错误（不发请求）", async () => {
    const fetchMock = vi.fn();
    const p = createAnthropicProvider({
      apiKey: "",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const iter = p.streamChat({
      modelId: "anthropic:claude-sonnet-5",
      messages: [{ role: "user", content: "hi" }],
    });
    await expect(iter.next()).rejects.toThrow(/ANTHROPIC_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("HTTP 非 200 时抛错并携带状态码", async () => {
    const p = createAnthropicProvider({
      apiKey: "k",
      fetchImpl: (async () =>
        new Response(JSON.stringify({ error: { message: "rate limited" } }), {
          status: 429,
        })) as unknown as typeof fetch,
    });
    const iter = p.streamChat({
      modelId: "anthropic:claude-sonnet-5",
      messages: [{ role: "user", content: "hi" }],
    });
    await expect(iter.next()).rejects.toThrow(/429/);
  });
});

describe("anthropicProvider 故障面（P18 F02：失败态 + 停止生成）", () => {
  it("网络错误（fetch reject）时错误向上抛出，非吞掉", async () => {
    const p = createAnthropicProvider({
      apiKey: "k",
      fetchImpl: (async () => {
        throw new TypeError("fetch failed: ECONNREFUSED");
      }) as unknown as typeof fetch,
    });
    const iter = p.streamChat({
      modelId: "anthropic:claude-sonnet-5",
      messages: [{ role: "user", content: "hi" }],
    });
    await expect(iter.next()).rejects.toThrow(/ECONNREFUSED/);
  });

  it("调用方提前 abort（非超时触发）时原样抛出 AbortError，不误报成超时", async () => {
    const p = createAnthropicProvider({
      apiKey: "k",
      fetchImpl: (async (_url: string, init?: RequestInit) => {
        // 模拟真实 fetch 在 signal 已中止时的行为：抛 AbortError。
        if (init?.signal?.aborted) {
          const err = new Error("The operation was aborted");
          err.name = "AbortError";
          throw err;
        }
        throw new Error("test setup error: signal 未透传");
      }) as unknown as typeof fetch,
    });
    const controller = new AbortController();
    controller.abort();
    const iter = p.streamChat({
      modelId: "anthropic:claude-sonnet-5",
      messages: [{ role: "user", content: "hi" }],
      signal: controller.signal,
    });
    await expect(iter.next()).rejects.toMatchObject({ name: "AbortError" });
  });

  it("streamChat 把调用方 signal 接入底层 fetch 的 init.signal（含超时熔断，合成为一个 signal）", async () => {
    const fetchMock = vi.fn(async () => okStreamResponse(DELTA_EVENTS));
    const p = createAnthropicProvider({ apiKey: "k", fetchImpl: fetchMock as unknown as typeof fetch });
    const controller = new AbortController();
    const tokens: string[] = [];
    for await (const t of p.streamChat({
      modelId: "anthropic:claude-sonnet-5",
      messages: [{ role: "user", content: "hi" }],
      signal: controller.signal,
    })) {
      tokens.push(t);
    }
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    // 传给 fetch 的 signal 是调用方 signal 与内部超时 signal 的合成（AbortSignal.any），
    // 不再是同一个对象引用；断言调用方 abort() 后合成 signal 也确实 aborted，这是真正
    // 有意义的行为验证（而不是 identity 比较）。
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.signal).not.toBe(controller.signal);
    expect((init.signal as AbortSignal).aborted).toBe(false);
    controller.abort();
    expect((init.signal as AbortSignal).aborted).toBe(true);
    expect(tokens.join("")).toBe("你好，世界");
  });

  it("请求超时（ANTHROPIC_TIMEOUT_MS 极小值）：抛出可读的超时错误，不是原始 AbortError", async () => {
    const p = createAnthropicProvider({
      apiKey: "k",
      timeoutMs: 5,
      fetchImpl: (async (_url: string, init?: RequestInit) => {
        // 模拟一个"挂起直到超时 signal 触发"的真实请求：等 signal abort 后按 fetch 真实
        // 行为抛 AbortError，交给 provider 内部逻辑判断是不是自己的超时熔断触发的。
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("The operation was aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
      }) as unknown as typeof fetch,
    });
    const iter = p.streamChat({
      modelId: "anthropic:claude-sonnet-5",
      messages: [{ role: "user", content: "hi" }],
    });
    await expect(iter.next()).rejects.toThrow(/超时/);
  });

  it("429 限流错误消息可读且包含状态码（复用 F01 用例，确认限流路径未回归）", async () => {
    const p = createAnthropicProvider({
      apiKey: "k",
      fetchImpl: (async () =>
        new Response(JSON.stringify({ error: { message: "rate limited, retry later" } }), {
          status: 429,
        })) as unknown as typeof fetch,
    });
    const iter = p.streamChat({
      modelId: "anthropic:claude-sonnet-5",
      messages: [{ role: "user", content: "hi" }],
    });
    await expect(iter.next()).rejects.toThrow(/429/);
  });
});

describe("网关路由（F01 验收：真实 provider 与 stub 并存）", () => {
  it("anthropic: 前缀路由到真实 provider，stub: 前缀仍路由到 stub", () => {
    const real = createAnthropicProvider({ apiKey: "k" });
    const gw = new ChatGateway([real, stubProvider]);
    expect(gw.resolveProvider(`${ANTHROPIC_MODEL_PREFIX}claude-sonnet-5`)).toBe(real);
    expect(gw.resolveProvider("stub:default")).toBe(stubProvider);
  });
});
