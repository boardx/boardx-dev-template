import { NextResponse } from "next/server";
import {
  canManageSurveyScope,
  canViewSurvey,
  cleanSurveyReportCategoryPlan,
  defaultSurveyReportCategoryPlan,
  getSurveyReportCategoryPlan,
  getSurveyWithQuestions,
  upsertSurveyReportCategoryPlan,
  type SurveyReportCategoryPlanInput,
} from "@repo/data";
import { callQwenJson } from "@/lib/qwen";
import { currentTeamId, currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSurveyId(raw: string): number | null {
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function systemSelectedModel() {
  return String(process.env.SURVEY_AI_MODEL ?? "qwen3.7-max").trim() || "qwen3.7-max";
}

function containsUnsafeReportPayload(value: unknown): boolean {
  if (typeof value === "string") {
    return /https?:\/\//i.test(value) || /<script|=>|\bfunction\s*\(/i.test(value);
  }
  if (Array.isArray(value)) return value.some(containsUnsafeReportPayload);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(
    ([key, item]) =>
      ["option", "formatter", "script", "sourceUrl"].includes(key) ||
      containsUnsafeReportPayload(item)
  );
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
  if (!(await canManageSurveyScope(surveyId, user.id))) {
    return NextResponse.json({ error: "无管理权限" }, { status: 403 });
  }
  const persisted = await getSurveyReportCategoryPlan(surveyId);
  const reportCategoryPlan = persisted?.categories.length
    ? cleanSurveyReportCategoryPlan(
      persisted,
      loaded.survey.title,
      loaded.survey.questions
    )
    : defaultSurveyReportCategoryPlan(
      loaded.survey.title,
      loaded.survey.questions
    );
  return NextResponse.json({
    reportCategoryPlan,
    updatedAt: persisted?.updated_at ?? null,
  });
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
  const body = await req.json().catch(() => ({}));
  if (containsUnsafeReportPayload(body)) {
    return NextResponse.json(
      { error: "报告模板只接受允许列表中的图表模板标识和自然语言要求" },
      { status: 400 }
    );
  }
  const cleaned = cleanSurveyReportCategoryPlan(
    body,
    loaded.survey.title,
    loaded.survey.questions
  );
  const expectedUpdatedAt =
    typeof body?.expectedUpdatedAt === "string"
      ? body.expectedUpdatedAt
      : null;
  let reportCategoryPlan;
  try {
    reportCategoryPlan = await upsertSurveyReportCategoryPlan(
      surveyId,
      cleaned,
      expectedUpdatedAt
    );
  } catch (error) {
    if (
      error instanceof Error
      && error.message === "report_template_conflict"
    ) {
      return NextResponse.json(
        {
          error:
            "报告模板已被其他协作者更新。请刷新查看最新版本，再合并你的修改。",
          code: "report_template_conflict",
        },
        { status: 409 }
      );
    }
    throw error;
  }
  return NextResponse.json({ reportCategoryPlan });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const surveyId = parseSurveyId(params.id);
  if (surveyId == null) return NextResponse.json({ error: "surveyId 无效" }, { status: 400 });
  const loaded = await loadSurvey(surveyId, user.id);
  if ("error" in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  if (!(await canManageSurveyScope(surveyId, user.id))) {
    return NextResponse.json({ error: "无管理权限" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const instruction = String(body?.instruction ?? "").trim().slice(0, 1200);
  const currentPlan = cleanSurveyReportCategoryPlan(
    body?.currentPlan,
    loaded.survey.title,
    loaded.survey.questions
  );
  if (!instruction) {
    return NextResponse.json(
      { error: "请先描述报告受众、决策目标或修改要求" },
      { status: 400 }
    );
  }
  if (containsUnsafeReportPayload({ instruction, currentPlan })) {
    return NextResponse.json(
      { error: "AI 修改要求只接受自然语言和当前报告模板" },
      { status: 400 }
    );
  }

  const model = systemSelectedModel();
  let classified: SurveyReportCategoryPlanInput;
  try {
    classified = await callQwenJson<SurveyReportCategoryPlanInput>({
      model,
      temperature: 0.15,
      messages: [
        {
          role: "system",
          content:
            "你是专业用户研究报告架构师。你必须输出严格 JSON，不要 Markdown。你要把问卷主题组织成业务可读的报告章节，并为每章给出一段自然语言报告要求。",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "iterate_survey_report_template",
            instruction,
            currentPlan,
            rule: [
              "基于 currentPlan 做增量修改，不要无理由丢失现有章节。",
              "章节顺序就是报告输出顺序。",
              "每章 questionIds 只能引用 survey.questions 中的 id，同一道题允许用于多个章节。",
              "每章必须分别填写 analysisObjective 和 analysisMethod，并选择一种主要输出形式。",
              "不同章节应回答不同决策问题，避免重复全局样本说明。",
            ],
            survey: {
              title: loaded.survey.title,
              description: loaded.survey.description,
              questions: loaded.survey.questions.map((question) => ({
                id: question.id,
                title: question.title,
                type: question.type,
                required: question.required,
                options: question.options,
              })),
            },
            requiredJsonShape: {
              title: "报告标题",
              description: "报告规划说明",
              categories: [
                {
                  id: "稳定且唯一的章节 ID",
                  name: "分类名称",
                  description: "分类说明",
                  analysisObjective: "本章要回答的独立决策问题",
                  analysisMethod: "本章采用的分析方法和比较维度",
                  requirement: "描述读者、决策目标、必须回答的问题、证据边界和表达要求",
                  questionIds: [1, 2],
                  outputType: "text | chart | image",
                  chartTemplateId: "仅图表章节填写：line-simple | bar-simple | pie-simple | scatter-simple | radar | funnel",
                  order: 1,
                },
              ],
            },
          }),
        },
      ],
    });
  } catch {
    const fallback = currentPlan.categories.length
      ? currentPlan
      : defaultSurveyReportCategoryPlan(
        loaded.survey.title,
        loaded.survey.questions
      );
    return NextResponse.json({
      reportCategoryPlan: fallback,
      model,
      generatedBy: "default",
      previewOnly: true,
      warning: "AI 模板推演暂不可用，已保留当前草稿，请稍后重试。",
    });
  }

  const cleaned = cleanSurveyReportCategoryPlan(classified, loaded.survey.title, loaded.survey.questions);
  const plan = cleaned.categories.length
    ? cleaned
    : defaultSurveyReportCategoryPlan(loaded.survey.title, loaded.survey.questions);
  return NextResponse.json({
    reportCategoryPlan: plan,
    model,
    generatedBy: "llm",
    previewOnly: true,
  });
}
