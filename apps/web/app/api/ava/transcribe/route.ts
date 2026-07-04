// apps/web/app/api/ava/transcribe/route.ts — AVA 语音输入转写（P18 F07）
//
// POST /api/ava/transcribe（multipart/form-data，字段名 file：MediaRecorder 产出的音频 blob）
//  1. 校验登录（转写是当前用户的动作，不挂在具体线程上，鉴权只需登录态）。
//  2. 服务端二次校验：文件存在 + 非空（前端已做最短录音时长保护，这里再兜底一次）+
//     体积上限（≤25MB，Whisper 官方上限，见下方 TRANSCRIBE_MAX_BYTES）+ MIME 白名单
//     （见 TRANSCRIBE_ALLOWED_MIME_PREFIXES）。这是上层 API route 的强制职责（F06 review
//     结论），不可信任前端；超限/类型不符分别返回结构化 413/415，大小校验先于
//     arrayBuffer()，避免超大请求体全量进内存造成 OOM/DoS。
//  3. 调 @repo/ai 的 transcribeAudio（P18 F06 落地的 STT provider，OpenAI Whisper API）。
//  4. 无 OPENAI_API_KEY 时（本地/CI 无供应商额度）：走确定性 stub 回显，保证端到端链路
//     （录音 → 上传 → "转写" → 文本回填）在没有真实凭证时仍可被 e2e 覆盖，口径与
//     packages/ai/src/gateway.ts 的 stubProvider 一致——真实 provider（有 key 时）不变。
//     stub 文本显式标注「占位转写・未配置转写服务」，不伪装成真实转写结果。
//  5. 任何内部异常只 console.error 记录原始信息，返给客户端的是通用文案，不泄漏
//     Whisper 上游响应片段等细节（同 F02 review 指出的同类问题）。
import { NextResponse } from "next/server";
import { transcribeAudio } from "@repo/ai";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Whisper 官方单文件上限 25MB。
// 注意：Next.js App Router 的 route module 只允许导出约定的 handler/config 名字
// （见 next-env 生成的类型校验），这里不能用 `export const` 导出普通常量/函数，
// 否则 `next typecheck` 会报 OmitWithTag 约束错误。校验逻辑仅供本文件内部使用。
const TRANSCRIBE_MAX_BYTES = 25 * 1024 * 1024;

// 浏览器 MediaRecorder 常见输出 MIME（含各浏览器可能附带的 codecs 参数），
// 与 voice-input.tsx 里 `recorder.mimeType` 实际可能产出的值对齐。
const TRANSCRIBE_ALLOWED_MIME_PREFIXES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
];

function isAllowedMimeType(mimeType: string): boolean {
  const normalized = mimeType.toLowerCase().trim();
  return TRANSCRIBE_ALLOWED_MIME_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix};`)
  );
}

/** mimeType → 文件扩展名，按实际 MIME 映射（不再用 includes("webm") 的粗糙判断误标 Safari 的 audio/mp4）。 */
function extForMimeType(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.startsWith("audio/webm")) return "webm";
  if (normalized.startsWith("audio/ogg")) return "ogg";
  if (normalized.startsWith("audio/mp4")) return "mp4";
  if (normalized.startsWith("audio/mpeg")) return "mp3";
  if (
    normalized.startsWith("audio/wav") ||
    normalized.startsWith("audio/x-wav") ||
    normalized.startsWith("audio/wave")
  )
    return "wav";
  return "webm";
}

/** 无 OPENAI_API_KEY 时的确定性转写 stub：不发外部请求，仅用于 e2e/本地无凭证场景。 */
function stubTranscribe(file: File): { text: string } {
  return {
    text: `[占位转写・未配置转写服务] 已收到 ${Math.max(1, Math.round(file.size / 1024))}KB 音频`,
  };
}

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "缺少音频文件" }, { status: 400 });
    }

    // 体积上限：先于 arrayBuffer() 校验，避免超大文件全量进内存。
    if (file.size > TRANSCRIBE_MAX_BYTES) {
      return NextResponse.json(
        { error: `音频文件过大（上限 ${TRANSCRIBE_MAX_BYTES / (1024 * 1024)}MB）` },
        { status: 413 }
      );
    }

    // MIME 白名单：不在白名单内的类型直接拒绝，不转发给 STT provider。
    const mimeType = file.type || "audio/webm";
    if (!isAllowedMimeType(mimeType)) {
      return NextResponse.json({ error: `不支持的音频类型：${mimeType || "未知"}` }, { status: 415 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(stubTranscribe(file));
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await transcribeAudio({
      audio: bytes,
      mimeType,
      filename: file.name || `audio.${extForMimeType(mimeType)}`,
    });
    return NextResponse.json({ text: result.text });
  } catch (err) {
    // 原始错误只记服务端日志（可能含 Whisper 上游响应片段），客户端只收到通用文案。
    console.error("[ava/transcribe] 转写失败", err);
    return NextResponse.json({ error: "转写失败，请重试" }, { status: 500 });
  }
}
