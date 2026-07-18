import type {
  ReportInputMode,
  SurveyReportCategoryInput,
  SurveyReportCategoryPlanInput,
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
    return {
      id: category.id,
      order: category.order,
      title: category.name,
      description: category.description || "该章节将从完整事实库中自主检索所需证据。",
      requirement,
      sourceScope: "整份问卷与全部授权答卷",
      questionCount: questions.length,
      inputModes: ["text"],
      text: {
        headline: `${category.name} 的报告要求`,
        bullets: [
          requirement,
          `系统将在生成时从 ${questions.length} 个问题和 ${survey.responses} 份授权答卷中检索所需证据。`,
          "正式报告会记录证据、限制条件和可执行建议。",
        ],
      },
    };
  });

  return {
    title: plan.title || `${survey.title} 专业报告`,
    description: plan.description || survey.description,
    executiveSummary: sections.slice(0, 4).map((section) => `${section.title}：${section.questionCount} 个问题`),
    sections,
  };
}
