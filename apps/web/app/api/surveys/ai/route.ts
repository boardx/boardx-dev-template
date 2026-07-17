import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { callQwenJson } from "@/lib/qwen";
import { normalizeJsonObject, saveSurveyAiDraftSession } from "@repo/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DraftQuestion = { title: string; type: string; required: boolean; options: string[]; category?: string };
type SurveyDraft = {
  reply: string; summary: string; title: string; description: string; questions: DraftQuestion[];
  clarifyingQuestions: string[]; assumptions: string[]; reportOutline: string[];
  reportTemplate: { title: string; sections: string[]; metrics: string[]; chartSlots: string[]; caveats: string[] };
  intentCanvas: Record<string, unknown>;
};

function mockDraft(command: string): SurveyDraft {
  const product = /商品|产品|product/i.test(command);
  const title = product ? "AI 商品反馈问卷" : "AI 用户调研问卷";
  return {
    reply: "已根据目标生成结构化问卷草稿，你可以预览、应用或继续修改。",
    summary: product ? "收集商品体验、价格感知和复购意愿。" : "收集用户需求、满意度和改进建议。",
    title,
    description: "预计 3 分钟完成，结果用于支持后续业务决策。",
    questions: [
      { title: "你使用相关产品或服务的频率是？", type: "single", required: true, options: ["每天", "每周", "每月", "很少"], category: "behavior" },
      { title: "请给整体体验打分", type: "rating", required: true, options: [], category: "satisfaction" },
      { title: "你最关注哪些方面？", type: "multiple", required: true, options: ["价格", "质量", "效率", "服务"], category: "preference" },
      { title: "你再次使用或购买的可能性是多少？", type: "nps", required: true, options: [], category: "preference" },
      { title: "你最希望我们优先改进什么？", type: "text", required: false, options: [], category: "open_feedback" },
    ],
    clarifyingQuestions: ["目标答题人是谁？", "是否需要区分新老用户？"],
    assumptions: ["未指定行业时按通用消费者调研处理。"],
    reportOutline: ["样本概览", "关键指标", "用户分层", "机会点", "行动建议"],
    reportTemplate: {
      title: `${title} 分析报告`,
      sections: ["样本概览", "关键指标", "细分洞察", "开放反馈", "行动建议"],
      metrics: ["response_count", "rating_average", "nps_score"],
      chartSlots: ["选择分布图", "评分分布", "NPS 分布"],
      caveats: ["样本量低于30时仅输出方向性判断。"],
    },
    intentCanvas: {
      purpose: { goal: product ? "识别商品体验与复购机会" : "识别用户需求和改进优先级", successMetrics: ["完成率", "满意度", "NPS"] },
      audience: { persona: "目标用户", context: "完成真实体验后填写", painPoints: ["反馈分散", "优先级不清"] },
      decision: { decision: "确定下一轮优化优先级", successCriteria: ["形成可执行结论"] },
      information: { categories: ["Behavior", "Satisfaction", "Preference"], requiredSignals: ["行为", "评分", "原因"] },
      constraints: { completionTime: "3 分钟以内", platform: "桌面和移动端", delivery: "公开链接", analysis: ["AI 报告", "图表", "导出"] },
    },
  };
}

function cleanDraft(raw: Partial<SurveyDraft>, command: string): SurveyDraft {
  const fallback = mockDraft(command);
  const rawQuestions = Array.isArray(raw.questions) ? raw.questions : [];
  const questions = rawQuestions.flatMap((question) => {
    const title = String(question?.title ?? "").trim();
    if (!title) return [];
    return [{ title, type: String(question.type ?? "text"), required: question.required === true,
      options: Array.isArray(question.options) ? question.options.map(String).filter(Boolean) : [],
      ...(question.category ? { category: String(question.category) } : {}) }];
  });
  return {
    ...fallback, ...raw,
    reply: String(raw.reply ?? fallback.reply), summary: String(raw.summary ?? fallback.summary),
    title: String(raw.title ?? fallback.title).trim() || fallback.title,
    description: String(raw.description ?? fallback.description),
    questions: questions.length ? questions.slice(0, 40) : fallback.questions,
  };
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const command = String(body.command ?? "").trim();
  if (!command) return NextResponse.json({ error: "请输入调研目标或修改要求" }, { status: 400 });
  const model = String(body.model ?? "qwen3.7-max");
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : randomUUID();
  if (model.startsWith("mock-")) {
    const draft = mockDraft(command);
    await saveSurveyAiDraftSession({ id: sessionId, actorUserId: user.id, modelId: model, draft: normalizeJsonObject(draft), goal: command });
    return NextResponse.json({ sessionId, draft, model });
  }
  if (model === "qwen-force-fail") {
    const draft = mockDraft(command);
    await saveSurveyAiDraftSession({ id: sessionId, actorUserId: user.id, modelId: "mock-survey-fallback", draft: normalizeJsonObject(draft), goal: command });
    return NextResponse.json({ sessionId, draft, model: "mock-survey-fallback", fallback: { from: model, to: "mock-survey-fallback" } });
  }
  let cleaned: SurveyDraft;
  try {
    const draft = await callQwenJson<Partial<SurveyDraft>>({ model, messages: [
      { role: "system", content: "你是专业问卷研究员。仅输出 JSON，包含 reply,summary,title,description,questions,clarifyingQuestions,assumptions,reportOutline,reportTemplate,intentCanvas。" },
      { role: "user", content: JSON.stringify({ command, mode: body.mode, currentDraft: body.draft ?? null, history: body.history ?? [] }) },
    ] });
    cleaned = cleanDraft(draft, command);
  } catch (error) {
    console.error("[survey-ai] Qwen generation failed", {
      model,
      error: error instanceof Error ? error.message : "unknown error",
    });
    // #669/ADR-015：内部错误细节（provider 报文/堆栈）只进上面的 console.error，
    // 绝不回客户端。对外统一通用文案。
    return NextResponse.json({ error: "千问生成失败" }, { status: 502 });
  }

  try {
    await saveSurveyAiDraftSession({ id: sessionId, actorUserId: user.id, modelId: model, draft: normalizeJsonObject(cleaned), goal: command });
    return NextResponse.json({ sessionId, draft: cleaned, model });
  } catch (error) {
    console.error("[survey-ai] Draft session persistence failed", {
      model,
      sessionId,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return NextResponse.json({ error: "问卷已生成，但保存会话失败，请稍后重试" }, { status: 500 });
  }
}
