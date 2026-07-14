import { NextResponse } from "next/server";
import {
  canManageSurveyScope,
  canViewSurvey,
  cleanSurveyReportCategoryPlan,
  ensureSurveyReportCategoryPlan,
  getSurveyWithQuestions,
  upsertSurveyReportCategoryPlan,
} from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSurveyId(raw: string): number | null {
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

async function loadSurvey(surveyId: number, userId: number) {
  if (!(await canViewSurvey(surveyId, userId, currentTeamId()))) return { error: "无权限", status: 403 as const };
  const survey = await getSurveyWithQuestions(surveyId);
  return survey ? { survey } : { error: "not found", status: 404 as const };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const surveyId = parseSurveyId(params.id);
  if (surveyId == null) return NextResponse.json({ error: "surveyId 无效" }, { status: 400 });
  const loaded = await loadSurvey(surveyId, user.id);
  if ("error" in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  const reportCategoryPlan = await ensureSurveyReportCategoryPlan(surveyId, loaded.survey.title, loaded.survey.questions);
  return NextResponse.json({ reportCategoryPlan });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const surveyId = parseSurveyId(params.id);
  if (surveyId == null) return NextResponse.json({ error: "surveyId 无效" }, { status: 400 });
  const loaded = await loadSurvey(surveyId, user.id);
  if ("error" in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  if (!(await canManageSurveyScope(surveyId, user.id))) {
    return NextResponse.json({ error: "无管理权限" }, { status: 403 });
  }
  const cleaned = cleanSurveyReportCategoryPlan(
    await req.json().catch(() => ({})),
    loaded.survey.title,
    loaded.survey.questions
  );
  const reportCategoryPlan = await upsertSurveyReportCategoryPlan(surveyId, cleaned);
  return NextResponse.json({ reportCategoryPlan });
}
