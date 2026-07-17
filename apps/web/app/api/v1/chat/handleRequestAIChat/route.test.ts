import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

describe("legacy AVA chat compatibility route", () => {
  it("streams legacy role/content messages in Vercel AI data stream shape", async () => {
    const response = await POST(
      new Request("http://test.local/api/v1/chat/handleRequestAIChat", {
        method: "POST",
        body: JSON.stringify({
          threadId: "thread-1",
          model: "claude",
          messages: [
            { role: "user", content: "Hello AVA" },
            { role: "assistant", content: "Previous answer" },
          ],
          prompt: "Summarize the context",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-vercel-ai-data-stream")).toBe("v1");

    const text = await response.text();
    expect(text).toContain("0:");
    const payload = text
      .split("\n")
      .filter((line) => line.startsWith("0:"))
      .map((line) => JSON.parse(line.slice(2)) as string)
      .join("");
    expect(payload).toContain("user: Hello AVA");
    expect(payload).toContain("assistant: Previous answer");
    expect(text).toContain('d:{"finishReason":"stop"');
    expect(text).not.toContain("[object Object]");
  });

  it("returns a stable sanitized error for malformed JSON", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(
      new Request("http://test.local/api/v1/chat/handleRequestAIChat", {
        method: "POST",
        body: "{not json",
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "AVA chat request failed" });
  });
});
