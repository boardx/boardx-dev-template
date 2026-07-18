import { afterEach, describe, expect, it, vi } from "vitest";
import { callQwenJson } from "./qwen";

describe("callQwenJson", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("disables thinking for structured JSON requests", async () => {
    vi.stubEnv("DASHSCOPE_API_KEY", "test-key");
    const signal = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(signal);
    const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: '{"categories":[{"name":"学习"}]}' } }] }), {
          status: 200,
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    await callQwenJson({
      model: "qwen3.7-max",
      messages: [{ role: "user", content: "classify" }],
    });

    expect(timeout).toHaveBeenCalledWith(45_000);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({ enable_thinking: false });
  });
});
