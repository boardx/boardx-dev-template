import type { SurveyReportCategoryInput } from "@repo/data";

function categoryRequirement(category: SurveyReportCategoryInput): string {
  const current = "requirement" in category
    ? String((category as SurveyReportCategoryInput & { requirement?: unknown }).requirement ?? "").trim()
    : "";
  return current || category.prompt.trim();
}

export function buildSurveyReportRequirementPayload(plan: {
  title: string;
  description: string;
  categories: SurveyReportCategoryInput[];
}) {
  return {
    title: plan.title,
    description: plan.description,
    categories: plan.categories
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((category) => ({
        id: category.id,
        name: category.name,
        description: category.description,
        analysisObjective: category.analysisObjective,
        analysisMethod: category.analysisMethod,
        requirement: categoryRequirement(category),
        questionIds: [...category.questionIds].sort((left, right) => left - right),
        outputType: category.outputType,
        chartTemplateId:
          category.outputType === "chart" ? category.chartTemplateId : undefined,
        order: category.order,
      })),
  };
}
