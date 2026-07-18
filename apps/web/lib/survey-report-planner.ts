import type {
  ReportInputMode,
  SurveyReportCategoryInput,
  SurveyReportCategoryPlanInput,
  SurveyReportChartType,
} from "@repo/data";

export type PlannedReportCategory =
  | "product_feedback"
  | "satisfaction_nps"
  | "market_research"
  | "event_training_feedback"
  | "general_research";

export type PlannedReportConfidence = "low" | "medium" | "high";

export type ReportQuestionType =
  | "short_text"
  | "text"
  | "email"
  | "number"
  | "phone"
  | "single"
  | "multiple"
  | "dropdown"
  | "rating"
  | "linear_scale"
  | "nps"
  | "date"
  | "time"
  | "file";

export interface ReportQuestion {
  id: number;
  title: string;
  type: ReportQuestionType;
  required: boolean;
  options: string[];
}

export interface ReportSurveyDefinition {
  title: string;
  description: string;
  questions: ReportQuestion[];
}

export interface ReportResponseDefinition {
  id: number;
  answers: Record<string, unknown>;
}

export type ReportBlockKind =
  | "executive_summary"
  | "response_overview"
  | "demographic_profile"
  | "satisfaction_score"
  | "nps_analysis"
  | "choice_distribution"
  | "purchase_behavior"
  | "price_perception"
  | "brand_competitor"
  | "open_text_insight"
  | "priority_matrix"
  | "recommendation"
  | "methodology";

export type ReportChartType = "none" | SurveyReportChartType;
export type ReportBlockLayout =
  | "executive_brief"
  | "dashboard_spread"
  | "chart_deep_dive"
  | "matrix_lab"
  | "visual_story"
  | "action_roadmap"
  | "methodology_note";
export type ReportSignalTone = "positive" | "warning" | "risk" | "neutral";

export interface ReportChartDatum {
  label: string;
  value: number;
}

export interface PlannedReportMetric {
  label: string;
  value: string;
  description?: string;
}

export interface PlannedReportBlock {
  id: string;
  kind: ReportBlockKind;
  title: string;
  purpose: string;
  layout?: ReportBlockLayout;
  tone?: ReportSignalTone;
  chartType: ReportChartType;
  sourceQuestionIds: number[];
  metrics: PlannedReportMetric[];
  chartData: ReportChartDatum[];
  insights: string[];
  evidence?: string[];
  interpretation?: string;
  recommendation?: string;
  imagePrompt?: string;
  imageUrl?: string;
  limitations: string[];
}

export interface PlannedSurveyReport {
  title: string;
  category: PlannedReportCategory;
  audienceLabel: string;
  decisionContext: string;
  confidence: PlannedReportConfidence;
  executiveSummary: {
    headline: string;
    keyFindings: string[];
    decisionImplications: string[];
    caveat: string;
  };
  blocks: PlannedReportBlock[];
  methodology: {
    sampleSize: number;
    dataSources: string[];
    limitations: string[];
  };
}

export interface PlanSurveyReportInput {
  survey: ReportSurveyDefinition;
  responses: ReportResponseDefinition[];
  model: string;
  generatedAt: string;
}

export interface PlanSurveyReportFromCategoryPlanInput extends PlanSurveyReportInput {
  categoryPlan: SurveyReportCategoryPlanInput;
}

const keywordGroups = {
  product: ["商品", "产品", "新品", "包装", "体验", "功能", "复购", "试用", "购买", "使用"],
  satisfaction: ["满意", "满意度", "评分", "体验", "服务", "痛点", "改进"],
  nps: ["推荐", "朋友", "同事", "nps", "意愿"],
  market: ["市场", "用户画像", "品牌", "竞品", "认知", "渠道", "偏好", "需求"],
  event: ["活动", "培训", "课程", "讲师", "会议", "报名", "参与", "内容质量"],
  price: ["价格", "预算", "贵", "便宜", "性价比", "付费", "接受度"],
  purchase: ["购买", "试用", "复购", "使用频率", "多久", "原因", "动机"],
  brand: ["品牌", "竞品", "竞争", "替代", "比较", "认知"],
  demographic: ["年龄", "性别", "地区", "城市", "职业", "行业", "职位", "身份", "年级"],
};

function includesAny(text: string, keywords: string[]) {
  const source = text.toLowerCase();
  return keywords.some((keyword) => source.includes(keyword.toLowerCase()));
}

function surveyText(survey: ReportSurveyDefinition) {
  return [survey.title, survey.description, ...survey.questions.map((question) => question.title)].join(" ");
}

function confidenceFor(sampleSize: number): PlannedReportConfidence {
  if (sampleSize >= 30) return "high";
  if (sampleSize >= 5) return "medium";
  return "low";
}

function classifyCategory(survey: ReportSurveyDefinition): PlannedReportCategory {
  const text = surveyText(survey);
  const scores: Record<PlannedReportCategory, number> = {
    product_feedback: includesAny(text, keywordGroups.product) ? 2 : 0,
    satisfaction_nps: includesAny(text, keywordGroups.satisfaction) ? 1 : 0,
    market_research: includesAny(text, keywordGroups.market) ? 2 : 0,
    event_training_feedback: includesAny(text, keywordGroups.event) ? 2 : 0,
    general_research: 0,
  };
  if (includesAny(text, keywordGroups.nps)) scores.satisfaction_nps += 3;
  if (includesAny(text, keywordGroups.price) || includesAny(text, keywordGroups.purchase)) scores.product_feedback += 2;
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? (best[0] as PlannedReportCategory) : "general_research";
}

function questionMatches(question: ReportQuestion, keywords: string[]) {
  return includesAny([question.title, ...question.options].join(" "), keywords);
}

function answerValues(question: ReportQuestion, responses: ReportResponseDefinition[]) {
  return responses.map((response) => response.answers[String(question.id)]);
}

