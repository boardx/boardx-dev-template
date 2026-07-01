export type SurveyStatus = "draft" | "published" | "paused" | "closed" | "archived";

export type SurveyCategory =
  | "customer_satisfaction"
  | "market_research"
  | "product_feedback"
  | "brand_research"
  | "employee_engagement"
  | "business_diagnosis"
  | "event_feedback"
  | "custom";

export type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "dropdown"
  | "text"
  | "textarea"
  | "rating"
  | "nps"
  | "matrix_single"
  | "matrix_multiple"
  | "ranking"
  | "scale"
  | "date"
  | "number"
  | "file_upload"
  | "industry_selector"
  | "company_size"
  | "revenue_range"
  | "role_selector"
  | "budget_range"
  | "purchase_intent"
  | "satisfaction_score"
  | "importance_performance_matrix"
  | "brand_awareness"
  | "competitor_comparison";

export type ChartType =
  | "bar"
  | "pie"
  | "donut"
  | "line"
  | "radar"
  | "matrix"
  | "stacked_bar"
  | "heatmap"
  | "word_cloud"
  | "table";

export type ReportSectionType =
  | "executive_summary"
  | "sample_profile"
  | "key_metrics"
  | "dimension_analysis"
  | "question_analysis"
  | "cross_analysis"
  | "segment_analysis"
  | "pain_point_analysis"
  | "opportunity_analysis"
  | "recommendation"
  | "appendix";

export type ReportType =
  | "customer_satisfaction_report"
  | "market_research_report"
  | "product_feedback_report"
  | "brand_analysis_report"
  | "employee_engagement_report"
  | "business_diagnosis_report"
  | "custom_report";

export type AnalysisRole =
  | "profile"
  | "metric"
  | "dimension"
  | "segment"
  | "open_feedback"
  | "filter"
  | "appendix";

