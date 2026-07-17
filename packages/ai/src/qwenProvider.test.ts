import { ReadableStream } from "node:stream/web";
import { describe, expect, it, vi } from "vitest";
import {
  createQwenProvider,
  DEFAULT_DASHSCOPE_BASE_URL,
  DEFAULT_QWEN_MODEL_ID,
} from "./qwenProvider";
import { ChatGateway, stubProvider } from "./gateway";

function sseBody(chunks: unknown[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const payload = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n";
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
}

function okStreamResponse(chunks: unknown[]): Response {
  return new Response(sseBody(chunks) as unknown as ConstructorParameters<typeof Response>[0], {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

describe("qwenProvider.matches", () => {
  it("匹配 qwen 模型，不匹配 stub/anthropic", () => {
    const p = createQwenProvider({ apiKey: "k" });
    expect(p.matches("qwen3.7-max")).toBe(true);
    expect(p.matches("qwen3.6-plus")).toBe(true);
    expect(p.matches("stub:default")).toBe(false);
    expect(p.matches("anthropic:claude-sonnet-5")).toBe(false);
  });
});

describe("qwenProvider.streamChat", () => {
  it("调用 DashScope OpenAI-compatible chat/completions 并解析流式 token", async () => {
    const fetchMock = vi.fn(async () =>
      okStreamResponse([
        { choices: [{ delta: { content: "你好" } }] },
        { choices: [{ delta: { content: "，AVA" } }] },
      ])
    );
    const p = createQwenProvider({
      apiKey: "test-key",
      baseUrl: "https://dashscope.test/compatible-mode/v1",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const tokens: string[] = [];
    for await (const token of p.streamChat({
      modelId: DEFAULT_QWEN_MODEL_ID,
      messages: [
        { role: "system", content: "你是 AVA" },
        { role: "user", content: "打个招呼" },
      ],
    })) {
      tokens.push(token);
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://dashscope.test/compatible-mode/v1/chat/completions");
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer test-key");
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({
      model: DEFAULT_QWEN_MODEL_ID,
      stream: true,
      enable_thinking: false,
      stream_options: { include_usage: true },
      messages: [
        { role: "system", content: "你是 AVA" },
        { role: "user", content: "打个招呼" },
      ],
    });
    expect(tokens.join("")).toBe("你好，AVA");
  });

  it("缺 API key 时抛出可读错误且不发请求", async () => {
    const fetchMock = vi.fn();
    const p = createQwenProvider({
      apiKey: "",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const iter = p.streamChat({
      modelId: DEFAULT_QWEN_MODEL_ID,
      messages: [{ role: "user", content: "hi" }],
    });
    await expect(iter.next()).rejects.toThrow(/DASHSCOPE_API_KEY|QWEN_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("HTTP 错误携带状态码", async () => {
    const p = createQwenProvider({
      apiKey: "k",
      fetchImpl: (async () => new Response("rate limited", { status: 429 })) as unknown as typeof fetch,
    });
    const iter = p.streamChat({
      modelId: DEFAULT_QWEN_MODEL_ID,
      messages: [{ role: "user", content: "hi" }],
    });
    await expect(iter.next()).rejects.toThrow(/429/);
  });
});

describe("网关路由（Qwen 优先真实模型，stub 保留）", () => {
  it("qwen 模型路由到千问 provider，stub 仍路由到 stub", () => {
    const qwen = createQwenProvider({ apiKey: "k" });
    const gw = new ChatGateway([qwen, stubProvider]);
    expect(gw.resolveProvider(DEFAULT_QWEN_MODEL_ID)).toBe(qwen);
    expect(gw.resolveProvider("stub:default")).toBe(stubProvider);
  });

  it("默认 DashScope baseUrl 与后端兼容", async () => {
    const fetchMock = vi.fn(async () => okStreamResponse([{ choices: [{ delta: { content: "ok" } }] }]));
    const p = createQwenProvider({
      apiKey: "k",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const iter = p.streamChat({
      modelId: DEFAULT_QWEN_MODEL_ID,
      messages: [{ role: "user", content: "hi" }],
    });
    await iter.next();
    const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${DEFAULT_DASHSCOPE_BASE_URL}/chat/completions`);
  });
});
