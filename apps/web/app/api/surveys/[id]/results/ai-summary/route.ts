import { NextResponse } from "next/server";
import { canViewSurvey, getSurveyWithQuestions, listSurveyResponses, type SurveyQuestion } from "@repo/data";
import { generateReportSummary, type ReportSummaryQuestionInput } from "@repo/ai";
import { currentTeamId, currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-survey-007 — 问卷报告 AI 摘要：Report 视图一键生成一段基于当前回收数据的自然语言摘要。
// 权限对齐 results/route.ts 既有模式（复用 F04 的结果查看权限边界，不新开权限模型）：
// 只有创建者本人，或当前团队上下文内的 team 问卷成员，才能触发生成；未登录 401，无权限 403。
// 摘要不持久化落库——每次请求都即时基于当前 survey_responses 聚合数据重新生成（F07 范围纪律）。

function parseSurveyId(raw: string): number | undefined {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

const isEmpty = (v: unknown) => v == null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

/** 为摘要生成器准备的轻量统计：只取 top 选项/均值/答题数，不构建完整的 textAnswers/optionCounts
 *  全量分布（那是 results/route.ts summarizeQuestion 的职责，服务于图表渲染）。两者都基于
 *  packages/data/src/survey.ts 的同一份 listSurveyResponses 原始数据，取数口径一致，不是另一套
 *  并行聚合规则。 */
function buildSummaryInput(
  question: SurveyQuestion,
  responses: { answers: Record<string, unknown> }[]
): ReportSummaryQuestionInput {
  const key = String(question.id);
  const values = responses.map((r) => r.answers[key]);
  const answered = values.filter((v) => !isEmpty(v));
  const skipped = values.length - answered.length;

  const base: ReportSummaryQuestionInput = {
    id: question.id,
    title: question.title,
    type: question.type,
    answeredCount: answered.length,
    skippedCount: skipped,
  };

  if (question.type === "single" || question.type === "multiple") {
    const counts = new Map<string, number>();
    for (const opt of question.options) counts.set(opt, 0);
    for (const v of answered) {
      const items = question.type === "multiple" ? (Array.isArray(v) ? v : []) : [v];
      for (const item of items) {
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
    return base;
  }

  return base;
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
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
  if (responses.length === 0) {
    return NextResponse.json({ error: "无回收数据，无法生成摘要" }, { status: 400 });
  }

  const requiredIds = survey.questions.filter((q) => q.required).map((q) => q.id);
  const completionRates = responses.map((r) => {
    if (requiredIds.length === 0) return 1;
    const answeredRequired = requiredIds.filter((id) => !isEmpty(r.answers[String(id)])).length;
    return answeredRequired / requiredIds.length;
  });
  const averageCompletion =
    completionRates.length > 0
      ? Math.round((completionRates.reduce((a, b) => a + b, 0) / completionRates.length) * 1000) / 10
      : 0;

  const questions = survey.questions.map((q) => buildSummaryInput(q, responses));

  try {
    const result = await generateReportSummary({
      surveyTitle: survey.title,
      totalResponses: responses.length,
      averageCompletion,
      questions,
    });
    return NextResponse.json({ text: result.text }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "AI 摘要生成失败，请重试" }, { status: 500 });
  }
}
