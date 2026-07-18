import { describe, expect, it } from "vitest";
import {
  cleanSurveyReportCategoryPlan,
  defaultSurveyReportCategoryPlan,
  type SurveyQuestion,
} from "./survey";

const questions: SurveyQuestion[] = [
  {
    id: 11,
    survey_id: 7,
    position: 0,
    title: "你最关注哪些安全信息？",
    type: "multiple",
    required: true,
    options: ["成分", "认证"],
    category: "商品安全",
  },
  {
    id: 12,
    survey_id: 7,
    position: 1,
    title: "还有哪些建议？",
    type: "text",
    required: false,
    options: [],
    category: "开放反馈",
  },
];

describe("Survey source data contract", () => {
  it("builds report categories from persisted question categories", () => {
    const plan = defaultSurveyReportCategoryPlan("商品调研", questions);

    expect(plan.title).toBe("商品调研 专业报告");
    expect(plan.categories).toHaveLength(2);
    expect(plan.categories[0]).toMatchObject({
      name: "商品安全",
      questionIds: [11],
      inputModes: ["chart", "text"],
      chartType: "bar",
    });
    expect(plan.categories[1]).toMatchObject({
      name: "开放反馈",
      questionIds: [12],
      inputModes: ["text"],
    });
  });

  it("cleans chart settings and binds omitted questions to a category", () => {
    const plan = cleanSurveyReportCategoryPlan(
      {
        title: " 安全洞察 ",
        categories: [
          {
            name: "商品安全",
            questionIds: ["11"],
            inputModes: ["chart", "invalid"],
            chartType: "bar",
            chartStyle: "invalid",
            chartConfig: { primaryColor: "bad", maxDimensions: 99, sort: "desc" },
            order: 9,
          },
          { name: "开放反馈", questionIds: [], inputModes: ["text"], order: 2 },
        ],
      },
      "商品调研",
      questions
    );

    expect(plan.title).toBe("安全洞察");
    expect(plan.categories.map((category) => category.order)).toEqual([1, 2]);
    const safetyCategory = plan.categories.find((category) => category.name === "商品安全");
    expect(safetyCategory?.chartStyle).toBe("auto");
    expect(safetyCategory?.chartConfig).toMatchObject({
      primaryColor: "#4f6edb",
      maxDimensions: 12,
      sort: "desc",
    });
    expect(plan.categories.flatMap((category) => category.questionIds).sort()).toEqual([11, 12]);
  });
});