export interface Survey {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  category: SurveyCategory;
  businessGoal: string;
  targetAudience: string;
  status: SurveyStatus;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface SurveySection {
  id: string;
  surveyId: string;
  title: string;
  description?: string;
  order: number;
}

export interface QuestionOption {
  id: string;
  label: string;
  value: string;
  score?: number;
  tags?: string[];
  dimensionKey?: string;
  exclusive?: boolean;
}

export interface QuestionAnalysisConfig {
  includeInReport: boolean;
  role: AnalysisRole;
  dimensionKey?: string;
  weight?: number;
  recommendedChart?: ChartType;
  crossAnalysisEnabled?: boolean;
}

export interface SurveyQuestion {
  id: string;
  surveyId: string;
  sectionId?: string;
  type: QuestionType;
  title: string;
  description?: string;
  required: boolean;
  order: number;
  options?: QuestionOption[];
  settings: {
    placeholder?: string;
    min?: number;
    max?: number;
    step?: number;
    allowOther?: boolean;
    displayStyle?: "list" | "card" | "button" | "dropdown";
  };
  analysisConfig?: QuestionAnalysisConfig;
}

export interface SurveyAnswer {
  questionId: string;
  value: string | number | string[] | number[] | Record<string, unknown>;
  textValue?: string;
  optionIds?: string[];
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  status: "in_progress" | "completed" | "invalid";
  startedAt: string;
  submittedAt?: string;
  durationSeconds?: number;
  metadata: {
    device?: "desktop" | "mobile" | "tablet";
    source?: string;
    channel?: string;
  };
  answers: SurveyAnswer[];
}

export interface SurveyBundle {
  survey: Survey;
  sections: SurveySection[];
  questions: SurveyQuestion[];
}

export interface ReportMetric {
  id: string;
  name: string;
  key: string;
  type:
    | "response_count"
    | "completion_rate"
    | "average_score"
    | "nps_score"
    | "satisfaction_score"
    | "dimension_score"
    | "option_ratio"
    | "ranking_score";
  sourceQuestionId?: string;
  formula: {
    method: "count" | "average" | "sum" | "ratio" | "weighted_score" | "nps" | "custom";
    params?: Record<string, unknown>;
  };
  displayFormat: "number" | "percent" | "score" | "text";
}

export interface ReportSection {
  id: string;
  title: string;
  type: ReportSectionType;
  order: number;
  description?: string;
  sourceQuestionIds: string[];
  chartIds?: string[];
  metricIds?: string[];
  aiAnalysisEnabled: boolean;
}

export interface ReportChart {
  id: string;
  title: string;
  type: ChartType;
  sourceQuestionIds: string[];
  dimensionQuestionId?: string;
  config: {
    xField?: string;
    yField?: string;
    groupBy?: string;
    showPercent?: boolean;
    showCount?: boolean;
    sortBy?: "count" | "percent" | "score" | "custom";
  };
}

export interface ReportTemplate {
  id: string;
  surveyId: string;
  title: string;
  description: string;
  reportType: ReportType;
  sections: ReportSection[];
  metrics: ReportMetric[];
  charts: ReportChart[];
  insightRules: string[];
  aiPromptConfig: {
    style: "professional" | "consulting" | "academic" | "executive";
    depth: "simple" | "standard" | "deep";
    language: "zh-CN" | "en-US";
  };
  createdAt: string;
  updatedAt: string;
}

export interface SurveyValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

export interface ReportMetricDisplay {
  label: string;
  value: string;
  tone: "blue" | "green" | "violet" | "amber";
}

export interface DistributionDatum {
  label: string;
  value: number;
  percent: number;
}

export interface DimensionScoreDatum {
  key: string;
  label: string;
  score: number;
  level: string;
  sampleCount: number;
}

export interface QuestionDistributionDatum {
  questionId: string;
  title: string;
  role?: AnalysisRole;
  type: QuestionType;
  data: DistributionDatum[];
}

export interface ExecutiveSummary {
  headline: string;
  boardMessage: string;
  maturityScore: number;
  maturityLevel: string;
  confidenceLabel: string;
  recommendedFocus: string;
  nextReview: string;
}

export interface ReportMethodology {
  sampleSize: number;
  validResponses: number;
  completionRate: number;
  averageDuration: string;
  confidenceLabel: string;
  confidenceNote: string;
  dataQualityScore: number;
  segmentCoverage: string[];
  limitations: string[];
}

export interface DimensionNarrative {
  key: string;
  label: string;
  score: number;
  level: string;
  diagnosis: string;
  evidence: string;
  recommendation: string;
}

export interface DiagnosticSummary {
  strongest?: DimensionScoreDatum;
  weakest?: DimensionScoreDatum;
  scoreSpread: number;
  narratives: DimensionNarrative[];
}

export interface ConsultingFinding {
  id: string;
  title: string;
  statement: string;
  evidence: string;
  implication: string;
  recommendation: string;
  severity: "high" | "medium" | "low";
}

export interface PriorityMatrixItem {
  id: string;
  label: string;
  category: "能力短板" | "转型阻碍" | "推进机会";
  impact: number;
  urgency: number;
  priority: "P0" | "P1" | "P2";
  rationale: string;
}

export interface ActionPlanItem {
  phase: "30天" | "60天" | "90天";
  title: string;
  owner: string;
  actions: string[];
  metric: string;
}

export interface ReportChapter {
  id: string;
  title: string;
  subtitle: string;
  narrative: string;
  evidence: string[];
  recommendations: string[];
}

export interface GeneratedSurveyReport {
  id: string;
  surveyId: string;
  templateId: string;
  title: string;
  status: "completed";
  generatedAt: string;
  summary: string;
  sections: Array<{
    id: string;
    title: string;
    content: string;
    metrics?: ReportMetricDisplay[];
    insights?: string[];
  }>;
  executiveSummary: ExecutiveSummary;
  methodology: ReportMethodology;
  diagnostics: DiagnosticSummary;
  consultingFindings: ConsultingFinding[];
  priorityMatrix: PriorityMatrixItem[];
  actionPlan: ActionPlanItem[];
  chapters: ReportChapter[];
  charts: {
    industryDistribution: DistributionDatum[];
    companySizeDistribution: DistributionDatum[];
    blockerDistribution: DistributionDatum[];
    priorityDistribution: DistributionDatum[];
    digitalMaturityScore: number;
    maturityDistribution: DistributionDatum[];
    dimensionScores: DimensionScoreDatum[];
    questionDistributions: QuestionDistributionDatum[];
  };
}

const categoryReportType: Record<SurveyCategory, ReportType> = {
  customer_satisfaction: "customer_satisfaction_report",
  market_research: "market_research_report",
  product_feedback: "product_feedback_report",
  brand_research: "brand_analysis_report",
  employee_engagement: "employee_engagement_report",
  business_diagnosis: "business_diagnosis_report",
  event_feedback: "custom_report",
  custom: "custom_report",
};

export const sampleSurvey: SurveyBundle = {
  survey: {
    id: "survey_digital_2024",
    workspaceId: "workspace_boardx",
    title: "2024年企业数字化转型调研",
    description: "了解企业在数字化转型过程中的现状、挑战和成熟度。",
    category: "business_diagnosis",
    businessGoal: "评估企业数字化成熟度，识别关键阻碍，并输出咨询式行动建议。",
    targetAudience: "企业负责人、业务负责人、IT 管理者与数字化转型相关岗位。",
    status: "published",
    version: 3,
    createdBy: "u_zhang",
    createdAt: "2024-05-01",
    updatedAt: "2024-06-01",
    publishedAt: "2024-06-01",
  },
  sections: [
    {
      id: "section_profile",
      surveyId: "survey_digital_2024",
      title: "第一部分：企业基本信息",
      description: "用于识别受访企业的基础画像",
      order: 1,
    },
    {
      id: "section_maturity",
      surveyId: "survey_digital_2024",
      title: "第二部分：数字化现状评估",
      description: "了解企业当前数字化水平",
      order: 2,
    },
  ],
  questions: [
    {
      id: "q_industry",
      surveyId: "survey_digital_2024",
      sectionId: "section_profile",
      type: "industry_selector",
      title: "您所在企业的行业是？",
      required: true,
      order: 1,
      settings: { displayStyle: "list" },
      options: [
        { id: "industry_manufacturing", label: "制造业", value: "manufacturing" },
        { id: "industry_service", label: "服务业", value: "service" },
        { id: "industry_it", label: "IT/互联网", value: "it" },
        { id: "industry_finance", label: "金融业", value: "finance" },
        { id: "industry_other", label: "其他", value: "other" },
      ],
      analysisConfig: {
        includeInReport: true,
        role: "profile",
        recommendedChart: "bar",
        crossAnalysisEnabled: true,
      },
    },
    {
      id: "q_company_size",
      surveyId: "survey_digital_2024",
      sectionId: "section_profile",
      type: "company_size",
      title: "您所在企业的员工规模是？",
      required: true,
      order: 2,
      settings: { displayStyle: "list" },
      options: [
        { id: "size_50", label: "50人以下", value: "under_50" },
        { id: "size_200", label: "50-200人", value: "50_200" },
        { id: "size_500", label: "201-500人", value: "201_500" },
        { id: "size_1000", label: "501-1000人", value: "501_1000" },
        { id: "size_over", label: "1000人以上", value: "over_1000" },
      ],
      analysisConfig: {
        includeInReport: true,
        role: "segment",
        recommendedChart: "donut",
        crossAnalysisEnabled: true,
      },
    },
    {
      id: "q_strategy",
      surveyId: "survey_digital_2024",
      sectionId: "section_maturity",
      type: "scale",
      title: "贵企业是否已形成清晰的数字化战略？",
      description: "1 表示完全没有，5 表示非常清晰并已落地。",
      required: true,
      order: 3,
      settings: { min: 1, max: 5, step: 1, displayStyle: "button" },
      options: scoreOptions("strategy"),
      analysisConfig: {
        includeInReport: true,
        role: "dimension",
        dimensionKey: "digital_maturity",
        weight: 1.2,
        recommendedChart: "radar",
        crossAnalysisEnabled: true,
      },
    },
    {
      id: "q_data",
      surveyId: "survey_digital_2024",
      sectionId: "section_maturity",
      type: "scale",
      title: "贵企业的数据驱动决策水平如何？",
      required: true,
      order: 4,
      settings: { min: 1, max: 5, step: 1, displayStyle: "button" },
      options: scoreOptions("data"),
      analysisConfig: {
        includeInReport: true,
        role: "dimension",
        dimensionKey: "digital_maturity",
        weight: 1,
        recommendedChart: "radar",
        crossAnalysisEnabled: true,
      },
    },
    {
      id: "q_pain_points",
      surveyId: "survey_digital_2024",
      sectionId: "section_maturity",
      type: "multiple_choice",
      title: "企业数字化转型面临的主要挑战有哪些？",
      required: false,
      order: 5,
      settings: { displayStyle: "card", allowOther: true },
      options: [
        { id: "pain_talent", label: "缺少数字化人才", value: "talent" },
        { id: "pain_budget", label: "预算不足", value: "budget" },
        { id: "pain_data", label: "数据孤岛", value: "data_silo" },
        { id: "pain_process", label: "流程复杂", value: "process" },
      ],
      analysisConfig: {
        includeInReport: true,
        role: "metric",
        recommendedChart: "bar",
      },
    },
  ],
};

export const sampleResponses: SurveyResponse[] = [
  response("r1", "completed", 452, [
    answer("q_industry", "manufacturing", ["industry_manufacturing"]),
    answer("q_company_size", "201_500", ["size_500"]),
    answer("q_strategy", 4, ["strategy_4"]),
    answer("q_data", 4, ["data_4"]),
    answer("q_pain_points", ["talent", "data_silo"], ["pain_talent", "pain_data"]),
  ]),
  response("r2", "completed", 531, [
    answer("q_industry", "service", ["industry_service"]),
    answer("q_company_size", "50_200", ["size_200"]),
    answer("q_strategy", 3, ["strategy_3"]),
    answer("q_data", 4, ["data_4"]),
    answer("q_pain_points", ["budget"], ["pain_budget"]),
  ]),
  response("r3", "completed", 487, [
    answer("q_industry", "it", ["industry_it"]),
    answer("q_company_size", "over_1000", ["size_over"]),
    answer("q_strategy", 5, ["strategy_5"]),
    answer("q_data", 4, ["data_4"]),
    answer("q_pain_points", ["data_silo", "process"], ["pain_data", "pain_process"]),
  ]),
  response("r4", "completed", 430, [
    answer("q_industry", "manufacturing", ["industry_manufacturing"]),
    answer("q_company_size", "501_1000", ["size_1000"]),
    answer("q_strategy", 2, ["strategy_2"]),
    answer("q_data", 3, ["data_3"]),
    answer("q_pain_points", ["talent"], ["pain_talent"]),
  ]),
  response("r5", "in_progress", 0, [
    answer("q_industry", "finance", ["industry_finance"]),
    answer("q_company_size", "201_500", ["size_500"]),
  ]),
];

export function validateSurveyForPublish(input: {
  survey: Survey;
  sections: SurveySection[];
  questions: SurveyQuestion[];
  reportTemplate?: ReportTemplate;
}): SurveyValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input.survey.title.trim()) {
    errors.push("问卷必须有标题");
  }

  if (input.questions.length === 0) {
    errors.push("至少包含 1 个问题");
  }

  for (const question of input.questions) {
    if (question.required && !question.title.trim()) {
      errors.push("必填题不能没有标题");
    }

    const needsOptions = ["single_choice", "multiple_choice", "dropdown"].includes(
      question.type
    );
    if (needsOptions && (question.options ?? []).length < 2) {
      errors.push(`${question.title || question.id} 至少需要 2 个选项`);
    }
  }

  if (!input.reportTemplate) {
    errors.push("报告模板必须存在");
  } else {
    const questionIds = new Set(input.questions.map((question) => question.id));
    const invalidSource = input.reportTemplate.sections.some((section) =>
      section.sourceQuestionIds.some((questionId) => !questionIds.has(questionId))
    );
    if (invalidSource) {
      errors.push("报告模板 sourceQuestionIds 必须有效");
    }
  }

  if (!input.questions.some((question) => question.analysisConfig?.role === "profile")) {
    warnings.push("建议至少包含一个画像题");
  }

  if (!input.questions.some((question) => question.analysisConfig?.role === "dimension")) {
    warnings.push("建议至少包含一个核心维度题");
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

export function generateReportTemplate(bundle: SurveyBundle): {
  reportTemplate: ReportTemplate;
  warnings: string[];
  suggestions: string[];
} {
  const reportableQuestions = bundle.questions.filter(
    (question) => question.analysisConfig?.includeInReport
  );
  const profileQuestions = byRole(reportableQuestions, "profile");
  const metricQuestions = byRole(reportableQuestions, "metric");
  const dimensionQuestions = byRole(reportableQuestions, "dimension");
  const segmentQuestions = byRole(reportableQuestions, "segment");
  const openQuestions = byRole(reportableQuestions, "open_feedback");

  const sections: ReportSection[] = [
    reportSection("report_section_summary", "总体概览", "executive_summary", 1, reportableQuestions),
    reportSection("report_section_profile", "样本画像", "sample_profile", 2, profileQuestions),
    reportSection("report_section_metrics", "关键指标", "key_metrics", 3, metricQuestions),
    reportSection(
      "report_section_dimension",
      "数字化成熟度分析",
      "dimension_analysis",
      4,
      dimensionQuestions
    ),
    reportSection(
      "report_section_cross",
      "交叉分析",
      "cross_analysis",
      5,
      [...profileQuestions, ...segmentQuestions, ...dimensionQuestions]
    ),
    reportSection(
      "report_section_recommendation",
      "行动建议",
      "recommendation",
      6,
      reportableQuestions
    ),
    reportSection("report_section_appendix", "原始数据附录", "appendix", 7, reportableQuestions),
  ];

  const metrics: ReportMetric[] = [
    {
      id: "metric_response_count",
      name: "样本总数",
      key: "response_count",
      type: "response_count",
      formula: { method: "count" },
      displayFormat: "number",
    },
    {
      id: "metric_completion_rate",
      name: "完成率",
      key: "completion_rate",
      type: "completion_rate",
      formula: { method: "ratio" },
      displayFormat: "percent",
    },
    ...dimensionKeys(dimensionQuestions).map<ReportMetric>((dimensionKey) => ({
      id: `metric_${dimensionKey}`,
      name: "数字化成熟度得分",
      key: `${dimensionKey}_score`,
      type: "dimension_score",
      formula: { method: "weighted_score", params: { dimensionKey } },
      displayFormat: "score",
    })),
  ];

  const charts: ReportChart[] = reportableQuestions.map((question) => ({
    id: `chart_${question.id}`,
    title: question.title,
    type: question.analysisConfig?.recommendedChart ?? "bar",
    sourceQuestionIds: [question.id],
    dimensionQuestionId: question.analysisConfig?.dimensionKey,
    config: {
      xField: "label",
      yField: "value",
      showCount: true,
      showPercent: true,
      sortBy: "count",
    },
  }));

  const warnings: string[] = [];
  const suggestions: string[] = [];

  if (profileQuestions.length === 0) {
    warnings.push("缺少画像题，报告中的样本分层分析会较弱。");
  }

  if (dimensionQuestions.length === 0) {
    warnings.push("缺少维度题，无法形成专业成熟度或能力模型。");
  }

  if (openQuestions.length === 0) {
    suggestions.push("可增加开放题，用于提炼企业转型痛点和行动建议。");
  }

  const now = new Date().toISOString();
  return {
    reportTemplate: {
      id: `report_template_${bundle.survey.id}`,
      surveyId: bundle.survey.id,
      title: `${bundle.survey.title}报告模板`,
      description: `根据“${bundle.survey.businessGoal}”自动生成的专属分析结构。`,
      reportType: categoryReportType[bundle.survey.category],
      sections,
      metrics,
      charts,
      insightRules: [
        "样本量低于 30 时提示谨慎解读",
        "按行业与企业规模交叉识别高成熟度分群",
        "低于 3 分的维度进入优先改进建议",
      ],
      aiPromptConfig: {
        style: "consulting",
        depth: "standard",
        language: "zh-CN",
      },
      createdAt: now,
      updatedAt: now,
    },
    warnings,
    suggestions,
  };
}

export function calculateSurveyReport(
  bundle: SurveyBundle,
  responses: SurveyResponse[],
  template: ReportTemplate
): GeneratedSurveyReport {
  const completed = responses.filter((item) => item.status === "completed");
  const completionRate = responses.length === 0 ? 0 : Math.round((completed.length / responses.length) * 100);
  const averageSeconds = average(
    completed.map((item) => item.durationSeconds ?? 0).filter((seconds) => seconds > 0)
  );
  const dimensionKey = primaryDimensionKey(bundle.questions);
  const maturityScore = calculateDimensionScore(dimensionKey, bundle.questions, completed);
  const industryQuestion = preferredQuestion(bundle.questions, "q_industry", "profile");
  const companySizeQuestion = preferredQuestion(bundle.questions, "q_company_size", "segment");
  const dimensionQuestions = byRole(bundle.questions, "dimension");
  const metricQuestions = byRole(bundle.questions, "metric");
  const blockerQuestion =
    metricQuestions.find((question) => /阻碍|挑战|痛点/.test(question.title)) ?? metricQuestions[0];
  const priorityQuestion =
    metricQuestions.find((question) => /优先|方向|计划/.test(question.title)) ?? metricQuestions[1];
  const industryDistribution = optionDistribution(industryQuestion, completed);
  const companySizeDistribution = optionDistribution(companySizeQuestion, completed);
  const blockerDistribution = optionDistribution(blockerQuestion, completed);
  const priorityDistribution = optionDistribution(priorityQuestion, completed);
  const dimensionScores = dimensionKeys(dimensionQuestions).map<DimensionScoreDatum>((key) => {
    const score = calculateDimensionScore(key, bundle.questions, completed);
    const sampleCount = calculateDimensionSampleCount(key, bundle.questions, completed);
    return {
      key,
      label: dimensionLabel(key, dimensionQuestions),
      score,
      level: maturityLevel(score),
      sampleCount,
    };
  });
  const weakestDimension = dimensionScores
    .filter((item) => item.score > 0)
    .sort((a, b) => a.score - b.score)[0];
  const strongestDimension = dimensionScores
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0];
  const topIndustry = topDatum(industryDistribution);
  const topBlocker = topDatum(blockerDistribution);
  const topPriority = topDatum(priorityDistribution);
  const scoreSpread =
    dimensionScores.length > 1
      ? roundToOne(Math.max(...dimensionScores.map((item) => item.score)) - Math.min(...dimensionScores.map((item) => item.score)))
      : 0;
  const confidenceLabel = sampleConfidenceLabel(completed.length);
  const segmentCoverage = [
    topIndustry ? `行业样本以${topIndustry.label}为主` : "行业样本待补充",
    topDatum(companySizeDistribution)
      ? `企业规模以${topDatum(companySizeDistribution)?.label}为主`
      : "企业规模样本待补充",
  ];
  const methodology: ReportMethodology = {
    sampleSize: responses.length,
    validResponses: completed.length,
    completionRate,
    averageDuration: formatDuration(averageSeconds),
    confidenceLabel,
    confidenceNote: sampleConfidenceNote(completed.length),
    dataQualityScore: reportDataQualityScore(completed.length, completionRate, industryDistribution, companySizeDistribution),
    segmentCoverage,
    limitations: reportLimitations(completed.length, industryDistribution, companySizeDistribution),
  };
  const diagnostics: DiagnosticSummary = {
    strongest: strongestDimension,
    weakest: weakestDimension,
    scoreSpread,
    narratives: dimensionScores
      .filter((item) => item.sampleCount > 0)
      .map((item) => ({
        key: item.key,
        label: item.label,
        score: item.score,
        level: item.level,
        diagnosis: dimensionDiagnosis(item.score, item.label),
        evidence: `${item.sampleCount} 份有效样本在该维度的加权均分为 ${item.score.toFixed(1)}，处于${item.level}。`,
        recommendation: dimensionRecommendation(item.score, item.label),
      })),
  };
  const consultingFindings = buildConsultingFindings({
    maturityScore,
    maturityLevel: maturityLevel(maturityScore),
    topIndustry,
    topBlocker,
    topPriority,
    weakestDimension,
    scoreSpread,
    completedCount: completed.length,
  });
  const priorityMatrix = buildPriorityMatrix({
    weakestDimension,
    topBlocker,
    topPriority,
    maturityScore,
  });
  const actionPlan = buildActionPlan({
    weakestDimension,
    strongestDimension,
    topBlocker,
    topPriority,
  });
  const recommendedFocus =
    priorityMatrix[0]?.label ??
    weakestDimension?.label ??
    topBlocker?.label ??
    "继续扩大样本并完善数字化诊断维度";
  const executiveSummary: ExecutiveSummary = {
    headline: `${bundle.survey.title}显示：整体处于${maturityLevel(maturityScore)}，下一阶段应聚焦“${recommendedFocus}”。`,
    boardMessage: buildBoardMessage(maturityScore, weakestDimension, topBlocker, topPriority),
    maturityScore,
    maturityLevel: maturityLevel(maturityScore),
    confidenceLabel,
    recommendedFocus,
    nextReview: "建议在 90 天行动计划结束后复测，并对高优先级维度进行部门级拆解。",
  };
  const chapters = buildReportChapters({
    surveyTitle: bundle.survey.title,
    businessGoal: bundle.survey.businessGoal,
    targetAudience: bundle.survey.targetAudience,
    executiveSummary,
    methodology,
    diagnostics,
    consultingFindings,
    priorityMatrix,
    actionPlan,
    topIndustry,
    topBlocker,
    topPriority,
    completedCount: completed.length,
  });
  const dynamicInsights = [
    topIndustry
      ? `${topIndustry.label}样本占比最高，占有效样本 ${topIndustry.percent}%，报告解读应优先关注该类企业的转型场景。`
      : "样本画像数据仍在积累，建议扩大投放后再进行分层解读。",
    `数字化成熟度均分为 ${maturityScore.toFixed(1)} 分，整体处于${maturityLevel(maturityScore)}，需要从单点建设转向体系化经营。`,
    weakestDimension
      ? `${weakestDimension.label}是当前相对短板，均分 ${weakestDimension.score.toFixed(1)} 分，是影响整体成熟度继续提升的关键约束。`
      : "暂未形成稳定的维度短板判断。",
    topBlocker
      ? `受访者最集中的转型阻碍是“${topBlocker.label}”，占比 ${topBlocker.percent}%，需要进入管理层专项治理议题。`
      : "关键阻碍题暂无有效分布。",
    topPriority
      ? `未来 12 个月最受关注的推进方向是“${topPriority.label}”，占比 ${topPriority.percent}%，可作为近期投入和试点的牵引方向。`
      : "推进优先级题暂无有效分布。",
  ];
  const recommendationInsights = [
    weakestDimension
      ? `围绕“${weakestDimension.label}”建立 30/60/90 天改进路线图，并指定业务负责人。`
      : "先补齐维度评估样本，再形成季度改进路线图。",
    topBlocker
      ? `针对“${topBlocker.label}”设置专项治理任务，明确预算、系统和组织协同边界。`
      : "用后续答卷继续识别高频阻碍，再决定专项投入。",
    strongestDimension
      ? `保留“${strongestDimension.label}”中的成熟实践，将其复制到薄弱部门或业务线。`
      : "形成可复用的数字化实践库，便于后续横向复制。",
  ];

  const generatedAt = new Date().toISOString();

  return {
    id: `report_${bundle.survey.id}_${generatedAt.replace(/\D/g, "").slice(0, 17)}`,
    surveyId: bundle.survey.id,
    templateId: template.id,
    title: `${bundle.survey.title}报告`,
    status: "completed",
    generatedAt,
    summary: `共回收 ${responses.length} 份样本，有效完成 ${completed.length} 份，完成率 ${completionRate}%。数字化成熟度均分为 ${maturityScore.toFixed(
      1
    )} 分，整体处于${maturityLevel(maturityScore)}。建议优先聚焦“${recommendedFocus}”。`,
    sections: [
      {
        id: "generated_overview",
        title: "总体概览",
        content: executiveSummary.boardMessage,
        metrics: [
          { label: "样本总数", value: String(responses.length), tone: "blue" },
          { label: "有效样本", value: String(completed.length), tone: "green" },
          { label: "完成率", value: `${completionRate}%`, tone: "violet" },
          { label: "平均用时", value: formatDuration(averageSeconds), tone: "amber" },
        ],
        insights: dynamicInsights,
      },
      {
        id: "generated_recommendations",
        title: "行动建议",
        content: `围绕“${recommendedFocus}”建立分阶段推进机制，并用复测数据跟踪管理动作是否真正改善成熟度。`,
        insights: recommendationInsights,
      },
    ],
    executiveSummary,
    methodology,
    diagnostics,
    consultingFindings,
    priorityMatrix,
    actionPlan,
    chapters,
    charts: {
      industryDistribution,
      companySizeDistribution,
      blockerDistribution,
      priorityDistribution,
      digitalMaturityScore: maturityScore,
      maturityDistribution: scoreDistribution(bundle.questions, completed, dimensionKey),
      dimensionScores,
      questionDistributions: bundle.questions
        .filter((question) => question.analysisConfig?.includeInReport && (question.options ?? []).length > 0)
        .map((question) => ({
          questionId: question.id,
          title: question.title,
          role: question.analysisConfig?.role,
          type: question.type,
          data: optionDistribution(question, completed),
        })),
    },
  };
}

