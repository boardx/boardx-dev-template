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

  return NextResponse.json({
    survey: {
      id: survey.id,
      title: survey.title,
      description: survey.description,
      isActive: survey.is_active,
      availability: survey.is_active ? "open" : "not_accepting",
      unavailableMessage: survey.is_active ? "" : "This survey is not accepting responses right now.",
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
