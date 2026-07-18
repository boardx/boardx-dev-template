import type {
  ReportInputMode,
  SurveyReportCategoryInput,
  SurveyReportCategoryPlanInput,
  SurveyReportChartTemplateId,
  SurveyReportChartType,
} from "@repo/data";

export interface ComposerQuestion {
  id: number | string;
  title: string;
  type: string;
  options: string[];
}

export interface ComposerSurvey {
  title: string;
  description: string;
  responses: number;
}

export interface ReportComposerPreviewSection {
  id: string;
  order: number;
  title: string;
  description: string;
  requirement: string;
  sourceScope: string;
  questionCount: number;
  inputModes: ReportInputMode[];
  text?: { headline: string; bullets: string[] };
  chart?: {
    title: string;
    templateId?: SurveyReportChartTemplateId;
    type?: SurveyReportChartType;
    style?: SurveyReportCategoryInput["chartStyle"];
    config?: SurveyReportCategoryInput["chartConfig"];
    dataPrompt?: string;
    prompt?: string;
    sampleSize: number;
    isSimulated: true;
    appliedConstraints: string[];
    rows: Array<{ label: string; value: number }>;
  };
  image?: { title: string; prompt: string };
  chat?: { title: string; insights: string[] };
}

export interface ReportComposerPreview {
  title: string;
  description: string;
  executiveSummary: string[];
  sections: ReportComposerPreviewSection[];
}

const CHART_TYPE_BY_TEMPLATE: Record<SurveyReportChartTemplateId, SurveyReportChartType> = {
  "line-simple": "line",
  "bar-simple": "bar",
  "pie-simple": "pie",
  "scatter-simple": "scatter",
  radar: "radar",
  funnel: "funnel",
  gauge: "gauge",
  "heatmap-cartesian": "heatmap",
};

const REPORT_INPUT_MODE_ORDER: ReportInputMode[] = ["text", "chat", "chart", "image"];

function stableCategoryFields(category: SurveyReportCategoryInput) {
  const chartConfig = category.chartConfig;
  return [
    category.id,
    category.name,
    category.description,
    category.requirement ?? null,
    category.questionIds,
    category.outputType,
    category.inputModes[0],
    category.chartTemplateId ?? null,
    category.chartType ?? null,
    category.chartStyle ?? null,
    chartConfig
      ? [
          chartConfig.primaryColor,
          chartConfig.maxDimensions,
          chartConfig.sort,
          chartConfig.showLabels,
          chartConfig.showLegend,
          chartConfig.orientation,
        ]
      : null,
    category.dataPrompt ?? null,
    REPORT_INPUT_MODE_ORDER.map((mode) => category.modulePrompts?.[mode] ?? null),
    category.prompt,
    category.order,
    category.isCustom,
  ];
}

function stablePlanFields(plan: SurveyReportCategoryPlanInput) {
  return [
    plan.title,
    plan.description,
    orderedReportCategories(plan).map(stableCategoryFields),
  ];
}

export function areSurveyReportCategoryPlansEqual(
  left: SurveyReportCategoryPlanInput,
  right: SurveyReportCategoryPlanInput
): boolean {
  return JSON.stringify(stablePlanFields(left)) === JSON.stringify(stablePlanFields(right));
}

function buildTextPreview(
  category: SurveyReportCategoryInput,
  survey: ComposerSurvey,
  requirement: string
): NonNullable<ReportComposerPreviewSection["text"]> {
  return {
    headline: `${category.name} 的报告要求`,
    bullets: [
      requirement,
      `系统将在生成时从整份问卷和 ${survey.responses} 份授权答卷中检索所需证据。`,
      "正式报告会记录证据、限制条件和可执行建议。",
    ],
  };
}

function buildImagePreview(
  category: SurveyReportCategoryInput,
  requirement: string
): NonNullable<ReportComposerPreviewSection["image"]> {
  return {
    title: `${category.name} 图片要求`,
    prompt: requirement,
  };
}

