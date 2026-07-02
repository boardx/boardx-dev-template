import { NextResponse } from "next/server";
import { canViewSurvey, getSurveyWithQuestions, listSurveyResponses, type SurveyQuestion } from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-survey-004 — 查看答卷与报告：Summary（按题聚合）+ Individual（逐份答卷）+ Report（分析报告）的共用数据源。
// 权限对齐 F03 review 加固后的模式（见 packages/data/src/survey.ts getPublicSurveyForAnswer 注释）：
// 只有创建者本人，或当前团队上下文内的 team 问卷成员，才能看到聚合/逐份答卷内容；
// 未登录/无权限一律不透出任何题目或答卷数据（403/401），不像公开答题页那样允许匿名访问。

function parseSurveyId(raw: string): number | undefined {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

interface OptionCount {
  option: string;
  count: number;
}

interface QuestionSummary {
  id: number;
  title: string;
  type: SurveyQuestion["type"];
  required: boolean;
  answeredCount: number;
  skippedCount: number;
  optionCounts?: OptionCount[];
  average?: number;
  textAnswers?: string[];
}

function summarizeQuestion(question: SurveyQuestion, responses: { answers: Record<string, unknown> }[]): QuestionSummary {
  const key = String(question.id);
  const values = responses.map((r) => r.answers[key]);

  const isEmpty = (v: unknown) => v == null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);
  const answered = values.filter((v) => !isEmpty(v));
  const skipped = values.length - answered.length;

  const base: QuestionSummary = {
    id: question.id,
    title: question.title,
    type: question.type,
    required: question.required,
    answeredCount: answered.length,
    skippedCount: skipped,
  };

  if (question.type === "single") {
    const counts = new Map<string, number>();
    for (const opt of question.options) counts.set(opt, 0);
    for (const v of answered) {
      const s = String(v);
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    base.optionCounts = [...counts.entries()].map(([option, count]) => ({ option, count }));
    return base;
  }

  if (question.type === "multiple") {
    const counts = new Map<string, number>();
    for (const opt of question.options) counts.set(opt, 0);
    for (const v of answered) {
      const arr = Array.isArray(v) ? v : [];
      for (const item of arr) {
        const s = String(item);
        counts.set(s, (counts.get(s) ?? 0) + 1);
      }
    }
    base.optionCounts = [...counts.entries()].map(([option, count]) => ({ option, count }));
    return base;
  }

  if (question.type === "rating") {
    const nums = answered.map((v) => Number(v)).filter((n) => Number.isFinite(n));
    base.average = nums.length > 0 ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100 : 0;
    const counts = new Map<string, number>();
    for (let i = 1; i <= 5; i++) counts.set(String(i), 0);
    for (const n of nums) counts.set(String(n), (counts.get(String(n)) ?? 0) + 1);
    base.optionCounts = [...counts.entries()].map(([option, count]) => ({ option, count }));
    return base;
  }

  // text
  base.textAnswers = answered.map((v) => String(v));
  return base;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
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

  const summary = survey.questions.map((q) => summarizeQuestion(q, responses));
  const totalResponses = responses.length;
  const requiredIds = survey.questions.filter((q) => q.required).map((q) => q.id);
  const completionRates = responses.map((r) => {
    if (requiredIds.length === 0) return 1;
    const answeredRequired = requiredIds.filter((id) => {
      const v = r.answers[String(id)];
      return !(v == null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0));
    }).length;
    return answeredRequired / requiredIds.length;
  });
  const averageCompletion =
    completionRates.length > 0
      ? Math.round((completionRates.reduce((a, b) => a + b, 0) / completionRates.length) * 1000) / 10
      : 0;

  return NextResponse.json({
    survey: {
      id: survey.id,
      title: survey.title,
      description: survey.description,
      status: survey.is_active ? "active" : "paused",
      questions: survey.questions.map((q) => ({ id: q.id, title: q.title, type: q.type, required: q.required, options: q.options })),
    },
    totalResponses,
    averageCompletion,
    summary,
    responses: responses.map((r) => ({
      id: r.id,
      submittedAt: r.submitted_at,
      respondentUserId: r.respondent_user_id,
      answers: r.answers,
    })),
  });
}
