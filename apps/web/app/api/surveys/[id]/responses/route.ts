import { NextResponse } from "next/server";
import { createSurveyResponse, getPublicSurveyForAnswer } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnswerMap = Record<string, unknown>;
type FieldErrors = Record<string, string>;

function parseSurveyId(raw: string): number | undefined {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

function isEmptyAnswer(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function normalizeAnswer(type: string, value: unknown): unknown {
  if (type === "multiple") {
    return Array.isArray(value) ? value.map((v) => String(v)) : [];
  }
  if (type === "rating") {
    const rating = Number(value);
    return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : "";
  }
  return String(value ?? "").trim();
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const surveyId = parseSurveyId(params.id);
    if (!surveyId) return NextResponse.json({ error: "问卷不存在" }, { status: 404 });

    const survey = await getPublicSurveyForAnswer(surveyId);
    if (!survey) return NextResponse.json({ error: "问卷不存在" }, { status: 404 });
    if (!survey.is_active) {
      return NextResponse.json({ error: "This survey is not accepting responses right now." }, { status: 409 });
    }

    const body = (await req.json()) as { answers?: unknown };
    const rawAnswers = (body.answers ?? {}) as AnswerMap;
    const answers: AnswerMap = {};
    const errors: FieldErrors = {};

    for (const question of survey.questions) {
      const key = String(question.id);
      const value = normalizeAnswer(question.type, rawAnswers[key]);
      if (question.required && isEmptyAnswer(value)) {
        errors[key] = "This question is required.";
      }
      answers[key] = value;
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    const user = await currentUser();
    const response = await createSurveyResponse(survey.id, answers, user?.id ?? null);
    return NextResponse.json({ response: { id: response.id, submittedAt: response.submitted_at } }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