export function calculateDimensionScore(
  dimensionKey: string,
  questions: SurveyQuestion[],
  responses: SurveyResponse[]
): number {
  const dimensionQuestions = questions.filter(
    (question) => question.analysisConfig?.dimensionKey === dimensionKey
  );
  const responseScores = responses
    .map((responseItem) => {
      let totalScore = 0;
      let totalWeight = 0;

      for (const question of dimensionQuestions) {
        const answerItem = responseItem.answers.find((answer) => answer.questionId === question.id);
        const score = getAnswerScore(question, answerItem);
        if (score === undefined) {
          continue;
        }

        const weight = question.analysisConfig?.weight ?? 1;
        totalScore += score * weight;
        totalWeight += weight;
      }

      return totalWeight === 0 ? undefined : totalScore / totalWeight;
    })
    .filter((score): score is number => typeof score === "number");

  return roundTo(average(responseScores), 1);
}

function calculateDimensionSampleCount(
  dimensionKey: string,
  questions: SurveyQuestion[],
  responses: SurveyResponse[]
): number {
  const dimensionQuestions = questions.filter(
    (question) => question.analysisConfig?.dimensionKey === dimensionKey
  );
  return responses.filter((responseItem) =>
    dimensionQuestions.some((question) => {
      const answerItem = responseItem.answers.find((answer) => answer.questionId === question.id);
      return getAnswerScore(question, answerItem) !== undefined;
    })
  ).length;
}

