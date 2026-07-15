import { NextResponse } from "next/server";
import { canViewSurvey, getSurveyWithQuestions, listSurveyResponses } from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";
import { buildSurveyReportEvidence } from "@/lib/survey-report-evidence";
import { buildProfessionalReportDocument } from "@/lib/survey-professional-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSurveyId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const surveyId = parseSurveyId(params.id);
  if (!surveyId) return NextResponse.json({ error: "问卷不存在" }, { status: 404 });
  if (!(await canViewSurvey(surveyId, user.id, currentTeamId()))) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const [survey, responses] = await Promise.all([
    getSurveyWithQuestions(surveyId),
    listSurveyResponses(surveyId),
  ]);
  if (!survey) return NextResponse.json({ error: "问卷不存在" }, { status: 404 });

  const evidence = buildSurveyReportEvidence({
    survey: {
      title: survey.title,
      description: survey.description,
      questions: survey.questions.map((question) => ({
        id: question.id,
        title: question.title,
        type: question.type,
        required: question.required,
        options: question.options,
      })),
    },
    responses: responses.map((response) => ({ id: response.id, answers: response.answers })),
  });
  const report = buildProfessionalReportDocument({ evidence, generatedAt: new Date().toISOString() });
  return NextResponse.json({ report });
}
