import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  canViewSurvey,
  createSurveyAiModelTrace,
  createSurveyAiReportArtifact,
  createSurveyAiSession,
  ensureSurveyReportTemplate,
  getSurveyWithQuestions,
  listSurveyResponses,
  normalizeJsonObject,
  updateSurveyAiSessionStatus,
} from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";
import { callQwenJson } from "@/lib/qwen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AiSurveyReport {
  title: string;
  executiveSummary: string;
  metricHighlights: string[];
  segmentInsights: string[];
  opportunityAreas: string[];
  keyFindings: string[];
  risks: string[];
  recommendations: string[];
  followUpQuestions: string[];
  methodology: string;
  confidence: "low" | "medium" | "high";
}

function parseSurveyId(raw: string): number | null {
  const surveyId = Number(raw);
  return Number.isFinite(surveyId) ? surveyId : null;
}

function cleanList(raw: unknown, fallback: string): string[] {
  if (!Array.isArray(raw)) return [fallback];
  const items = raw.map((item) => String(item ?? "").trim()).filter(Boolean);
  return items.length ? items.slice(0, 6) : [fallback];
}

function cleanReport(raw: AiSurveyReport): AiSurveyReport {
  return {
    title: String(raw.title ?? "AI 调研报告").trim() || "AI 调研报告",
    executiveSummary: String(raw.executiveSummary ?? "样本量有限，建议继续收集答卷后再做强结论。").trim(),
    metricHighlights: cleanList(raw.metricHighlights, "当前样本量有限，核心指标仅能作为方向性信号。"),
    segmentInsights: cleanList(raw.segmentInsights, "现有答卷暂不足以做稳定人群细分。"),
    opportunityAreas: cleanList(raw.opportunityAreas, "优先补充样本，并围绕低评分问题定位机会点。"),
    keyFindings: cleanList(raw.keyFindings, "当前答卷已形成初步信号，但样本量仍需扩大。"),
    risks: cleanList(raw.risks, "样本量较小时，结论可能受个别答卷影响。"),
    recommendations: cleanList(raw.recommendations, "继续扩大回收，并围绕低评分项做补充访谈。"),
    followUpQuestions: cleanList(raw.followUpQuestions, "哪些人群对核心体验最不满意？"),
    methodology: String(raw.methodology ?? "基于当前问卷结构、选择题分布、评分题均值与开放文本进行归纳。").trim(),
    confidence: raw.confidence === "high" || raw.confidence === "medium" || raw.confidence === "low" ? raw.confidence : "low",
  };
}

function mockReport(input: { surveyTitle: string; responseCount: number; instruction?: string }): AiSurveyReport {
  const refined = input.instruction ? `已按要求改写：${input.instruction}` : "基于当前答卷生成管理层摘要。";
  return cleanReport({
    title: `${input.surveyTitle} AI 调研报告`,
    executiveSummary:
      input.responseCount === 0
        ? "当前暂无答卷，本报告仅提供分析框架和数据需求，不能生成真实结论。"
        : `${refined} 当前样本显示整体体验存在可优化空间，建议优先关注评分、推荐意愿和开放反馈中的高频问题。`,
    metricHighlights: [
      `样本量 ${input.responseCount}，结论需结合回收规模解读。`,
      "评分/NPS 题可作为趋势指标，开放题用于解释原因。",
    ],
    segmentInsights: ["可按满意度、推荐意愿和核心选择题拆分人群。"],
    opportunityAreas: ["优化低评分触点", "补充追问定位原因", "将行动建议转化为下一轮问卷假设"],
    keyFindings: ["当前反馈已形成初步信号，仍需继续观察样本稳定性。"],
    risks: ["样本量不足时，单个答卷可能放大结论偏差。"],
    recommendations: ["继续扩大样本", "围绕低分项开展访谈", "在下一轮问卷中验证改进假设"],
    followUpQuestions: ["哪些用户群体最不满意？", "低评分主要集中在哪个体验环节？"],
    methodology: "基于问卷结构、答卷数量、题型和回答分布生成，报告需结合业务背景复核。",
    confidence: input.responseCount >= 30 ? "high" : input.responseCount >= 5 ? "medium" : "low",
  });
}

function shouldUseMock(model: string) {
  return process.env.SURVEY_AI_MOCK === "1" || model.startsWith("mock-");
}

