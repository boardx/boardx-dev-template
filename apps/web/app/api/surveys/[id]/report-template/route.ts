import { NextResponse } from "next/server";
import {
  canManageSurveyScope,
  canViewSurvey,
  defaultSurveyReportTemplate,
  getSurveyWithQuestions,
  getSurveyReportTemplate,
  upsertSurveyReportTemplate,
  type SurveyReportTemplateInput,
} from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSurveyId(raw: string): number | null {
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function cleanTemplate(input: unknown, surveyTitle: string): SurveyReportTemplateInput {
  const value = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const fallback = defaultSurveyReportTemplate(surveyTitle);
  const strings = (raw: unknown, fallbackValue: string[]) => Array.isArray(raw)
    ? raw.map((item) => String(item ?? "").trim()).filter(Boolean)
    : fallbackValue;
  return {
    title: String(value.title ?? fallback.title).trim() || fallback.title,
    sections: strings(value.sections, fallback.sections),
    metrics: strings(value.metrics, fallback.metrics),
    chartSlots: strings(value.chartSlots, fallback.chartSlots),
    caveats: strings(value.caveats, fallback.caveats),
  };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const surveyId = parseSurveyId(params.id);
  if (surveyId == null) return NextResponse.json({ error: "surveyId 无效" }, { status: 400 });
  if (!(await canViewSurvey(surveyId, user.id, currentTeamId()))) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  const survey = await getSurveyWithQuestions(surveyId);
  if (!survey) return NextResponse.json({ error: "not found" }, { status: 404 });
  const reportTemplate = (await getSurveyReportTemplate(surveyId)) ??
    await upsertSurveyReportTemplate(surveyId, defaultSurveyReportTemplate(survey.title));
  return NextResponse.json({ reportTemplate });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const surveyId = parseSurveyId(params.id);
  if (surveyId == null) return NextResponse.json({ error: "surveyId 无效" }, { status: 400 });
  if (!(await canViewSurvey(surveyId, user.id, currentTeamId()))) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  if (!(await canManageSurveyScope(surveyId, user.id))) {
    return NextResponse.json({ error: "无管理权限" }, { status: 403 });
  }
  const survey = await getSurveyWithQuestions(surveyId);
  if (!survey) return NextResponse.json({ error: "not found" }, { status: 404 });
  const reportTemplate = await upsertSurveyReportTemplate(
    surveyId,
    cleanTemplate(await req.json().catch(() => ({})), survey.title)
  );
  return NextResponse.json({ reportTemplate });
}