function hasAnswer(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function answerRate(question: ReportQuestion, responses: ReportResponseDefinition[]) {
  if (responses.length === 0) return 0;
  const answered = answerValues(question, responses).filter(hasAnswer).length;
  return Math.round((answered / responses.length) * 100);
}

function answeredCount(question: ReportQuestion, responses: ReportResponseDefinition[]) {
  return answerValues(question, responses).filter(hasAnswer).length;
}

function percent(count: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
}

function averageNumeric(values: unknown[]) {
  const nums = values.filter((value): value is number => typeof value === "number");
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function optionChartData(question: ReportQuestion, responses: ReportResponseDefinition[]): ReportChartDatum[] {
  const values = answerValues(question, responses);
  return question.options.map((option) => ({
    label: option,
    value: values.filter((value) => (Array.isArray(value) ? value.includes(option) : value === option)).length,
  }));
}

function numericChartData(question: ReportQuestion, responses: ReportResponseDefinition[]): ReportChartDatum[] {
  const values = answerValues(question, responses).filter((value): value is number => typeof value === "number");
  const max = question.type === "nps" ? 10 : 5;
  return Array.from({ length: max }, (_, index) => {
    const score = index + 1;
    return { label: String(score), value: values.filter((value) => value === score).length };
  });
}

function topChoice(question: ReportQuestion, responses: ReportResponseDefinition[]) {
  return optionChartData(question, responses).sort((a, b) => b.value - a.value)[0];
}

function optionSignal(question: ReportQuestion, responses: ReportResponseDefinition[]) {
  const data = optionChartData(question, responses).sort((a, b) => b.value - a.value);
  const top = data[0];
  const second = data[1];
  const answered = answeredCount(question, responses);
  if (!top || answered === 0) return null;
  return {
    top,
    second,
    share: percent(top.value, answered),
    gap: second ? percent(top.value - second.value, answered) : percent(top.value, answered),
  };
}

function textQuotes(questions: ReportQuestion[], responses: ReportResponseDefinition[]) {
  return questions
    .flatMap((question) =>
      answerValues(question, responses)
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim())
    )
    .slice(0, 3);
}

function textAnswerCount(questions: ReportQuestion[], responses: ReportResponseDefinition[]) {
  return questions.flatMap((question) =>
    answerValues(question, responses).filter((value): value is string => typeof value === "string" && value.trim().length > 0)
  ).length;
}

function questionEvidence(question: ReportQuestion, responses: ReportResponseDefinition[]) {
  const answered = answeredCount(question, responses);
  const rate = answerRate(question, responses);
  const evidence = [`「${question.title}」获得 ${answered} 份有效回答，回答率 ${rate}%。`];
  if (question.options.length) {
    const signal = optionSignal(question, responses);
    if (signal) {
      evidence.push(`最高选项为「${signal.top.label}」，占该题有效回答 ${signal.share}%。`);
      if (signal.second) evidence.push(`与第二选项「${signal.second.label}」相差 ${signal.gap} 个百分点。`);
    }
  }
  const avg = averageNumeric(answerValues(question, responses));
  if (avg != null) evidence.push(`该题平均值为 ${avg.toFixed(1)}，用于判断体验强弱和风险边界。`);
  return evidence;
}

function reportInsightLens(title: string) {
  const text = title.toLowerCase();
  if (/(年龄|性别|地区|城市|画像|人群|职业|身份)/.test(text)) return "profile";
  if (/(购买|买过|下单|复购|转化|了解|认知)/.test(text)) return "purchase";
  if (/(安全信息|关注.*安全|认证|检测|成分|披露|信任)/.test(text)) return "trust";
  if (/(风险|担心|顾虑|阻碍|疑虑|问题)/.test(text)) return "risk";
  if (/(价格|溢价|支付|预算|性价比|费用)/.test(text)) return "price";
  return "general";
}

function lensConsultingCopy(input: {
  lens: string;
  categoryName: string;
  questionTitle: string;
  topLabel: string;
  topValue: number;
  topShare: number;
  secondLabel?: string;
  lowLabel: string;
  lowValue: number;
  gap: number;
}) {
  const secondClause = input.secondLabel ? `，第二梯队为「${input.secondLabel}」` : "";
  const copy: Record<string, string[]> = {
    profile: [
      `样本画像判断：「${input.topLabel}」是本章主力人群（${input.topValue}，约 ${input.topShare}%）${secondClause}，后续结论应优先限定在该人群语境下解读。`,
      `结构含义：「${input.lowLabel}」样本仅 ${input.lowValue}，与主力人群相差 ${input.gap}；若其属于目标客群，需要补样，否则会低估其真实诉求。`,
      `行动建议：将报告口径拆成主力样本判断与低覆盖人群假设，先服务主力客群，再设计定向回收验证缺口。`,
    ],
    purchase: [
      `转化漏斗判断：「${input.topLabel}」是用户当前最主要状态（${input.topValue}，约 ${input.topShare}%）${secondClause}，说明该群体处在明确的认知/购买阶段。`,
      `增长含义：「${input.lowLabel}」仅 ${input.lowValue}，与最高项相差 ${input.gap}；低占比可能来自触达不足、信任门槛或购买理由不充分。`,
      `行动建议：对「${input.topLabel}」人群推进下一步转化素材，对「${input.lowLabel}」人群补充教育内容、试用机制或首单激励。`,
    ],
    trust: [
      `信任建设判断：「${input.topLabel}」是最强信号（${input.topValue}，约 ${input.topShare}%），用户更依赖可验证证据，而不是笼统安全表述。`,
      `证据含义：「${input.lowLabel}」仅 ${input.lowValue}，与主信号差距 ${input.gap}；资源应集中在降低感知风险的认证、检测、追溯或售后背书。`,
      `行动建议：把「${input.topLabel}」前置到详情页和购买链路，用第三方证明、批次信息或 FAQ 消除关键疑虑。`,
    ],
    risk: [
      `风险优先级判断：「${input.topLabel}」是最突出的阻力源（${input.topValue}，约 ${input.topShare}%），应被视为影响购买决策的一级风险。`,
      `管理含义：「${input.lowLabel}」仅 ${input.lowValue}，与最高项相差 ${input.gap}；风险治理不应平均用力，应先处理最接近成交阻断的问题。`,
      `行动建议：围绕「${input.topLabel}」建立解释、承诺和补偿机制，并用咨询、投诉、退货数据验证风险强度。`,
    ],
    price: [
      `价值感判断：「${input.topLabel}」是价格相关反馈的主导信号（${input.topValue}，约 ${input.topShare}%），用户关注的是价格背后的可信理由。`,
      `商业含义：「${input.lowLabel}」仅 ${input.lowValue}，与最高项相差 ${input.gap}；价格策略应区分价值证明不足和支付意愿不足。`,
      `行动建议：围绕「${input.topLabel}」重构价值表达，并用分层权益、认证背书或试用方案验证真实支付阈值。`,
    ],
    general: [
      `业务判断：「${input.topLabel}」是「${input.questionTitle}」的最强信号（${input.topValue}，约 ${input.topShare}%）${secondClause}，应成为本章结论主线。`,
      `结构含义：「${input.lowLabel}」仅 ${input.lowValue}，与最高项相差 ${input.gap}；低频项更适合作为补充假设，而不是当前优先级。`,
      `行动建议：先验证「${input.topLabel}」背后的原因，再判断是否需要对低频人群单独补样或追加追问。`,
    ],
  };
  return copy[input.lens] ?? copy.general ?? [];
}

function categoryConsultingInsights(
  category: SurveyReportCategoryInput,
  questions: ReportQuestion[],
  responses: ReportResponseDefinition[]
) {
  if (responses.length === 0) {
    return [
      `「${category.name}」暂无有效答卷，当前只能确认报告结构，不能形成业务结论。`,
      "需要先回收真实样本，再判断用户关注点、风险优先级和行动顺序。",
    ];
  }

  const choiceSignals = questions
    .map((question) => ({ question, signal: question.options.length ? optionSignal(question, responses) : null }))
    .filter((item): item is { question: ReportQuestion; signal: NonNullable<ReturnType<typeof optionSignal>> } => Boolean(item.signal));
  const numericSignals = questions
    .map((question) => ({ question, average: averageNumeric(answerValues(question, responses)) }))
    .filter((item): item is { question: ReportQuestion; average: number } => item.average != null);
  const textCount = textAnswerCount(questions, responses);
  const primary = choiceSignals.sort((a, b) => b.signal.share - a.signal.share)[0];
  const strongestNumeric = numericSignals.sort((a, b) => b.average - a.average)[0];
  const insights: string[] = [];

  if (primary) {
    const chartRows = optionChartData(primary.question, responses);
    const sortedRows = [...chartRows].sort((a, b) => b.value - a.value);
    const low = sortedRows[sortedRows.length - 1] ?? primary.signal.top;
    insights.push(
      ...lensConsultingCopy({
        lens: reportInsightLens(`${category.name} ${primary.question.title}`),
        categoryName: category.name,
        questionTitle: primary.question.title,
        topLabel: primary.signal.top.label,
        topValue: primary.signal.top.value,
        topShare: primary.signal.share,
        secondLabel: primary.signal.second?.label,
        lowLabel: low.label,
        lowValue: low.value,
        gap: Math.max(0, primary.signal.top.value - low.value),
      })
    );
  }

  if (strongestNumeric) {
    insights.push(
      `量化补充：「${strongestNumeric.question.title}」平均值为 ${strongestNumeric.average.toFixed(1)}，可作为判断体验强弱、风险等级或推荐意愿的辅助指标。`
    );
  }

  if (textCount > 0) {
    insights.push(`开放反馈：该分类包含 ${textCount} 条文本反馈，应提炼高频顾虑和原话证据，补充解释选择题无法说明的原因。`);
  }

  return insights.slice(0, 5);
}

function sampleQualityTone(responseCount: number, avgCompletion: number): ReportSignalTone {
  if (responseCount >= 50 && avgCompletion >= 70) return "positive";
  if (responseCount >= 30) return "neutral";
  if (responseCount >= 5) return "warning";
  return "risk";
}

function categoryLabel(category: PlannedReportCategory) {
  const labels: Record<PlannedReportCategory, string> = {
    product_feedback: "商品/产品反馈报告",
    satisfaction_nps: "满意度与推荐意愿报告",
    market_research: "市场调研报告",
    event_training_feedback: "活动/培训反馈报告",
    general_research: "通用研究报告",
  };
  return labels[category];
}

function makeBlock(input: Omit<PlannedReportBlock, "id">): PlannedReportBlock {
  return {
    id: `${input.kind}-${input.sourceQuestionIds.join("-") || "survey"}`,
    ...input,
  };
}

function categoryQuestions(category: SurveyReportCategoryInput, survey: ReportSurveyDefinition) {
  const ids = new Set(category.questionIds);
  return survey.questions.filter((question) => ids.has(question.id));
}

function categoryChartType(mode: ReportInputMode, questions: ReportQuestion[]): ReportChartType {
  if (mode === "text" || mode === "chat") return "text";
  if (mode === "image") return "none";
  if (questions.some((question) => ["single", "multiple", "dropdown"].includes(question.type))) return "bar";
  if (questions.some((question) => ["rating", "linear_scale", "nps", "number"].includes(question.type))) return "bar";
  return "text";
}

function smartCategoryChartType(category: SurveyReportCategoryInput, questions: ReportQuestion[]): ReportChartType {
  const lens = reportInsightLens(`${category.name} ${category.description} ${questions.map((question) => question.title).join(" ")}`);
  const hasChoice = questions.some((question) => ["single", "multiple", "dropdown"].includes(question.type) && question.options.length);
  const hasScore = questions.some((question) => ["rating", "linear_scale", "nps"].includes(question.type));
  const hasNumber = questions.some((question) => question.type === "number");
  const optionCount = questions.reduce((sum, question) => sum + question.options.length, 0);
  if (lens === "profile") return optionCount <= 5 ? "doughnut" : "bar";
  if (lens === "purchase") return hasChoice ? "funnel" : "bar";
  if (lens === "trust") return hasScore || optionCount >= 4 ? "radar" : "bar";
  if (lens === "risk") return optionCount >= 4 ? "heatmap" : "bar";
  if (lens === "price") return hasNumber ? "boxplot" : hasChoice ? "bar" : "kpi";
  if (hasScore && questions.length > 1) return "radar";
  if (hasScore) return "gauge";
  if (hasChoice) return optionCount <= 4 ? "doughnut" : "bar";
  return categoryChartType("chart", questions);
}

function configuredCategoryChartType(category: SurveyReportCategoryInput, mode: ReportInputMode, questions: ReportQuestion[]): ReportChartType {
  if (mode !== "chart") return categoryChartType(mode, questions);
  if (!category.chartType || category.chartType === "bar") return smartCategoryChartType(category, questions);
  return category.chartType;
}

function categoryLayout(mode: ReportInputMode): ReportBlockLayout {
  if (mode === "text") return "executive_brief";
  if (mode === "chart") return "chart_deep_dive";
  if (mode === "image") return "visual_story";
  return "methodology_note";
}

function categoryBlockTitle(category: SurveyReportCategoryInput, mode: ReportInputMode) {
  const labels: Record<ReportInputMode, string> = {
    text: "文本分析",
    chart: "数据报表",
    image: "视觉说明",
    chat: "Chat 洞察",
  };
  return `${category.name} - ${labels[mode]}`;
}

function categoryChartData(questions: ReportQuestion[], responses: ReportResponseDefinition[]) {
  const choiceQuestion = questions.find((question) => ["single", "multiple", "dropdown"].includes(question.type) && question.options.length);
  if (choiceQuestion) return optionChartData(choiceQuestion, responses);
  const numericQuestion = questions.find((question) => ["rating", "linear_scale", "nps", "number"].includes(question.type));
  if (numericQuestion) return numericChartData(numericQuestion, responses);
  return questions.slice(0, 4).map((question) => ({
    label: question.title.slice(0, 16),
    value: answeredCount(question, responses),
  }));
}

function categoryModeToReportBlock(
  category: SurveyReportCategoryInput,
  mode: ReportInputMode,
  categoryIndex: number,
  input: PlanSurveyReportFromCategoryPlanInput
): PlannedReportBlock {
  const questions = categoryQuestions(category, input.survey);
  const questionIds = questions.map((question) => question.id);
  const chartType = configuredCategoryChartType(category, mode, questions);
  const evidence = questions.flatMap((question) => questionEvidence(question, input.responses)).slice(0, 5);
  const consultingInsights = categoryConsultingInsights(category, questions, input.responses);
  const modePurpose: Record<ReportInputMode, string> = {
    text: "生成该分类的专业文字分析、证据解释、风险和建议。",
    chart: "把该分类问题转成可读的数据报表或表格摘要。",
    image: "为该分类生成报告配图 brief 或可视化说明。",
    chat: "以专家洞察方式解释该分类的追问、机会和限制。",
  };
  return {
    id: `category-${categoryIndex + 1}-${category.id}-${mode}`,
    kind: mode === "chart" ? "choice_distribution" : mode === "chat" ? "open_text_insight" : mode === "image" ? "open_text_insight" : "executive_summary",
    title: categoryBlockTitle(category, mode),
    purpose: modePurpose[mode],
    layout: categoryLayout(mode),
    tone: category.questionIds.length ? "neutral" : "warning",
    chartType,
    sourceQuestionIds: questionIds,
    metrics: [
      { label: "分类问题", value: `${questionIds.length} 个` },
      { label: "输入方式", value: mode },
    ],
    chartData: mode === "chart" || mode === "image" ? categoryChartData(questions, input.responses) : [],
    insights: consultingInsights,
    evidence: evidence.length ? evidence : [`分类「${category.name}」包含 ${questionIds.length} 个问题。`],
    interpretation: consultingInsights[0] ?? `「${category.name}」需要结合答卷分布形成结论。`,
    recommendation:
      consultingInsights.find((item) => item.startsWith("建议动作："))?.replace("建议动作：", "")
      ?? "优先围绕最高信号拆解原因，并补充验证低占比选项背后的用户动机。",
    imagePrompt:
      mode === "image"
        ? `${input.survey.title}，${category.name}，专业商业调研报告配图，清晰数据语境，克制可信。`
        : undefined,
    limitations: questionIds.length ? [] : ["该分类尚未分配问题，不能生成强结论。"],
  };
}

export function planSurveyReportFromCategoryPlan(input: PlanSurveyReportFromCategoryPlanInput): PlannedSurveyReport {
  const base = planSurveyReport(input);
  const categories = input.categoryPlan.categories.slice().sort((a, b) => a.order - b.order);
  const blocks = categories.flatMap((category, index) =>
    category.inputModes.map((mode) => categoryModeToReportBlock(category, mode, index, input))
  );
  if (!blocks.length) return { ...base, title: input.categoryPlan.title || base.title };

  return {
    ...base,
    title: input.categoryPlan.title || base.title,
    executiveSummary: {
      ...base.executiveSummary,
      headline: `${input.categoryPlan.title || base.title} 已按 ${categories.length} 个问题分类生成。`,
      keyFindings: categories.slice(0, 5).map((category) => `${category.name}：${category.description || "已纳入报告分析。"}`),
      decisionImplications: blocks
        .map((block) => block.recommendation)
        .filter((item): item is string => Boolean(item))
        .slice(0, 5),
    },
    blocks,
    methodology: {
      ...base.methodology,
      dataSources: [...base.methodology.dataSources, "report_category_plan"],
    },
  };
}

export function planSurveyReport(input: PlanSurveyReportInput): PlannedSurveyReport {
  const { survey, responses } = input;
  const category = classifyCategory(survey);
  const confidence = confidenceFor(responses.length);
  const numericQuestions = survey.questions.filter((question) => ["rating", "linear_scale", "nps", "number"].includes(question.type));
  const choiceQuestions = survey.questions.filter((question) => ["single", "multiple", "dropdown"].includes(question.type));
  const textQuestions = survey.questions.filter((question) => ["short_text", "text"].includes(question.type));
  const demographicQuestions = survey.questions.filter((question) => questionMatches(question, keywordGroups.demographic));
  const satisfactionQuestions = numericQuestions.filter((question) => question.type !== "nps" && questionMatches(question, keywordGroups.satisfaction));
  const npsQuestions = survey.questions.filter((question) => question.type === "nps" || questionMatches(question, keywordGroups.nps));
  const purchaseQuestions = survey.questions.filter((question) => questionMatches(question, keywordGroups.purchase));
  const priceQuestions = survey.questions.filter((question) => questionMatches(question, keywordGroups.price));
  const brandQuestions = survey.questions.filter((question) => questionMatches(question, keywordGroups.brand));
  const avgCompletion = survey.questions.length
    ? Math.round(survey.questions.reduce((sum, question) => sum + answerRate(question, responses), 0) / survey.questions.length)
    : 0;
  const responseQualityTone = sampleQualityTone(responses.length, avgCompletion);
  const questionRates = survey.questions.map((question) => ({ question, rate: answerRate(question, responses) }));
  const highestRateQuestion = questionRates.sort((a, b) => b.rate - a.rate)[0];
  const lowestRateQuestion = [...questionRates].sort((a, b) => a.rate - b.rate)[0];

  const blocks: PlannedReportBlock[] = [
    makeBlock({
      kind: "executive_summary",
      title: `${categoryLabel(category)}摘要`,
      purpose: "用管理层能快速理解的方式说明本次问卷最重要的结论。",
      layout: "executive_brief",
      tone: responseQualityTone,
      chartType: "none",
      sourceQuestionIds: [],
      metrics: [
        { label: "样本量", value: String(responses.length), description: "当前有效答卷数量" },
        { label: "置信度", value: confidence, description: "由样本量和题型覆盖推断" },
        { label: "平均回答率", value: `${avgCompletion}%`, description: "问卷整体完成质量" },
      ],
      chartData: [],
      insights: [
        `${survey.title} 已识别为${categoryLabel(category)}，报告将优先围绕真实答卷分布生成结论。`,
        responses.length < 5 ? "当前样本较少，结论应作为方向性信号。" : "当前样本可支持初步业务判断。",
      ],
      evidence: [
        `当前共有 ${responses.length} 份答卷，平均回答率 ${avgCompletion}%。`,
        highestRateQuestion ? `完成度最高的题目是「${highestRateQuestion.question.title}」，回答率 ${highestRateQuestion.rate}%。` : "暂无可计算的题目完成度。",
        lowestRateQuestion ? `完成度最低的题目是「${lowestRateQuestion.question.title}」，回答率 ${lowestRateQuestion.rate}%。` : "暂无明显缺口题目。",
      ],
      interpretation:
        responses.length >= 50
          ? "样本量已达到初步业务分析门槛，可以输出管理摘要、关键图表和行动建议。"
          : "样本规模仍偏小，适合先形成方向性判断，避免把单个选择或文本反馈解释为确定结论。",
      recommendation: "先阅读管理摘要和高频信号，再进入分题图表与行动建议，最后用样本边界复核结论强度。",
      imagePrompt: `${categoryLabel(category)}商务报告封面，深色背景，数据仪表盘、问卷图表、专业咨询报告质感，无人物正脸。`,
      limitations: responses.length < 30 ? ["样本量低于 30，避免输出强统计结论。"] : [],
    }),
    makeBlock({
      kind: "response_overview",
      title: "样本与数据质量",
      purpose: "说明回收规模、完成率和报告可信边界。",
      layout: "dashboard_spread",
      tone: responseQualityTone,
      chartType: "kpi",
      sourceQuestionIds: survey.questions.map((question) => question.id),
      metrics: [
        { label: "有效答卷", value: String(responses.length) },
        { label: "平均回答率", value: `${avgCompletion}%` },
        { label: "问题数量", value: String(survey.questions.length) },
      ],
      chartData: [
        { label: "平均回答率", value: avgCompletion },
        { label: "题目数量", value: survey.questions.length },
        { label: "答卷数量", value: responses.length },
      ],
      insights: [`平均回答率为 ${avgCompletion}%，可用于判断问卷完成质量。`],
      evidence: [
        `问卷包含 ${survey.questions.length} 道题，当前有 ${responses.length} 份答卷。`,
        highestRateQuestion ? `最高完成题目：${highestRateQuestion.question.title}（${highestRateQuestion.rate}%）。` : "暂无最高完成题目。",
        lowestRateQuestion ? `最低完成题目：${lowestRateQuestion.question.title}（${lowestRateQuestion.rate}%）。` : "暂无最低完成题目。",
      ],
      interpretation: "样本与完成率决定报告可信度。完成率越均衡，越适合把不同题目组合成多维分析。",
      recommendation: responses.length >= 50 ? "可以进入正式报告生成；后续重点检查低完成题是否影响关键结论。" : "建议继续回收答卷，达到 50 份后再输出面向外部的正式结论。",
      limitations: responses.length === 0 ? ["暂无答卷，只能生成报告结构。"] : [],
    }),
  ];

  if (demographicQuestions.length) {
    const q = demographicQuestions[0]!;
    blocks.push(
      makeBlock({
        kind: "demographic_profile",
        title: "目标人群画像",
        purpose: "解释样本来自哪些人群，帮助判断结论适用范围。",
        layout: "dashboard_spread",
        tone: "neutral",
        chartType: "doughnut",
        sourceQuestionIds: demographicQuestions.map((question) => question.id),
        metrics: [{ label: "画像题", value: `${demographicQuestions.length} 道` }],
        chartData: q.options.length ? optionChartData(q, responses) : [],
        insights: ["人群画像用于限定本报告结论的适用对象。"],
        evidence: questionEvidence(q, responses),
        interpretation: "画像题不是结论本身，而是判断后续分组分析是否可靠的样本边界。",
        recommendation: "若某一人群占比过高，应在报告中标注样本偏向；若要做群体对比，应继续补充低占比人群。",
        imagePrompt: "用户画像信息图，年龄、地区、身份标签，以专业数据看板方式呈现，干净商务背景。",
        limitations: ["没有更多样本分层时，不建议做过细的人群比较。"],
      })
    );
  }

  const scoreQuestions = satisfactionQuestions.length ? satisfactionQuestions : numericQuestions.filter((question) => question.type !== "nps");
  if (scoreQuestions.length) {
    const q = scoreQuestions[0]!;
    const avg = averageNumeric(answerValues(q, responses));
    blocks.push(
      makeBlock({
        kind: "satisfaction_score",
        title: category === "product_feedback" ? "产品体验评分" : "满意度评分分析",
        purpose: "用评分题衡量整体体验水平和潜在改进空间。",
        layout: "chart_deep_dive",
        tone: avg == null ? "warning" : avg >= 4 ? "positive" : avg >= 3 ? "warning" : "risk",
        chartType: "bar",
        sourceQuestionIds: scoreQuestions.map((question) => question.id),
        metrics: [{ label: "平均分", value: avg == null ? "-" : avg.toFixed(1), description: q.title }],
        chartData: numericChartData(q, responses),
        insights: [avg == null ? "暂无评分数据。" : `当前核心评分均值为 ${avg.toFixed(1)}。`],
        evidence: questionEvidence(q, responses),
        interpretation:
          avg == null
            ? "评分题暂无有效数值，报告只能展示结构。"
            : avg >= 4
              ? "评分表现较好，但仍需要结合低分分布和开放反馈查找隐性问题。"
              : "评分未达到稳态满意区间，应优先定位影响体验的具体环节。",
        recommendation: avg == null ? "继续收集评分数据。" : avg >= 4 ? "保留优势体验，同时追踪低分用户反馈。" : "围绕低评分原因追加追问，并形成改进优先级。",
        imagePrompt: "满意度评分分析页面，柱状图与关键结论并列，企业调研报告风格。",
        limitations: responses.length < 5 ? ["样本过少，评分均值容易受单个答卷影响。"] : [],
      })
    );
  }

  if (npsQuestions.length) {
    const q = npsQuestions[0]!;
    const values = answerValues(q, responses).filter((value): value is number => typeof value === "number");
    const promoters = values.filter((value) => value >= 9).length;
    const detractors = values.filter((value) => value <= 6).length;
    const nps = values.length ? Math.round(((promoters - detractors) / values.length) * 100) : 0;
    blocks.push(
      makeBlock({
        kind: "nps_analysis",
        title: "推荐意愿与口碑风险",
        purpose: "识别用户是否愿意推荐，以及潜在流失或口碑风险。",
        layout: "chart_deep_dive",
        tone: nps >= 30 ? "positive" : nps >= 0 ? "warning" : "risk",
        chartType: "bar",
        sourceQuestionIds: npsQuestions.map((question) => question.id),
        metrics: [{ label: "NPS", value: String(nps), description: q.title }],
        chartData: [
          { label: "推荐者", value: promoters },
          { label: "中立者", value: values.filter((value) => value > 6 && value < 9).length },
          { label: "贬损者", value: detractors },
        ],
        insights: [`当前 NPS 估算为 ${nps}。`],
        evidence: [
          ...questionEvidence(q, responses),
          `推荐者 ${promoters} 人，贬损者 ${detractors} 人，中立者 ${values.filter((value) => value > 6 && value < 9).length} 人。`,
        ],
        interpretation: nps >= 30 ? "推荐意愿较强，可提炼可传播的优势卖点。" : nps >= 0 ? "口碑处于可修复区间，需要解释中立用户顾虑。" : "贬损信号偏强，需要优先处理体验或信任问题。",
        recommendation: "把推荐者原因沉淀为传播素材，同时对贬损者追加原因访谈。",
        imagePrompt: "NPS 口碑分析仪表盘，推荐者中立者贬损者三段对比，专业咨询报告。",
        limitations: values.length < 30 ? ["NPS 样本不足时仅表示方向性口碑信号。"] : [],
      })
    );
  }

  if (purchaseQuestions.length) {
    const q = purchaseQuestions.find((question) => question.options.length) ?? purchaseQuestions[0]!;
    const top = q.options.length ? topChoice(q, responses) : undefined;
    blocks.push(
      makeBlock({
        kind: "purchase_behavior",
        title: "购买/使用行为分析",
        purpose: "识别购买动机、使用频率或复购相关信号。",
        layout: "chart_deep_dive",
        tone: "neutral",
        chartType: q.options.length ? "bar" : "text",
        sourceQuestionIds: purchaseQuestions.map((question) => question.id),
        metrics: top ? [{ label: "最高选项", value: top.label, description: `${top.value} 次选择` }] : [],
        chartData: q.options.length ? optionChartData(q, responses) : [],
        insights: [top ? `当前最突出的购买/使用信号是「${top.label}」。` : "购买行为问题需要结合文本或后续追问解读。"],
        evidence: questionEvidence(q, responses),
        interpretation: top ? `「${top.label}」代表当前最容易转化或解释使用行为的主线。` : "没有明确选项分布时，购买行为需要结合文本回答归因。",
        recommendation: "把高频购买动机转化为页面卖点，并用低频动机判断是否存在被忽略的细分需求。",
        imagePrompt: "购买行为路径图，用户动机、使用频率、复购线索，商务报告插图。",
        limitations: [],
      })
    );
  }

  if (priceQuestions.length) {
    const q = priceQuestions.find((question) => question.options.length) ?? priceQuestions[0]!;
    const top = q.options.length ? topChoice(q, responses) : undefined;
    blocks.push(
      makeBlock({
        kind: "price_perception",
        title: "价格感知与价值判断",
        purpose: "解释用户对价格、预算和性价比的接受程度。",
        layout: "chart_deep_dive",
        tone: "warning",
        chartType: q.options.length ? "bar" : "text",
        sourceQuestionIds: priceQuestions.map((question) => question.id),
        metrics: top ? [{ label: "主要价格信号", value: top.label, description: `${top.value} 次选择` }] : [],
        chartData: q.options.length ? optionChartData(q, responses) : [],
        insights: [top ? `价格相关反馈中「${top.label}」最突出。` : "价格判断需要补充更明确的价格接受度题目。"],
        evidence: questionEvidence(q, responses),
        interpretation: "价格问题需要和价值感、竞品认知、购买动机一起解读，不能只看单题占比。",
        recommendation: "把价格敏感人群与高价值认同人群分开分析，避免用平均结论指导定价。",
        imagePrompt: "价格感知分析图，价值刻度、预算分层、性价比判断，专业商业报告。",
        limitations: [],
      })
    );
  }

  if (brandQuestions.length) {
    const q = brandQuestions.find((question) => question.options.length) ?? brandQuestions[0]!;
    blocks.push(
      makeBlock({
        kind: "brand_competitor",
        title: "品牌与竞品认知",
        purpose: "识别品牌信任、竞品偏好和替代选择。",
        layout: "visual_story",
        tone: "neutral",
        chartType: q.options.length ? "doughnut" : "text",
        sourceQuestionIds: brandQuestions.map((question) => question.id),
        metrics: [{ label: "相关题目", value: `${brandQuestions.length} 道` }],
        chartData: q.options.length ? optionChartData(q, responses) : [],
        insights: ["品牌和竞品信号用于判断用户选择背后的信任来源。"],
        evidence: questionEvidence(q, responses),
        interpretation: "品牌题适合用视觉化方式展示信任来源和替代选择，帮助团队判断沟通重点。",
        recommendation: "将品牌信任和竞品替代理由拆开呈现，避免把认知度误读成购买偏好。",
        imagePrompt: "品牌认知与竞品定位图，品牌卡片、竞争象限、专业市场调研风格。",
        limitations: [],
      })
    );
  }

  const genericChoiceQuestions = choiceQuestions.filter(
    (question) => !purchaseQuestions.includes(question) && !priceQuestions.includes(question) && !brandQuestions.includes(question) && !demographicQuestions.includes(question)
  );
  if (genericChoiceQuestions.length) {
    const q = genericChoiceQuestions[0]!;
    const top = topChoice(q, responses);
    blocks.push(
      makeBlock({
        kind: "choice_distribution",
        title: "关键选择分布",
        purpose: "解释选择题中最集中的偏好或行为信号。",
        layout: "chart_deep_dive",
        tone: "neutral",
        chartType: "bar",
        sourceQuestionIds: genericChoiceQuestions.map((question) => question.id),
        metrics: top ? [{ label: "最高选项", value: top.label, description: `${top.value} 次选择` }] : [],
        chartData: optionChartData(q, responses),
        insights: [top ? `「${top.label}」是当前最集中的选择。` : "暂无明显选择集中趋势。"],
        evidence: questionEvidence(q, responses),
        interpretation: top ? `选择分布显示「${top.label}」是当前主流反馈，但仍需观察长尾选项是否代表细分机会。` : "选择题尚未形成集中信号。",
        recommendation: "优先解释 Top 选项背后的业务含义，再检查低频选项是否需要合并、追问或单独跟进。",
        imagePrompt: "选择题分布分析图，Top 排名、长尾选项和业务注释，专业调研报告风格。",
        limitations: [],
      })
    );
  }

  if (textQuestions.length) {
    const quotes = textQuotes(textQuestions, responses);
    blocks.push(
      makeBlock({
        kind: "open_text_insight",
        title: "开放反馈主题",
        purpose: "从开放题中提取用户原声、风险信号和后续追问方向。",
        layout: "visual_story",
        tone: quotes.length >= 3 ? "neutral" : "warning",
        chartType: "text",
        sourceQuestionIds: textQuestions.map((question) => question.id),
        metrics: [{ label: "文本回答", value: `${textAnswerCount(textQuestions, responses)} 条` }],
        chartData: [],
        insights: quotes.length ? quotes : ["暂无开放文本反馈。"],
        evidence: quotes.length ? quotes.map((quote, index) => `代表性原声 ${index + 1}：${quote}`) : ["暂无开放文本证据。"],
        interpretation: quotes.length ? "开放文本用于解释图表背后的原因和风险，不应只作为附录。" : "开放文本不足时，报告需要依赖结构化题目判断。",
        recommendation: "将开放反馈按主题聚类后映射到行动建议，必要时追加访谈验证原因。",
        imagePrompt: "开放反馈词云与用户原声卡片，专业研究报告页面，清晰留白。",
        limitations: quotes.length < 3 ? ["开放题样本较少，主题归纳需要继续补充。"] : [],
      })
    );
  }

  if (scoreQuestions.length || purchaseQuestions.length || priceQuestions.length) {
    blocks.push(
      makeBlock({
        kind: "priority_matrix",
        title: "改进优先级矩阵",
        purpose: "把评分、购买动机、价格感知和文本反馈组合成行动优先级。",
        layout: "matrix_lab",
        tone: "warning",
        chartType: "matrix",
        sourceQuestionIds: [...scoreQuestions, ...purchaseQuestions, ...priceQuestions].map((question) => question.id),
        metrics: [
          { label: "高优先级方向", value: category === "product_feedback" ? "体验与价格感知" : "低评分触点" },
        ],
        chartData: [
          { label: "影响度", value: scoreQuestions.length ? 70 : 45 },
          { label: "紧急度", value: textQuestions.length ? 65 : 40 },
          { label: "可行动性", value: purchaseQuestions.length || priceQuestions.length ? 75 : 50 },
        ],
        insights: ["优先处理同时影响体验评分和业务决策的问题。"],
        evidence: [
          scoreQuestions.length ? `已纳入 ${scoreQuestions.length} 道评分/满意度题。` : "当前未识别稳定评分题。",
          purchaseQuestions.length ? `已纳入 ${purchaseQuestions.length} 道购买/使用行为题。` : "当前未识别购买行为题。",
          priceQuestions.length ? `已纳入 ${priceQuestions.length} 道价格感知题。` : "当前未识别价格感知题。",
        ],
        interpretation: "优先级矩阵用于把多个问题组合成决策顺序，适合管理层快速判断先做什么。",
        recommendation: "先处理影响度高且可行动性高的事项；对只有风险信号但证据不足的问题补充验证。",
        imagePrompt: "改进优先级矩阵，影响度、紧急度、可行动性三个维度，咨询公司报告风格。",
        limitations: ["第一版优先级为规则和 AI 推断结果，不等同于严格统计模型。"],
      })
    );
  }

  blocks.push(
    makeBlock({
      kind: "recommendation",
      title: "行动建议与下一步验证",
      purpose: "把报告发现转化为可执行业务动作和下一轮研究问题。",
      layout: "action_roadmap",
      tone: "positive",
      chartType: "none",
      sourceQuestionIds: survey.questions.map((question) => question.id),
      metrics: [],
      chartData: [],
      insights: [
        category === "product_feedback" ? "围绕体验评分、购买动机和价格感知设计下一轮验证。" : "围绕当前低分项和高频反馈设计下一轮追问。",
        "将样本继续扩大后复核核心结论。",
      ],
      evidence: [
        `本报告共命中 ${blocks.length} 个业务分析模块。`,
        `当前置信度为 ${confidence}，样本量为 ${responses.length}。`,
      ],
      interpretation: "行动建议需要绑定责任人、优先级和验证指标，避免停留在描述性分析。",
      recommendation: category === "product_feedback" ? "优先把高频反馈转成产品/包装/价格实验，再用下一轮问卷复核。" : "优先把低分项和高频反馈转成可追踪的改善任务。",
      imagePrompt: "行动路线图，优先级、责任人、下一步验证，专业项目管理报告风格。",
      limitations: [],
    }),
    makeBlock({
      kind: "methodology",
      title: "方法与样本边界",
      purpose: "说明数据来源、分析方法和不可过度解读项。",
      layout: "methodology_note",
      tone: responses.length >= 30 ? "neutral" : "warning",
      chartType: "none",
      sourceQuestionIds: survey.questions.map((question) => question.id),
      metrics: [{ label: "AI 调度", value: "系统自动选择" }, { label: "生成时间", value: input.generatedAt }],
      chartData: [],
      insights: ["本报告基于问卷结构、答卷分布、题目语义和 AI 归纳生成。"],
      evidence: [
        "数据来源包括问卷定义、题型结构、选项分布、评分数值和开放文本。",
        `报告生成时间：${input.generatedAt}。`,
      ],
      interpretation: "方法页用于说明哪些结论可交付、哪些结论只能作为方向性假设。",
      recommendation: "正式发布前应检查样本来源、异常答卷、低回答率题目和 AI 生成结论是否一致。",
      imagePrompt: "研究方法与样本边界说明页，数据来源、质量检查、可信度标识，正式报告风格。",
      limitations: responses.length < 30 ? ["样本量低于 30，所有结论应作为方向性判断。"] : [],
    })
  );

  const executiveFindings = blocks
    .filter((block) => block.kind !== "executive_summary" && block.kind !== "methodology")
    .flatMap((block) => block.evidence?.slice(0, 1) ?? block.insights.slice(0, 1))
    .slice(0, 5);
  const decisionImplications = blocks
    .filter((block) => block.recommendation)
    .map((block) => block.recommendation!)
    .slice(0, 4);

  return {
    title: `${survey.title} ${categoryLabel(category)}`,
    category,
    audienceLabel: demographicQuestions.length ? "已包含人群画像题" : "未明确细分人群",
    decisionContext: category === "product_feedback" ? "支持产品体验、定价和改进优先级决策。" : "支持调研结论复核和下一步行动决策。",
    confidence,
    executiveSummary: {
      headline: `${survey.title} 已基于 ${responses.length} 份答卷生成${categoryLabel(category)}。`,
      keyFindings: executiveFindings.length ? executiveFindings : blocks.find((block) => block.kind === "executive_summary")?.insights ?? [],
      decisionImplications: decisionImplications.length ? decisionImplications : blocks.find((block) => block.kind === "recommendation")?.insights ?? [],
      caveat: responses.length < 30 ? "样本量较低，报告结论仅作为方向性判断。" : "当前样本可支持初步判断，仍建议结合业务背景复核。",
    },
    blocks,
    methodology: {
      sampleSize: responses.length,
      dataSources: ["survey_definition", "survey_responses", "question_semantics"],
      limitations: responses.length < 30 ? ["样本量低于 30，避免进行强统计推断。"] : [],
    },
  };
}
