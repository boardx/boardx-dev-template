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

const MAX_TEXT_LENGTH = 5000;

// review 加固：single/multiple 此前不校验值是否真的来自该题的 options，text 也没有长度上限——
// 越权直接打 API 可以往 answers 里塞任意 payload 落库。改为按题目类型分别收敛取值范围。
function normalizeAnswer(type: string, value: unknown, options: string[]): unknown {
  if (type === "multiple") {
    if (!Array.isArray(value)) return [];
    const optionSet = new Set(options);
    return value.map((v) => String(v)).filter((v) => optionSet.has(v));
  }
  if (type === "single") {
    const selected = String(value ?? "").trim();
    return options.includes(selected) ? selected : "";
  }
  if (type === "rating") {
    const rating = Number(value);
    return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : "";
  }
  return String(value ?? "").trim().slice(0, MAX_TEXT_LENGTH);
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
      const value = normalizeAnswer(question.type, rawAnswers[key], question.options);
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
  } catch {
    return NextResponse.json({ error: "提交失败，请稍后重试" }, { status: 500 });
  }
}