function providerForModel(model: string) {
  if (model.startsWith("mock-")) return "mock";
  if (model.startsWith("openai-")) return "openai";
  if (model.startsWith("gemini-")) return "gemini";
  return "qwen";
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const surveyId = parseSurveyId(params.id);
    if (surveyId == null) return NextResponse.json({ error: "surveyId 无效" }, { status: 400 });
    if (!(await canViewSurvey(surveyId, user.id, currentTeamId()))) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { model?: unknown; instruction?: unknown; currentReport?: unknown };
    const model = String(body.model ?? "qwen3.7-max").trim() || "qwen3.7-max";
    const instruction = String(body.instruction ?? "").trim();
    const survey = await getSurveyWithQuestions(surveyId);
    if (!survey) return NextResponse.json({ error: "not found" }, { status: 404 });
    const reportTemplate = await ensureSurveyReportTemplate(survey.id, survey.title);
    const responses = await listSurveyResponses(survey.id);

    const session = await createSurveyAiSession({
      id: randomUUID(),
      actorUserId: user.id,
      kind: "report",
      goal: instruction || "生成 AI 调研报告",
      surveyId: survey.id,
      teamId: survey.team_id,
      status: "generating",
      selectedModelId: model,
      provider: providerForModel(model),
      context: { source: "survey_report_agent", instruction, currentReport: normalizeJsonObject(body.currentReport) },
    });
    const startedAt = Date.now();
    try {
      const result = shouldUseMock(model)
        ? mockReport({ surveyTitle: survey.title, responseCount: responses.length, instruction })
        : await callQwenJson<AiSurveyReport>({
            model,
            temperature: 0.25,
            messages: [
              {
                role: "system",
                content:
                  "你是专业用户研究与商业分析顾问。你必须输出严格 JSON，不要 Markdown。报告要有业务判断、样本边界、风险、行动建议，避免夸大低样本结论。",
              },
              {
                role: "user",
                content: JSON.stringify({
                  task: instruction ? "refine_professional_survey_report" : "generate_professional_survey_report",
                  instruction,
                  currentReport: body.currentReport ?? null,
                  requiredJsonShape: {
                    title: "报告标题",
                    executiveSummary: "150字以内管理层摘要",
                    metricHighlights: ["指标解读：回收量、评分、选择题占比、开放反馈量等"],
                    segmentInsights: ["细分洞察：不同选择/评分/文本信号之间的差异"],
                    opportunityAreas: ["机会点：产品、价格、包装、沟通、渠道等可行动方向"],
                    keyFindings: ["关键发现"],
                    risks: ["风险或异常信号"],
                    recommendations: ["下一步行动建议"],
                    followUpQuestions: ["建议追加追问"],
                    methodology: "方法和样本边界",
                    confidence: "low|medium|high",
                  },
                  survey: {
                    title: survey.title,
                    description: survey.description,
                    status: survey.is_active ? "active" : "paused",
                    questions: survey.questions.map((q) => ({
                      id: q.id,
                      title: q.title,
                      type: q.type,
                      required: q.required,
                      options: q.options,
                    })),
                  },
                  reportTemplate: {
                    title: reportTemplate.title,
                    sections: reportTemplate.sections,
                    metrics: reportTemplate.metrics,
                    chartSlots: reportTemplate.chartSlots,
                    caveats: reportTemplate.caveats,
                  },
                  responses: responses.map((response) => ({
                    id: response.id,
                    submittedAt: response.submitted_at,
                    answers: response.answers,
                  })),
                }),
              },
            ],
          });
      const report = cleanReport(result);
      await createSurveyAiModelTrace({
        id: randomUUID(),
        sessionId: session.id,
        provider: providerForModel(model),
        modelId: model,
        prompt: { instruction, surveyId: survey.id, responseCount: responses.length, reportTemplate: normalizeJsonObject(reportTemplate) },
        response: normalizeJsonObject(report),
        status: "succeeded",
        latencyMs: Date.now() - startedAt,
      });
      await createSurveyAiReportArtifact({
        id: randomUUID(),
        sessionId: session.id,
        surveyId: survey.id,
        responseCount: responses.length,
        filterContext: { scope: "all_responses" },
        report: normalizeJsonObject(report),
        status: "ready",
        modelId: model,
        provider: providerForModel(model),
      });
      await updateSurveyAiSessionStatus(session.id, "ready");

      return NextResponse.json({
        report,
        model,
        generatedAt: new Date().toISOString(),
        sampleSize: responses.length,
        sessionId: session.id,
        reportTemplate,
      });
    } catch (err) {
      await createSurveyAiModelTrace({
        id: randomUUID(),
        sessionId: session.id,
        provider: providerForModel(model),
        modelId: model,
        prompt: { instruction, surveyId: survey.id, responseCount: responses.length, reportTemplate: normalizeJsonObject(reportTemplate) },
        status: "failed",
        errorMessage: String(err),
        latencyMs: Date.now() - startedAt,
      });
      await updateSurveyAiSessionStatus(session.id, "failed", String(err));
      throw err;
    }
  } catch (err) {
    // 模型/上游细节只进日志与入库 trace，不回传客户端（ADR-015 / #539）
    console.error("[api] ai-report upstream failed", err);
    return NextResponse.json({ error: "ai_report_failed" }, { status: 502 });
  }
}
