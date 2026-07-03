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

describe("网关路由（F01 验收：真实 provider 与 stub 并存）", () => {
  it("anthropic: 前缀路由到真实 provider，stub: 前缀仍路由到 stub", () => {
    const real = createAnthropicProvider({ apiKey: "k" });
    const gw = new ChatGateway([real, stubProvider]);
    expect(gw.resolveProvider(`${ANTHROPIC_MODEL_PREFIX}claude-sonnet-5`)).toBe(real);
    expect(gw.resolveProvider("stub:default")).toBe(stubProvider);
  });
});