function buildChartPreview(
  category: SurveyReportCategoryInput,
  survey: ComposerSurvey,
  requirement: string
): NonNullable<ReportComposerPreviewSection["chart"]> {
  const templateId = category.chartTemplateId ?? "line-simple";
  return {
    title: `${category.name} 图表预览`,
    templateId,
    type: CHART_TYPE_BY_TEMPLATE[templateId],
    style: category.chartStyle,
    config: category.chartConfig,
    dataPrompt: category.dataPrompt,
    prompt: requirement,
    sampleSize: survey.responses,
    isSimulated: true,
    appliedConstraints: [requirement],
    rows: [
      { label: "Mon", value: 150 },
      { label: "Tue", value: 230 },
      { label: "Wed", value: 224 },
      { label: "Thu", value: 218 },
      { label: "Fri", value: 135 },
      { label: "Sat", value: 147 },
      { label: "Sun", value: 260 },
    ],
  };
}

export function orderedReportCategories(plan: SurveyReportCategoryPlanInput): SurveyReportCategoryInput[] {
  return plan.categories.slice().sort((a, b) => a.order - b.order);
}

export function normalizeCategoryOrder(categories: SurveyReportCategoryInput[]): SurveyReportCategoryInput[] {
  return categories.map((category, index) => ({ ...category, order: index + 1 }));
}

export function moveReportCategory(
  plan: SurveyReportCategoryPlanInput,
  categoryId: string,
  direction: -1 | 1
): SurveyReportCategoryPlanInput {
  const categories = orderedReportCategories(plan);
  const index = categories.findIndex((category) => category.id === categoryId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= categories.length) return plan;
  const next = categories.slice();
  const current = next[index]!;
  next[index] = next[target]!;
  next[target] = current;
  return { ...plan, categories: normalizeCategoryOrder(next) };
}

export function addCustomReportCategory(
  plan: SurveyReportCategoryPlanInput,
  name = "自定义分类"
): SurveyReportCategoryPlanInput {
  const nextOrder = plan.categories.length + 1;
  return {
    ...plan,
    categories: [
      ...orderedReportCategories(plan),
      {
        id: `custom-${Date.now()}`,
        name,
        description: "从整份问卷和全部授权答卷中自主检索证据。",
        requirement: `面向决策者分析「${name}」，先给结论，再展示证据、样本边界和行动建议。`,
        questionIds: [],
        outputType: "text",
        inputModes: ["text"],
        prompt: `围绕「${name}」生成专业报告内容。`,
        order: nextOrder,
        isCustom: true,
      },
    ],
  };
}

export function updateReportCategory(
  plan: SurveyReportCategoryPlanInput,
  categoryId: string,
  patch: Partial<SurveyReportCategoryInput>
): SurveyReportCategoryPlanInput {
  return {
    ...plan,
    categories: normalizeCategoryOrder(
      orderedReportCategories(plan).map((category) =>
        category.id === categoryId ? { ...category, ...patch, id: category.id } : category
      )
    ),
  };
}

export function buildReportComposerPreview(
  plan: SurveyReportCategoryPlanInput,
  questions: ComposerQuestion[],
  survey: ComposerSurvey
): ReportComposerPreview {
  const categories = orderedReportCategories(plan);
  const sections = categories.map((category): ReportComposerPreviewSection => {
    const requirement =
      category.requirement?.trim() ||
      category.prompt?.trim() ||
      `面向决策者分析「${category.name}」，先给结论，再展示证据、样本边界和行动建议。`;
    const outputType = category.outputType ?? "text";
    return {
      id: category.id,
      order: category.order,
      title: category.name,
      description: category.description || "该章节将从完整事实库中自主检索所需证据。",
      requirement,
      sourceScope: "整份问卷与全部授权答卷",
      questionCount: questions.length,
      inputModes: [outputType],
      text: outputType === "text"
        ? buildTextPreview(category, survey, requirement)
        : undefined,
      image: outputType === "image"
        ? buildImagePreview(category, requirement)
        : undefined,
      chart: outputType === "chart"
        ? buildChartPreview(category, survey, requirement)
        : undefined,
    };
  });

  return {
    title: plan.title || `${survey.title} 专业报告`,
    description: plan.description || survey.description,
    executiveSummary: sections.slice(0, 4).map((section) => `${section.title}：${section.questionCount} 个问题`),
    sections,
  };
}
