#!/usr/bin/env node
// scripts/ai-provider-smoke.mjs — P18 F01 真实模型冒烟（env-gated）
//
// 行为契约（feature_list p18/F01 verification 第二条）：
//   - 无 ANTHROPIC_API_KEY：打印 SKIP 并以退出码 0 结束（CI 不依赖供应商额度）。
//   - 有 key：真实调用一次 Anthropic Messages API（流式），断言：
//       1. 收到非空文本；
//       2. 内容不是 stub 模板（不含 stub 回复的固定标记文案）。
//     失败（网络/鉴权/断言不过）→ 非 0 退出。
//
// 请求组装与 packages/ai/src/anthropicProvider.ts 保持同一口径（该文件是 TS 源码，
// node 无法直接 import，此处用等价的最小 fetch 实现；两边的字段以 provider 单测为准）。
//
// 可选环境变量：
//   ANTHROPIC_BASE_URL   覆盖端点（默认官方）
//   AVA_SMOKE_MODEL      覆盖模型（默认 claude-haiku-4-5-20251001，便宜、够用）

const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
if (!apiKey) {
  console.log("SKIP: 未配置 ANTHROPIC_API_KEY，跳过真实供应商冒烟（退出码 0）");
  process.exit(0);
}

const baseUrl = (process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com").replace(/\/$/, "");
const model = process.env.AVA_SMOKE_MODEL ?? "claude-haiku-4-5-20251001";

const STUB_MARKER = "stub 回复（未接入真实模型）";

const res = await fetch(`${baseUrl}/v1/messages`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  },
  body: JSON.stringify({
    model,
    max_tokens: 128,
    stream: true,
    messages: [{ role: "user", content: "用一句话介绍你自己（不超过 30 字）。" }],
  }),
});

if (!res.ok) {
  const detail = await res.text().catch(() => "");
  console.error(`FAIL: Anthropic API HTTP ${res.status} ${detail.slice(0, 300)}`);
  process.exit(1);
}

let text = "";
const decoder = new TextDecoder();
let buffer = "";
for await (const chunk of res.body) {
  buffer += decoder.decode(chunk, { stream: true });
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trimEnd();
    buffer = buffer.slice(idx + 1);
    if (!line.startsWith("data:")) continue;
    const raw = line.slice(5).trim();
    if (!raw) continue;
    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      continue;
    }
    if (event.type === "error") {
      console.error(`FAIL: 流式错误 ${event.error?.type ?? ""} ${event.error?.message ?? ""}`);
      process.exit(1);
    }
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
      text += event.delta.text ?? "";
    }
  }
}

if (!text.trim()) {
  console.error("FAIL: 未收到任何文本内容");
  process.exit(1);
}
if (text.includes(STUB_MARKER)) {
  console.error("FAIL: 回复命中 stub 模板标记，说明没有走到真实模型");
  process.exit(1);
}

console.log(`OK: 真实模型（${model}）流式回复 ${text.length} 字符：${text.slice(0, 80)}…`);
