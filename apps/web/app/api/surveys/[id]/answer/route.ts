import { NextResponse } from "next/server";
import { getPublicSurveyForAnswer } from "@repo/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSurveyId(raw: string): number | undefined {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const surveyId = parseSurveyId(params.id);
  if (!surveyId) return NextResponse.json({ error: "问卷不存在" }, { status: 404 });

  const survey = await getPublicSurveyForAnswer(surveyId);
  if (!survey) return NextResponse.json({ error: "问卷不存在" }, { status: 404 });

  const now = Date.now();
  const unavailableMessage = !survey.is_active
    ? "问卷暂不接受答题"
    : survey.publish_start_at && now < new Date(survey.publish_start_at).getTime()
      ? "问卷尚未开始"
      : survey.publish_end_at && now > new Date(survey.publish_end_at).getTime()
        ? "问卷已截止"
        : "";

  return NextResponse.json({
    survey: {
      id: survey.id,
      title: survey.title,
      description: survey.description,
      isActive: survey.is_active,
      availability: unavailableMessage ? "not_accepting" : "open",
      unavailableMessage,
      responseMode: survey.response_mode,
      publishStartAt: survey.publish_start_at,
      publishEndAt: survey.publish_end_at,
      responseLimit: survey.response_limit,
      oneResponsePerUser: survey.one_response_per_user,
      confirmationMessage: survey.confirmation_message,
      questions: survey.questions.map((q) => ({
        id: q.id,
        title: q.title,
        type: q.type,
        required: q.required,
        options: q.options,
        position: q.position,
      })),
    },
  });
}