function scoreOptions(prefix: string): QuestionOption[] {
  return [1, 2, 3, 4, 5].map((score) => ({
    id: `${prefix}_${score}`,
    label: `${score}分`,
    value: String(score),
    score,
  }));
}

function response(
  id: string,
  status: SurveyResponse["status"],
  durationSeconds: number,
  answers: SurveyAnswer[]
): SurveyResponse {
  return {
    id,
    surveyId: "survey_digital_2024",
    status,
    startedAt: "2024-06-01T09:00:00.000Z",
    submittedAt: status === "completed" ? "2024-06-01T09:10:00.000Z" : undefined,
    durationSeconds,
    metadata: { device: "desktop", channel: "email" },
    answers,
  };
}

function answer(questionId: string, value: SurveyAnswer["value"], optionIds?: string[]): SurveyAnswer {
  return { questionId, value, optionIds };
}

function byRole(questions: SurveyQuestion[], role: AnalysisRole): SurveyQuestion[] {
  return questions.filter((question) => question.analysisConfig?.role === role);
}

function reportSection(
  id: string,
  title: string,
  type: ReportSectionType,
  order: number,
  questions: SurveyQuestion[]
): ReportSection {
  return {
    id,
    title,
    type,
    order,
    sourceQuestionIds: questions.map((question) => question.id),
    chartIds: questions.map((question) => `chart_${question.id}`),
    metricIds: order === 1 || order === 3 ? ["metric_response_count", "metric_completion_rate"] : [],
    aiAnalysisEnabled: type !== "appendix",
  };
}

