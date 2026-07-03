import { describe, it, expect, vi } from "vitest";
import { createSttProvider, DEFAULT_STT_MODEL } from "./sttProvider";

/** 极小的假音频字节（内容不重要，单测只验证请求组装/解析）。 */
const FAKE_AUDIO = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x01, 0x02, 0x03]);

function okJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("sttProvider.transcribeAudio 请求组装", () => {
  it("URL/headers/multipart 字段正确：file + model=whisper-1 + Bearer key", async () => {
    const fetchMock = vi.fn(async () => okJsonResponse({ text: "你好世界" }));
    const p = createSttProvider({
      apiKey: "test-key",
      baseUrl: "https://example.test",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const result = await p.transcribeAudio({
      audio: FAKE_AUDIO,
      mimeType: "audio/wav",
      filename: "sample.wav",
      language: "zh",
    });

    expect(result).toEqual({ text: "你好世界" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.test/v1/audio/transcriptions");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer test-key");
    // multipart 边界由运行时生成，不能手写 content-type
    expect(headers["content-type"]).toBeUndefined();

    const form = init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get("model")).toBe(DEFAULT_STT_MODEL);
    expect(form.get("language")).toBe("zh");
    const file = form.get("file") as File;
    expect(file).toBeInstanceOf(Blob);
    expect(file.name).toBe("sample.wav");
    expect(file.type).toBe("audio/wav");
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(FAKE_AUDIO);
  });

  it("缺省值：默认 filename/mimeType，language 不传则不出现在表单", async () => {
    const fetchMock = vi.fn(async () => okJsonResponse({ text: "ok" }));
    const p = createSttProvider({
      apiKey: "k",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await p.transcribeAudio({ audio: FAKE_AUDIO.buffer.slice(0) as ArrayBuffer });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    const form = init.body as FormData;
    expect(form.get("language")).toBeNull();
    const file = form.get("file") as File;
    expect(file.name).toBe("audio.wav");
    expect(file.type).toBe("audio/wav");
  });
});

describe("sttProvider 成功解析", () => {
  it("返回响应中的 text 字段", async () => {
    const p = createSttProvider({
      apiKey: "k",
      fetchImpl: (async () => okJsonResponse({ text: "会议纪要第一条" })) as unknown as typeof fetch,
    });
    await expect(p.transcribeAudio({ audio: FAKE_AUDIO })).resolves.toEqual({
      text: "会议纪要第一条",
    });
  });

  it("响应缺 text 字段时抛可读错误", async () => {
    const p = createSttProvider({
      apiKey: "k",
      fetchImpl: (async () => okJsonResponse({ task: "transcribe" })) as unknown as typeof fetch,
    });
    await expect(p.transcribeAudio({ audio: FAKE_AUDIO })).rejects.toThrow(/text 字段/);
  });
});

describe("sttProvider 错误面", () => {
  it("缺 API key 时抛出可读错误（不发请求）", async () => {
    const fetchMock = vi.fn();
    const p = createSttProvider({ apiKey: "", fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(p.transcribeAudio({ audio: FAKE_AUDIO })).rejects.toThrow(/OPENAI_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("HTTP 非 200 时抛错并携带状态码与响应详情", async () => {
    const p = createSttProvider({
      apiKey: "k",
      fetchImpl: (async () =>
        new Response(JSON.stringify({ error: { message: "invalid file format" } }), {
          status: 400,
        })) as unknown as typeof fetch,
    });
    await expect(p.transcribeAudio({ audio: FAKE_AUDIO })).rejects.toThrow(/400/);
  });
});
