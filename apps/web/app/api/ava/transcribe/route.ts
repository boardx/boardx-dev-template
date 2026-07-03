// apps/web/app/api/ava/transcribe/route.ts — AVA 语音输入转写（P18 F07）
//
// POST /api/ava/transcribe（multipart/form-data，字段名 file：MediaRecorder 产出的音频 blob）
//  1. 校验登录（转写是当前用户的动作，不挂在具体线程上，鉴权只需登录态）。
//  2. 服务端二次校验：文件存在 + 非空（前端已做最短录音时长保护，这里再兜底一次）。
//  3. 调 @repo/ai 的 transcribeAudio（P18 F06 落地的 STT provider，OpenAI Whisper API）。
//  4. 无 OPENAI_API_KEY 时（本地/CI 无供应商额度）：走确定性 stub 回显，保证端到端链路
//     （录音 → 上传 → "转写" → 文本回填）在没有真实凭证时仍可被 e2e 覆盖，口径与
//     packages/ai/src/gateway.ts 的 stubProvider 一致——真实 provider（有 key 时）不变。
import { NextResponse } from "next/server";
import { transcribeAudio } from "@repo/ai";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 无 OPENAI_API_KEY 时的确定性转写 stub：不发外部请求，仅用于 e2e/本地无凭证场景。 */
function stubTranscribe(file: File): { text: string } {
  return { text: `[stub 转写] 已收到 ${Math.max(1, Math.round(file.size / 1024))}KB 音频` };
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

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(stubTranscribe(file));
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await transcribeAudio({
      audio: bytes,
      mimeType: file.type || "audio/webm",
      filename: file.name || "audio.webm",
    });
    return NextResponse.json({ text: result.text });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