function dimensionKeys(questions: SurveyQuestion[]): string[] {
  return Array.from(
    new Set(
      questions
        .map((question) => question.analysisConfig?.dimensionKey)
        .filter((dimensionKey): dimensionKey is string => Boolean(dimensionKey))
    )
  );
}

function preferredQuestion(
  questions: SurveyQuestion[],
  preferredQuestionId: string,
  role: AnalysisRole
): SurveyQuestion | undefined {
  return (
    questions.find((item) => item.id === preferredQuestionId) ??
    questions.find((item) => item.analysisConfig?.role === role)
  );
}

function primaryDimensionKey(questions: SurveyQuestion[]): string {
  return (
    questions.find((question) => question.analysisConfig?.dimensionKey)?.analysisConfig
      ?.dimensionKey ?? "digital_maturity"
  );
}

function optionDistribution(
  question: SurveyQuestion | undefined,
  responses: SurveyResponse[]
): DistributionDatum[] {
  if (!question) {
    return [];
  }

  const counts = new Map<string, number>();

  for (const responseItem of responses) {
    const answerItem = responseItem.answers.find((item) => item.questionId === question.id);
    if (!answerItem) {
      continue;
    }

    const values = Array.isArray(answerItem.value) ? answerItem.value : [answerItem.value];
    for (const value of values) {
      if (typeof value !== "string") {
        continue;
      }

      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  const total = Array.from(counts.values()).reduce((sum, value) => sum + value, 0);
  return (question.options ?? [])
    .map((option) => {
      const value = counts.get(option.value) ?? 0;
      return {
        label: option.label,
        value,
        percent: total === 0 ? 0 : Math.round((value / total) * 100),
      };
    })
    .filter((item) => item.value > 0);
}

function scoreDistribution(
  questions: SurveyQuestion[],
  responses: SurveyResponse[],
  dimensionKey: string
): DistributionDatum[] {
  const buckets = new Map([
    ["初级阶段", 0],
    ["发展阶段", 0],
    ["成熟阶段", 0],
    ["领先阶段", 0],
  ]);

  for (const responseItem of responses) {
    const score = calculateDimensionScore(dimensionKey, questions, [responseItem]);
    if (score < 3) {
      buckets.set("初级阶段", (buckets.get("初级阶段") ?? 0) + 1);
    } else if (score < 3.6) {
      buckets.set("发展阶段", (buckets.get("发展阶段") ?? 0) + 1);
    } else if (score < 4.2) {
      buckets.set("成熟阶段", (buckets.get("成熟阶段") ?? 0) + 1);
    } else {
      buckets.set("领先阶段", (buckets.get("领先阶段") ?? 0) + 1);
    }
  }

  const total = responses.length;
  return Array.from(buckets.entries()).map(([label, value]) => ({
    label,
    value,
    percent: total === 0 ? 0 : Math.round((value / total) * 100),
  }));
}

function topDatum(data: DistributionDatum[]): DistributionDatum | undefined {
  return [...data].sort((a, b) => b.value - a.value)[0];
}

function dimensionLabel(key: string, questions: SurveyQuestion[]): string {
  const question = questions.find((item) => item.analysisConfig?.dimensionKey === key);
  if (!question) {
    return key;
  }

  return question.title
    .replace(/^企业是否已形成清晰的/, "")
    .replace(/^核心业务流程的/, "业务流程")
    .replace(/^企业/, "")
    .replace(/如何？$/, "")
    .replace(/是否/, "")
    .replace(/[？?]/g, "");
}

function maturityLevel(score: number): string {
  if (score <= 0) {
    return "暂无评分";
  }
  if (score < 3) {
    return "初级阶段";
  }
  if (score < 3.6) {
    return "发展阶段";
  }
  if (score < 4.2) {
    return "成熟阶段";
  }
  return "领先阶段";
}

function sampleConfidenceLabel(validResponses: number): string {
  if (validResponses >= 100) {
    return "高可信";
  }
  if (validResponses >= 30) {
    return "中可信";
  }
  if (validResponses > 0) {
    return "方向性参考";
  }
  return "暂无样本";
}

function sampleConfidenceNote(validResponses: number): string {
  if (validResponses >= 100) {
    return "样本量已具备较好的统计参考价值，可支持分群和趋势判断。";
  }
  if (validResponses >= 30) {
    return "样本量可支持总体判断，细分人群结论仍建议结合业务访谈验证。";
  }
  if (validResponses > 0) {
    return "当前样本量较小，结论用于识别方向和优先级，不宜作为最终投资决策的唯一依据。";
  }
  return "尚无有效样本，报告将以问卷结构和待采集指标为主。";
}

function reportDataQualityScore(
  validResponses: number,
  completionRate: number,
  industryDistribution: DistributionDatum[],
  companySizeDistribution: DistributionDatum[]
): number {
  const sampleScore = Math.min(validResponses / 30, 1) * 35;
  const completionScore = (completionRate / 100) * 30;
  const profileScore = Math.min(industryDistribution.length / 3, 1) * 18;
  const segmentScore = Math.min(companySizeDistribution.length / 3, 1) * 17;
  return Math.round(sampleScore + completionScore + profileScore + segmentScore);
}

function reportLimitations(
  validResponses: number,
  industryDistribution: DistributionDatum[],
  companySizeDistribution: DistributionDatum[]
): string[] {
  const limitations: string[] = [];
  if (validResponses < 30) {
    limitations.push("样本量低于 30 份，建议将结论定位为方向性诊断，并通过访谈或追加样本复核。");
  }
  if (industryDistribution.length < 3) {
    limitations.push("行业覆盖不足，跨行业对比不宜过度解读。");
  }
  if (companySizeDistribution.length < 3) {
    limitations.push("企业规模覆盖不足，规模差异结论需要补充样本后再确认。");
  }
  return limitations.length > 0 ? limitations : ["样本结构基本满足本轮总体诊断需要。"];
}

function dimensionDiagnosis(score: number, label: string): string {
  if (score <= 0) {
    return `${label}尚未形成可计算数据，需要补充有效答卷。`;
  }
  if (score < 3) {
    return `${label}仍处于基础建设期，能力不稳定，容易成为业务规模化推进的瓶颈。`;
  }
  if (score < 3.6) {
    return `${label}已具备局部实践，但标准化和跨部门复制能力不足。`;
  }
  if (score < 4.2) {
    return `${label}已进入相对成熟阶段，下一步应关注运营化、指标化和持续优化。`;
  }
  return `${label}表现领先，可沉淀为方法论并向其他业务线复制。`;
}

function dimensionRecommendation(score: number, label: string): string {
  if (score < 3) {
    return `优先建立“${label}”的责任人、基础流程和最小可衡量指标。`;
  }
  if (score < 3.6) {
    return `将“${label}”从项目经验固化为制度、模板和跨部门协同机制。`;
  }
  if (score < 4.2) {
    return `围绕“${label}”建立月度复盘机制，持续跟踪业务收益和执行偏差。`;
  }
  return `提炼“${label}”的最佳实践，作为其他薄弱维度的复制样板。`;
}

function buildBoardMessage(
  maturityScore: number,
  weakestDimension: DimensionScoreDatum | undefined,
  topBlocker: DistributionDatum | undefined,
  topPriority: DistributionDatum | undefined
): string {
  const shortBoard =
    weakestDimension && topBlocker
      ? `当前主要矛盾不是是否推进数字化，而是“${weakestDimension.label}”能力不足与“${topBlocker.label}”阻碍叠加，限制了数字化投入转化为经营结果。`
      : "当前报告主要用于建立数字化现状基线，后续需要通过样本扩充和复测提升判断稳定性。";
  const priorityText = topPriority
    ? `建议以“${topPriority.label}”作为近期业务牵引，避免数字化建设停留在工具上线层面。`
    : "建议先补齐优先级题样本，再明确近期投入方向。";
  return `成熟度均分为 ${maturityScore.toFixed(1)} 分。${shortBoard}${priorityText}`;
}

function buildConsultingFindings(input: {
  maturityScore: number;
  maturityLevel: string;
  topIndustry?: DistributionDatum;
  topBlocker?: DistributionDatum;
  topPriority?: DistributionDatum;
  weakestDimension?: DimensionScoreDatum;
  scoreSpread: number;
  completedCount: number;
}): ConsultingFinding[] {
  const findings: ConsultingFinding[] = [
    {
      id: "finding_maturity",
      title: "成熟度判断",
      statement: `整体数字化成熟度为 ${input.maturityScore.toFixed(1)} 分，处于${input.maturityLevel}。`,
      evidence: `${input.completedCount} 份有效样本参与加权评分，维度分差为 ${input.scoreSpread.toFixed(1)} 分。`,
      implication:
        input.maturityScore >= 3.6
          ? "组织已经具备继续深化的基础，管理重点应从建设投入转向价值兑现。"
          : "数字化建设仍偏基础，若缺少统一路线图，后续投入容易碎片化。",
      recommendation:
        input.maturityScore >= 3.6
          ? "建立经营指标与数字化项目的对应关系，按月复盘投入产出。"
          : "先明确关键业务场景和最小闭环，再推进系统或数据平台建设。",
      severity: input.maturityScore >= 3.6 ? "medium" : "high",
    },
  ];

  if (input.weakestDimension) {
    findings.push({
      id: "finding_weak_dimension",
      title: "核心短板",
      statement: `“${input.weakestDimension.label}”是当前最低维度，均分 ${input.weakestDimension.score.toFixed(1)}。`,
      evidence: `该维度处于${input.weakestDimension.level}，低于整体成熟度 ${Math.max(input.maturityScore - input.weakestDimension.score, 0).toFixed(1)} 分。`,
      implication: "短板维度会拖慢跨部门协同和业务规模化复制，是最应优先拆解的管理议题。",
      recommendation: `围绕“${input.weakestDimension.label}”设定 90 天改进目标，并纳入管理层例会追踪。`,
      severity: input.weakestDimension.score < 3 ? "high" : "medium",
    });
  }

  if (input.topBlocker) {
    findings.push({
      id: "finding_blocker",
      title: "主要阻碍",
      statement: `“${input.topBlocker.label}”是受访者反馈最集中的阻碍。`,
      evidence: `该选项占有效选择的 ${input.topBlocker.percent}%，共有 ${input.topBlocker.value} 次选择。`,
      implication: "阻碍项如果不被专项治理，后续项目推进会持续消耗组织协调成本。",
      recommendation: `将“${input.topBlocker.label}”拆成预算、流程、系统、人才四类原因，并设置治理负责人。`,
      severity: input.topBlocker.percent >= 40 ? "high" : "medium",
    });
  }

  if (input.topPriority) {
    findings.push({
      id: "finding_priority",
      title: "机会方向",
      statement: `“${input.topPriority.label}”是近期最受关注的推进方向。`,
      evidence: `该方向占比 ${input.topPriority.percent}%，代表样本中的主要投入意愿。`,
      implication: "该方向适合作为数字化建设与业务价值连接的试点入口。",
      recommendation: `选择 1 个高频业务场景启动“${input.topPriority.label}”试点，并设置可量化收益指标。`,
      severity: "low",
    });
  }

  if (input.topIndustry) {
    findings.push({
      id: "finding_profile",
      title: "样本画像",
      statement: `本次样本以${input.topIndustry.label}为主。`,
      evidence: `该行业占有效样本 ${input.topIndustry.percent}%。`,
      implication: "报告结论更适合解释该类企业场景，跨行业推广时需要补充样本校准。",
      recommendation: "后续投放应增加其他行业和规模企业样本，提升分群判断可靠性。",
      severity: input.topIndustry.percent >= 60 ? "medium" : "low",
    });
  }

  return findings;
}

function buildPriorityMatrix(input: {
  weakestDimension?: DimensionScoreDatum;
  topBlocker?: DistributionDatum;
  topPriority?: DistributionDatum;
  maturityScore: number;
}): PriorityMatrixItem[] {
  const items: PriorityMatrixItem[] = [];
  if (input.weakestDimension) {
    const impact = clamp(Math.round((5 - input.weakestDimension.score) * 22), 35, 100);
    const urgency = input.weakestDimension.score < 3 ? 92 : 72;
    items.push({
      id: "priority_weak_dimension",
      label: input.weakestDimension.label,
      category: "能力短板",
      impact,
      urgency,
      priority: priorityLevel(impact, urgency),
      rationale: "最低能力维度会直接限制整体成熟度提升，应优先进入管理改进池。",
    });
  }
  if (input.topBlocker) {
    const impact = clamp(55 + input.topBlocker.percent, 45, 100);
    const urgency = clamp(45 + input.topBlocker.percent, 35, 100);
    items.push({
      id: "priority_blocker",
      label: input.topBlocker.label,
      category: "转型阻碍",
      impact,
      urgency,
      priority: priorityLevel(impact, urgency),
      rationale: "高频阻碍会持续抬高项目推进成本，需要专项治理。",
    });
  }
  if (input.topPriority) {
    const impact = input.maturityScore >= 3.6 ? 78 : 64;
    const urgency = clamp(40 + input.topPriority.percent, 35, 95);
    items.push({
      id: "priority_opportunity",
      label: input.topPriority.label,
      category: "推进机会",
      impact,
      urgency,
      priority: priorityLevel(impact, urgency),
      rationale: "优先方向代表组织投入意愿，适合作为业务价值试点。",
    });
  }
  return items.sort((a, b) => b.impact + b.urgency - (a.impact + a.urgency));
}

function buildActionPlan(input: {
  weakestDimension?: DimensionScoreDatum;
  strongestDimension?: DimensionScoreDatum;
  topBlocker?: DistributionDatum;
  topPriority?: DistributionDatum;
}): ActionPlanItem[] {
  const focus = input.weakestDimension?.label ?? "数字化成熟度基线";
  const blocker = input.topBlocker?.label ?? "关键阻碍";
  const priority = input.topPriority?.label ?? "高价值数字化场景";
  return [
    {
      phase: "30天",
      title: `完成“${focus}”问题拆解`,
      owner: "业务负责人 + 数字化负责人",
      actions: [
        `访谈关键部门，确认“${focus}”低分的流程、数据和组织原因。`,
        `将“${blocker}”拆分为可治理的问题清单，并标注影响范围。`,
        "确定 1 个可在 90 天内验证价值的业务场景。",
      ],
      metric: "完成问题清单、责任人和基线指标定义。",
    },
    {
      phase: "60天",
      title: `启动“${priority}”试点`,
      owner: "项目负责人 + 一线业务团队",
      actions: [
        "建立试点看板，跟踪进度、成本、质量和业务收益。",
        `围绕“${blocker}”设置周度协调机制，消除跨部门阻塞。`,
        "沉淀流程模板、数据口径和复盘机制。",
      ],
      metric: "试点场景上线并产生首批可量化运营数据。",
    },
    {
      phase: "90天",
      title: "复测成熟度并复制有效实践",
      owner: "管理层例会 + PMO",
      actions: [
        "用同一问卷复测关键维度，比较成熟度变化。",
        input.strongestDimension
          ? `提炼“${input.strongestDimension.label}”中的成熟经验，复制到短板维度。`
          : "提炼试点过程中的有效方法，形成可复制清单。",
        "决定是否扩大到更多部门、区域或业务线。",
      ],
      metric: "短板维度提升 0.3 分以上，或形成下一轮投资决策依据。",
    },
  ];
}

function buildReportChapters(input: {
  surveyTitle: string;
  businessGoal: string;
  targetAudience: string;
  executiveSummary: ExecutiveSummary;
  methodology: ReportMethodology;
  diagnostics: DiagnosticSummary;
  consultingFindings: ConsultingFinding[];
  priorityMatrix: PriorityMatrixItem[];
  actionPlan: ActionPlanItem[];
  topIndustry?: DistributionDatum;
  topBlocker?: DistributionDatum;
  topPriority?: DistributionDatum;
  completedCount: number;
}): ReportChapter[] {
  const strongestText = input.diagnostics.strongest
    ? `优势维度为“${input.diagnostics.strongest.label}”，均分 ${input.diagnostics.strongest.score.toFixed(1)}。`
    : "优势维度仍需在样本补充后确认。";
  const weakestText = input.diagnostics.weakest
    ? `短板维度为“${input.diagnostics.weakest.label}”，均分 ${input.diagnostics.weakest.score.toFixed(1)}。`
    : "短板维度仍需在样本补充后确认。";
  const topFinding = input.consultingFindings[0];
  const priorityText =
    input.priorityMatrix
      .slice(0, 3)
      .map((item) => `${item.priority}：${item.label}`)
      .join("；") || "优先级矩阵待补充样本后生成。";

  return [
    {
      id: "chapter_executive",
      title: "一、管理层摘要",
      subtitle: "回答本轮调研最重要的经营问题",
      narrative: `${input.surveyTitle}围绕“${input.businessGoal}”展开，面向${input.targetAudience}收集反馈。报告显示，当前整体处于${input.executiveSummary.maturityLevel}，管理层应把后续资源聚焦在“${input.executiveSummary.recommendedFocus}”，并用 90 天复测验证改善效果。`,
      evidence: [
        `成熟度均分 ${input.executiveSummary.maturityScore.toFixed(1)} / 5，样本可信度为${input.executiveSummary.confidenceLabel}。`,
        input.topIndustry
          ? `样本以${input.topIndustry.label}为主，占有效画像样本 ${input.topIndustry.percent}%。`
          : "样本画像尚未形成稳定主群体。",
        topFinding?.statement ?? "当前报告以建立基线和识别优先级为主。",
      ],
      recommendations: [
        `将“${input.executiveSummary.recommendedFocus}”纳入近期管理议题。`,
        "用同一问卷在 90 天后复测，判断行动计划是否带来可度量改善。",
      ],
    },
    {
      id: "chapter_methodology",
      title: "二、样本与方法说明",
      subtitle: "说明结论适用范围和解读边界",
      narrative: `本报告基于 ${input.methodology.sampleSize} 份回收样本生成，其中 ${input.methodology.validResponses} 份为有效完成样本，完成率 ${input.methodology.completionRate}%。系统综合题目角色、选项得分、维度权重和分布数据生成诊断，因此报告既反映当前样本事实，也给出可操作的管理建议。`,
      evidence: [
        `平均填写用时 ${input.methodology.averageDuration}，数据质量评分 ${input.methodology.dataQualityScore}/100。`,
        ...input.methodology.segmentCoverage,
      ],
      recommendations: input.methodology.limitations,
    },
    {
      id: "chapter_diagnosis",
      title: "三、核心诊断",
      subtitle: "识别优势、短板与成熟度结构",
      narrative: `能力维度之间的分差为 ${input.diagnostics.scoreSpread.toFixed(1)} 分。${strongestText}${weakestText} 如果短板维度不能被拆解到责任人、业务场景和衡量指标，后续投入容易停留在工具建设层面。`,
      evidence: input.diagnostics.narratives.length
        ? input.diagnostics.narratives.map((item) => item.evidence)
        : ["暂无足够维度样本形成稳定诊断。"],
      recommendations: input.diagnostics.narratives.length
        ? input.diagnostics.narratives.map((item) => item.recommendation)
        : ["优先补充核心维度题样本，再生成正式诊断结论。"],
    },
    {
      id: "chapter_risk",
      title: "四、关键风险与机会",
      subtitle: "把分布数据转化为管理动作",
      narrative: `${input.topBlocker ? `当前最集中的阻碍是“${input.topBlocker.label}”。` : "当前阻碍分布仍需补充样本。"}${input.topPriority ? `最受关注的推进方向是“${input.topPriority.label}”。` : "推进方向尚未形成明显集中。"} 优先级矩阵显示：${priorityText}。`,
      evidence: input.consultingFindings.map((finding) => `${finding.title}：${finding.evidence}`),
      recommendations: input.consultingFindings.map((finding) => finding.recommendation),
    },
    {
      id: "chapter_action",
      title: "五、行动路线",
      subtitle: "形成 30/60/90 天落地节奏",
      narrative: `报告建议将行动拆成“诊断拆解、试点验证、复测复制”三个阶段推进。该路线适用于当前 ${input.completedCount} 份有效样本下的方向性判断，后续应结合部门访谈、经营数据和项目复盘进一步细化。`,
      evidence: input.actionPlan.map((item) => `${item.phase}：${item.title}，责任方为${item.owner}。`),
      recommendations: input.actionPlan.map((item) => `${item.phase}衡量指标：${item.metric}`),
    },
  ];
}

function priorityLevel(impact: number, urgency: number): PriorityMatrixItem["priority"] {
  if (impact >= 80 && urgency >= 80) {
    return "P0";
  }
  if (impact + urgency >= 135) {
    return "P1";
  }
  return "P2";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundToOne(value: number): number {
  return roundTo(value, 1);
}

function getAnswerScore(question: SurveyQuestion, answerItem?: SurveyAnswer): number | undefined {
  if (!answerItem) {
    return undefined;
  }

  if (typeof answerItem.value === "number") {
    return answerItem.value;
  }

  const selectedOptionId = answerItem.optionIds?.[0];
  const selectedOption = question.options?.find((option) => option.id === selectedOptionId);
  return selectedOption?.score;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatDuration(seconds: number): string {
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  return `${minutes}分${remainingSeconds}秒`;
}
