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

const modeOrder: ReportInputMode[] = ["image", "chart", "text"];

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
        description: "手动指定问题组成的新报告分类。",
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

function questionIdValue(id: number | string): number {
  return Number(id);
}

function questionsForCategory(category: SurveyReportCategoryInput, questions: ComposerQuestion[]) {
  const selected = new Set(category.questionIds.map(Number));
  return questions.filter((question) => selected.has(questionIdValue(question.id)));
}

function stableNumber(seed: string, index: number) {
  let value = 2166136261;
  for (const char of `${seed}-${index}`) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return Math.abs(value >>> 0);
}

function axisInstructionFromInstructions(instructions: string) {
  const explicitMatch = instructions.match(/[xXＸ]\s*轴(?:只要|仅(?:保留|显示)?|显示|使用)?\s*(\d+)?\s*个?\s*(?:值|项|分类|分组)?\s*(?:为|是|[:：])\s*([^\n。；;]+)/);
  const labels = (explicitMatch?.[2] ?? "")
    .split(/[，,、|/]/)
    .map((label) => label.trim())
    .filter(Boolean)
    .slice(0, 12);
  const countMatch = instructions.match(/[xXＸ]\s*轴[^\n。；;]*?(\d+)\s*个?\s*(?:值|项|分类|分组)/);
  const requestedCount = Number(explicitMatch?.[1] ?? countMatch?.[1] ?? 0);
  return {
    labels: labels.length > 1 ? labels : [],
    maxValues: requestedCount > 0 ? Math.min(requestedCount, 12) : undefined,
  };
}

function representativeLabels(labels: string[], count?: number) {
  if (!count || count >= labels.length) return labels;
  if (count === 1) return labels.slice(0, 1);
  return Array.from({ length: count }, (_, index) => {
    const sourceIndex = Math.round((index * (labels.length - 1)) / (count - 1));
    return labels[sourceIndex]!;
  });
}

function previewChartData(category: SurveyReportCategoryInput, questions: ComposerQuestion[], survey: ComposerSurvey) {
  const sourceQuestions = questionsForCategory(category, questions);
  const instructions = [category.dataPrompt, category.modulePrompts?.chart, category.prompt].filter(Boolean).join("\n");
  const sampleMatch = instructions.match(/(?:模拟)?样本量\s*(?:为|=|:|：)?\s*(\d+)/);
  const precisionMatch = instructions.match(/保留\s*(\d+)\s*位小数/);
  const sampleSize = sampleMatch ? Math.max(1, Number(sampleMatch[1])) : Math.max(survey.responses, 120);
  const precision = precisionMatch ? Math.min(3, Number(precisionMatch[1])) : 0;
  const axisInstruction = axisInstructionFromInstructions(instructions);
  const appliedConstraints = [
    sampleMatch ? `模拟样本量 ${sampleSize}` : `默认模拟样本量 ${sampleSize}`,
    precisionMatch ? `比例保留 ${precision} 位小数` : "使用整数展示",
    instructions.includes("有效答卷") ? "仅使用有效答卷" : "包含全部模拟答卷",
    instructions.match(/样本量小于\s*(\d+)/)?.[0],
    axisInstruction.maxValues ? `X轴仅显示 ${axisInstruction.maxValues} 个值` : undefined,
    axisInstruction.labels.length ? `X轴使用指定分组` : undefined,
  ].filter((item): item is string => Boolean(item));

  if (sourceQuestions.length === 0) {
    return { sampleSize, appliedConstraints, rows: [{ label: "待分配问题", value: 0 }] };
  }
  const optionLabels = sourceQuestions.flatMap((question) => question.options).filter(Boolean);
  const trendLabels = ["1月", "2月", "3月", "4月", "5月", "6月"];
  const fallbackLabels = sourceQuestions.map((question, index) => question.title.slice(0, 18) || `问题 ${index + 1}`);
  const baseLabels = axisInstruction.labels.length
    ? axisInstruction.labels
    : ["line", "area", "waterfall"].includes(category.chartType ?? "")
      ? trendLabels
      : optionLabels.length
        ? optionLabels
        : fallbackLabels;
  const configuredMaxDimensions = category.chartConfig?.maxDimensions;
  const labels = representativeLabels(baseLabels, axisInstruction.maxValues ?? configuredMaxDimensions).slice(0, 12);
  let rows = labels.map((label, index) => {
    const raw = 18 + (stableNumber(`${category.id}-${instructions}`, index) % 710) / 10;
    return { label, value: Number(raw.toFixed(precision)) };
  });
  const sort = category.chartConfig?.sort ?? "none";
  if (sort === "desc" || instructions.includes("从高到低") || instructions.includes("降序")) rows = rows.sort((a, b) => b.value - a.value);
  if (sort === "asc") rows = rows.sort((a, b) => a.value - b.value);
  if (configuredMaxDimensions) appliedConstraints.push(`最多显示 ${configuredMaxDimensions} 个维度`);
  return { sampleSize, appliedConstraints, rows };
}

