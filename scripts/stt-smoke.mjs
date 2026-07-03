#!/usr/bin/env node
// scripts/stt-smoke.mjs — P18 F06 STT 转写冒烟（env-gated）
//
// 行为契约（feature_list p18/F06 verification 第二条）：
//   - 无 OPENAI_API_KEY：打印 SKIP 并以退出码 0 结束（CI 不依赖供应商额度）。
//   - 有 key：用脚本内置的极短 wav 样本真实调用一次 OpenAI Whisper API
//     （POST /v1/audio/transcriptions，multipart，model=whisper-1），断言返回非空文本。
//     失败（网络/鉴权/断言不过）→ 非 0 退出。
//
// 请求组装与 packages/ai/src/sttProvider.ts 保持同一口径（该文件是 TS 源码，
// node 无法直接 import，此处用等价的最小 fetch 实现；字段以 provider 单测为准）。
//
// 可选环境变量：
//   STT_BASE_URL   覆盖端点（默认官方 https://api.openai.com）
//   STT_MODEL      覆盖模型（默认 whisper-1）

const apiKey = process.env.OPENAI_API_KEY ?? "";
if (!apiKey) {
  console.log("SKIP: 未配置 OPENAI_API_KEY，跳过真实 STT 冒烟（退出码 0）");
  process.exit(0);
}

const baseUrl = (process.env.STT_BASE_URL ?? "https://api.openai.com").replace(/\/$/, "");
const model = process.env.STT_MODEL ?? "whisper-1";

/**
 * 内置音频样本：程序化生成一段 0.8 秒、8kHz、16-bit 单声道的 440Hz 正弦音 wav。
 * 不追求"转写出特定词"——冒烟只断言链路真实可用（HTTP 200 + 返回非空 text 字段）。
 */
function buildWavSample() {
  const sampleRate = 8000;
  const seconds = 0.8;
  const n = Math.floor(sampleRate * seconds);
  const dataSize = n * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.3 * 32767);
    buf.writeInt16LE(v, 44 + i * 2);
  }
  return buf;
}

const wav = buildWavSample();
const form = new FormData();
form.append("file", new Blob([wav], { type: "audio/wav" }), "smoke.wav");
form.append("model", model);

const res = await fetch(`${baseUrl}/v1/audio/transcriptions`, {
  method: "POST",
  headers: { authorization: `Bearer ${apiKey}` },
  body: form,
});

if (!res.ok) {
  const detail = await res.text().catch(() => "");
  console.error(`FAIL: STT API HTTP ${res.status} ${detail.slice(0, 300)}`);
  process.exit(1);
}

const json = await res.json().catch(() => null);
if (!json || typeof json.text !== "string") {
  console.error(`FAIL: 响应缺少 text 字段：${JSON.stringify(json).slice(0, 200)}`);
  process.exit(1);
}
if (!json.text.trim()) {
  console.error("FAIL: 转写返回空文本（链路通了但内容为空，检查样本或模型）");
  process.exit(1);
}

console.log(`OK: STT（${model}）转写返回 ${json.text.length} 字符：${json.text.slice(0, 80)}`);
