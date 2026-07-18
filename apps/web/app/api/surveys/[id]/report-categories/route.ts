import { NextResponse } from "next/server";
import {
  canManageSurveyScope,
  canViewSurvey,
  cleanSurveyReportCategoryPlan,
  defaultSurveyReportCategoryPlan,
  ensureSurveyReportCategoryPlan,
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
  const reportCategoryPlan = await ensureSurveyReportCategoryPlan(surveyId, loaded.survey.title, loaded.survey.questions);
  return NextResponse.json({ reportCategoryPlan });
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
  const cleaned = cleanSurveyReportCategoryPlan(
    await req.json().catch(() => ({})),
    loaded.survey.title,
    loaded.survey.questions
  );
  const reportCategoryPlan = await upsertSurveyReportCategoryPlan(surveyId, cleaned);
  return NextResponse.json({ reportCategoryPlan });
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const surveyId = parseSurveyId(params.id);
  if (surveyId == null) return NextResponse.json({ error: "surveyId 无效" }, { status: 400 });
  const loaded = await loadSurvey(surveyId, user.id);
  if ("error" in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  if (!(await canManageSurveyScope(surveyId, user.id))) {
    return NextResponse.json({ error: "无管理权限" }, { status: 403 });
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
            task: "classify_survey_questions_for_report_composer",
            rule: "章节顺序就是报告输出顺序。每个章节都可以从整份问卷和全部授权答卷中自主检索证据。",
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
                  name: "分类名称",
                  description: "分类说明",
                  requirement: "描述读者、决策目标、必须回答的问题、证据边界和表达要求",
                },
              ],
            },
          }),
        },
      ],
    });
  } catch {
    const fallback = defaultSurveyReportCategoryPlan(loaded.survey.title, loaded.survey.questions);
    const reportCategoryPlan = await upsertSurveyReportCategoryPlan(surveyId, fallback);
    return NextResponse.json({
      reportCategoryPlan,
      model,
      generatedBy: "default",
      warning: "千问分类暂不可用，已按题目生成默认分类。稍后可再次点击 AI 重新分类。",
    });
  }

  const cleaned = cleanSurveyReportCategoryPlan(classified, loaded.survey.title, loaded.survey.questions);
  const plan = cleaned.categories.length
    ? cleaned
    : defaultSurveyReportCategoryPlan(loaded.survey.title, loaded.survey.questions);
  const reportCategoryPlan = await upsertSurveyReportCategoryPlan(surveyId, plan);
  return NextResponse.json({ reportCategoryPlan, model, generatedBy: "llm" });
}