function smartPreviewChartType(category: SurveyReportCategoryInput, questions: ComposerQuestion[]) {
  const text = `${category.name} ${category.description} ${questions.map((question) => question.title).join(" ")}`.toLowerCase();
  const hasChoice = questions.some((question) => ["single", "multiple", "dropdown"].includes(question.type) && question.options.length);
  const hasScore = questions.some((question) => ["rating", "linear_scale", "nps"].includes(question.type));
  const hasNumber = questions.some((question) => question.type === "number");
  const optionCount = questions.reduce((sum, question) => sum + question.options.length, 0);
  if (/(年龄|性别|地区|城市|画像|人群|职业|身份)/.test(text)) return optionCount <= 5 ? "doughnut" : "bar";
  if (/(购买|买过|下单|复购|转化|了解|认知)/.test(text)) return hasChoice ? "funnel" : "bar";
  if (/(安全信息|关注.*安全|认证|检测|成分|披露|信任)/.test(text)) return hasScore || optionCount >= 4 ? "radar" : "bar";
  if (/(风险|担心|顾虑|阻碍|疑虑|问题)/.test(text)) return optionCount >= 4 ? "heatmap" : "bar";
  if (/(价格|溢价|支付|预算|性价比|费用)/.test(text)) return hasNumber ? "boxplot" : hasChoice ? "bar" : "kpi";
  if (hasScore && questions.length > 1) return "radar";
  if (hasScore) return "gauge";
  if (hasChoice) return optionCount <= 4 ? "doughnut" : "bar";
  return "text";
}

function modeIncludes(category: SurveyReportCategoryInput, mode: ReportInputMode) {
  return category.inputModes.includes(mode);
}

function orderedModes(modes: ReportInputMode[]) {
  return modeOrder.filter((mode) => modes.includes(mode));
}

export function buildReportComposerPreview(
  plan: SurveyReportCategoryPlanInput,
  questions: ComposerQuestion[],
  survey: ComposerSurvey
): ReportComposerPreview {
  const categories = orderedReportCategories(plan);
  const sections = categories.map((category): ReportComposerPreviewSection => {
    const sourceQuestions = questionsForCategory(category, questions);
    const inputModes = orderedModes(category.inputModes);
    const base: ReportComposerPreviewSection = {
      id: category.id,
      order: category.order,
      title: category.name,
      description: category.description || "该分类将根据已分配问题生成报告内容。",
      questionCount: sourceQuestions.length,
      inputModes,
    };
    if (modeIncludes(category, "text")) {
      base.text = {
        headline: `${category.name} 的关键判断`,
        bullets: [
          category.modulePrompts?.text || category.prompt || `围绕「${category.name}」生成专业分析。`,
          sourceQuestions.length
            ? `覆盖 ${sourceQuestions.length} 个问题，样本回收 ${survey.responses} 份。`
            : "当前分类尚未分配问题，生成前需要补齐数据来源。",
          "正式报告会保留证据、限制条件和可执行建议。",
        ],
      };
    }
    if (modeIncludes(category, "chart")) {
      const simulated = previewChartData(category, questions, survey);
      const smartType = !category.chartType || category.chartType === "bar" ? smartPreviewChartType(category, sourceQuestions) : category.chartType;
      base.chart = {
        title: `${category.name} 数据报表`,
        type: smartType,
        style: category.chartStyle,
        config: category.chartConfig,
        dataPrompt: category.dataPrompt,
        prompt: category.modulePrompts?.chart,
        sampleSize: simulated.sampleSize,
        isSimulated: true,
        appliedConstraints: simulated.appliedConstraints,
        rows: simulated.rows,
      };
    }
    if (modeIncludes(category, "image")) {
      base.image = {
        title: `${category.name} 视觉说明`,
        prompt: category.modulePrompts?.image || `${survey.title}，${category.name}，专业商业调研报告配图，清晰数据语境，克制可信。`,
      };
    }
    if (modeIncludes(category, "chat")) {
      base.chat = {
        title: `${category.name} Chat 洞察`,
        insights: [
          category.modulePrompts?.chat || "从专家问答视角解释该分类的关键风险和机会。",
          "正式生成时会结合答卷数据输出更具体的追问和判断。",
        ],
      };
    }
    return base;
  });

  return {
    title: plan.title || `${survey.title} 专业报告`,
    description: plan.description || survey.description,
    executiveSummary: sections.slice(0, 4).map((section) => `${section.title}：${section.questionCount} 个问题`),
    sections,
  };
}
