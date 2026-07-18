import { describe, expect, it } from "vitest";
import { hashSurveyReportRequirement, type SurveyReportCategoryInput } from "@repo/data";
import { buildSurveyReportRequirementPayload } from "./survey-report-requirement";

function category(
  overrides: Partial<SurveyReportCategoryInput> = {}
): SurveyReportCategoryInput {
  return {
    id: "safety",
    name: "安全认知",
    description: "分析消费者关注点",
    requirement: "先给结论",
    questionIds: [11],
    outputType: "chart",
    inputModes: ["chart"],
    chartTemplateId: "bar-simple",
    chartType: "bar",
    prompt: "先给结论",
    order: 1,
    isCustom: false,
    ...overrides,
  };
}

function requirementHash(categoryOverrides: Partial<SurveyReportCategoryInput>) {
  return hashSurveyReportRequirement(buildSurveyReportRequirementPayload({
    title: "商品安全报告",
    description: "管理层报告",
    categories: [category(categoryOverrides)],
  }));
}

describe("buildSurveyReportRequirementPayload", () => {
  it("changes the requirement hash when the output type changes", () => {
    expect(requirementHash({ outputType: "text", inputModes: ["text"] }))
      .not.toBe(requirementHash({ outputType: "image", inputModes: ["image"] }));
  });

  it("changes the requirement hash when the chart template changes", () => {
    expect(requirementHash({ chartTemplateId: "bar-simple", chartType: "bar" }))
      .not.toBe(requirementHash({ chartTemplateId: "line-simple", chartType: "line" }));
  });
});
