import { NextResponse } from "next/server";
import { canDeleteSurveyTemplate, deleteSurveyTemplate, getSurveyTemplate } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const templateId = Number(params.id);
    if (!Number.isFinite(templateId)) {
      return NextResponse.json({ error: "模板不存在" }, { status: 404 });
    }

    const template = await getSurveyTemplate(templateId);
    if (!template) return NextResponse.json({ error: "模板不存在" }, { status: 404 });

    if (!(await canDeleteSurveyTemplate(templateId, user.id))) {
      return NextResponse.json({ error: "无权删除该模板" }, { status: 403 });
    }

    await deleteSurveyTemplate(templateId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
