interface QwenMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function callQwenJson<T>(input: {
  model: string;
  messages: QwenMessage[];
  temperature?: number;
}): Promise<T> {
  const apiKey = process.env.DASHSCOPE_API_KEY ?? process.env.QWEN_API_KEY;
  if (!apiKey) throw new Error("千问服务未配置：缺少 DASHSCOPE_API_KEY 或 QWEN_API_KEY");
  const baseUrl = process.env.DASHSCOPE_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1";
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      temperature: input.temperature ?? 0.3,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`千问请求失败 (${response.status})`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("千问返回为空");
  return JSON.parse(content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")) as T;
}
