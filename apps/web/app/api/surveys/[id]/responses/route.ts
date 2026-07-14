import { NextResponse } from "next/server";
import {
  countResponses,
  countResponsesByUser,
  createSurveyResponse,
  getPublicSurveyForAnswer,
  type SurveyWithQuestions,
} from "@repo/data";
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
  if (type === "single" || type === "dropdown") {
    const selected = String(value ?? "").trim();
    return options.includes(selected) ? selected : "";
  }
  if (type === "rating" || type === "linear_scale") {
    const rating = Number(value);
    return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : "";
  }
  if (type === "nps") {
    const score = Number(value);
    return Number.isInteger(score) && score >= 0 && score <= 10 ? score : "";
  }
  if (type === "number") {
    const number = Number(value);
    return Number.isFinite(number) ? number : "";
  }
  if (type === "file") {
    return Array.isArray(value) ? value.map(String).filter(Boolean).slice(0, 10) : [];
  }
  return String(value ?? "").trim().slice(0, MAX_TEXT_LENGTH);
}

async function answerGate(survey: SurveyWithQuestions, respondentUserId: number | null): Promise<string | null> {
  if (!survey.is_active) return "问卷暂不接受答题";
  const now = Date.now();
  if (survey.publish_start_at && now < new Date(survey.publish_start_at).getTime()) return "问卷尚未开始";
  if (survey.publish_end_at && now > new Date(survey.publish_end_at).getTime()) return "问卷已截止";
  if (survey.response_limit !== null && await countResponses(survey.id) >= survey.response_limit) return "答卷数量已满";
  if (survey.response_mode === "identified" && respondentUserId === null) return "请先登录后再提交实名问卷";
  if (survey.one_response_per_user) {
    if (survey.response_mode !== "identified") return "一人一答需要实名答题模式";
    if (respondentUserId !== null && await countResponsesByUser(survey.id, respondentUserId) > 0) {
      return "你已提交过该问卷";
    }
  }
  return null;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const surveyId = parseSurveyId(params.id);
    if (!surveyId) return NextResponse.json({ error: "问卷不存在" }, { status: 404 });

    const survey = await getPublicSurveyForAnswer(surveyId);
    if (!survey) return NextResponse.json({ error: "问卷不存在" }, { status: 404 });
    const user = await currentUser();
    const respondentUserId = survey.response_mode === "identified" ? user?.id ?? null : null;
    const blocked = await answerGate(survey, respondentUserId);
    if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });

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

    const response = await createSurveyResponse(survey.id, answers, respondentUserId);
    return NextResponse.json({ response: { id: response.id, submittedAt: response.submitted_at } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "提交失败，请稍后重试" }, { status: 500 });
  }
}
