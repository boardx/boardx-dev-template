import { NextResponse } from "next/server";
import { isAiModel, isPrivacyLevel } from "@repo/auth";
import { getSettings, upsertSettings } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const s = await getSettings(user.id);
  return NextResponse.json({ settings: { aiModel: s.ai_model, defaultPrivacy: s.default_privacy } });
}

export async function PUT(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const body = (await req.json()) as { aiModel?: unknown; defaultPrivacy?: unknown };
    const aiModel = String(body.aiModel ?? "");
    const defaultPrivacy = String(body.defaultPrivacy ?? "");
    if (!isAiModel(aiModel)) return NextResponse.json({ errors: { aiModel: "无效的 AI 模型" } }, { status: 400 });
    if (!isPrivacyLevel(defaultPrivacy))
      return NextResponse.json({ errors: { defaultPrivacy: "无效的隐私级别" } }, { status: 400 });
    await upsertSettings(user.id, { ai_model: aiModel, default_privacy: defaultPrivacy });
    return NextResponse.json({ ok: true });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
