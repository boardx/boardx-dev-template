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
            "你是专业用户研究报告架构师。你必须输出严格 JSON，不要 Markdown。你要把问卷问题分成业务可读的报告分类，并为每类推荐 inputModes。",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "classify_survey_questions_for_report_composer",
            requiredInputModes: ["text", "chat", "chart", "image"],
            supportedChartTypes: [
              "bar", "grouped_bar", "stacked_bar", "line", "area", "pie", "doughnut", "rose",
              "scatter", "radar", "heatmap", "treemap", "funnel", "gauge", "waterfall", "histogram",
              "boxplot", "matrix", "kpi", "text",
            ],
            supportedChartStyles: ["auto", "business", "minimal", "editorial", "presentation", "dark"],
            rule: "每个问题默认只放入一个主分类。分类顺序就是报告输出顺序。",
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
                  questionIds: [1],
                  inputModes: ["text", "chart"],
                  chartType: "bar",
                  chartStyle: "business",
                  dataPrompt: "报表数据口径、过滤条件、样本量限制和格式要求",
                  modulePrompts: {
                    chart: "图表排序、标注和重点呈现要求",
                    text: "洞察结论、证据和建议的写作要求",
                    image: "配图内容、风格和构图要求",
                    chat: "专家问答的角色、问题数量和引用要求",
                  },
                  prompt: "该分类的专业报告生成要求",
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
  const reportCategoryPlan = await upsertSurveyReportCategoryPlan(surveyId, cleaned);
  return NextResponse.json({ reportCategoryPlan, model, generatedBy: "llm" });
}
