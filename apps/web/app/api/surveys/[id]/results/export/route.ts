import { NextResponse } from "next/server";
import { canViewSurvey, getSurveyWithQuestions, listSurveyResponses } from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-survey-004 — CSV 导出：逐份答卷一行，题目为列。权限与 results/route.ts 一致（创建者/团队成员）。
// PDF 导出走客户端 Report 视图的浏览器打印（无需额外依赖，见 apps/web/app/(app)/surveys/[id]/results/page.tsx）。

function parseSurveyId(raw: string): number | undefined {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

function csvEscape(value: unknown): string {
  const s = value == null ? "" : Array.isArray(value) ? value.join("; ") : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const surveyId = parseSurveyId(params.id);
    if (!surveyId) return NextResponse.json({ error: "问卷不存在" }, { status: 404 });

    if (!(await canViewSurvey(surveyId, user.id, currentTeamId()))) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const survey = await getSurveyWithQuestions(surveyId);
    if (!survey) return NextResponse.json({ error: "问卷不存在" }, { status: 404 });

    const responses = await listSurveyResponses(surveyId);

    const header = ["Response ID", "Submitted At", ...survey.questions.map((q) => q.title)];
    const rows = responses.map((r) => [
      String(r.id),
      r.submitted_at,
      ...survey.questions.map((q) => csvEscape(r.answers[String(q.id)])),
    ]);
    const csv = [header.map(csvEscape).join(","), ...rows.map((row) => row.join(","))].join("\r\n");

    const filename = `survey-${survey.id}-responses.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "导出失败，请稍后重试" }, { status: 500 });
  }
}
