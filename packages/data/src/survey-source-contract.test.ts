import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanSurveyReportCategoryPlan,
  defaultSurveyReportCategoryPlan,
  ensureSurveyReportCategoryPlan,
  readSurveyReportCategoryPlan,
  type SurveyQuestion,
} from "./survey";
import { query } from "./index";

vi.mock("./index", () => ({
  getPool: vi.fn(),
  query: vi.fn(),
}));

const mockQuery = vi.mocked(query);

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
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("builds report categories from persisted question categories", () => {
    const plan = defaultSurveyReportCategoryPlan("商品调研", questions);

    expect(plan.title).toBe("商品调研 专业报告");
    expect(plan.categories).toHaveLength(2);
    expect(plan.categories[0]).toMatchObject({
      name: "商品安全",
      questionIds: [11],
      outputType: "text",
      inputModes: ["text"],
    });
    expect(plan.categories[1]).toMatchObject({
      name: "开放反馈",
      questionIds: [12],
      outputType: "text",
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

  it("folds legacy module prompts into one natural-language requirement", () => {
    const plan = cleanSurveyReportCategoryPlan(
      {
        categories: [
          {
            name: "商品安全",
            prompt: "先给结论",
            dataPrompt: "标注样本量",
            modulePrompts: {
              chart: "突出关键差异",
              text: "给出行动建议",
            },
          },
        ],
      },
      "商品调研",
      questions
    );

    expect(plan.categories[0]?.requirement).toContain("先给结论");
    expect(plan.categories[0]?.requirement).toContain("标注样本量");
    expect(plan.categories[0]?.requirement).toContain("突出关键差异");
    expect(plan.categories[0]?.requirement).toContain("给出行动建议");
  });

  it("normalizes an explicit chart chapter to one output type", () => {
    const plan = cleanSurveyReportCategoryPlan({
      categories: [{
        id: "safety",
        name: "安全认知",
        outputType: "chart",
        inputModes: ["chart", "text"],
        chartType: "line",
        questionIds: [],
        prompt: "分析安全认知",
        order: 1,
        isCustom: false,
      }],
    }, "商品安全调研");

    expect(plan.categories[0]).toMatchObject({
      outputType: "chart",
      inputModes: ["chart"],
      chartTemplateId: "line-simple",
    });
  });

  it("defaults chapters without a valid output type to text", () => {
    const plan = cleanSurveyReportCategoryPlan({
      categories: [{
        id: "summary",
        name: "总结",
        inputModes: ["chart", "text"],
        chartType: "line",
      }],
    }, "商品安全调研");

    expect(plan.categories[0]).toMatchObject({
      outputType: "text",
      inputModes: ["text"],
    });
    expect(plan.categories[0]?.chartTemplateId).toBeUndefined();
  });

  it("falls back to the line template for an invalid chart template", () => {
    const plan = cleanSurveyReportCategoryPlan({
      categories: [{
        id: "safety",
        name: "安全认知",
        outputType: "chart",
        chartTemplateId: "unsupported",
        chartType: "bar",
      }],
    }, "商品安全调研");

    expect(plan.categories[0]).toMatchObject({
      outputType: "chart",
      inputModes: ["chart"],
      chartTemplateId: "line-simple",
      chartType: "line",
    });
  });

  it("removes chart templates from non-chart chapters", () => {
    const plan = cleanSurveyReportCategoryPlan({
      categories: [{
        id: "visual",
        name: "图片说明",
        outputType: "image",
        chartTemplateId: "bar-simple",
        chartType: "bar",
      }],
    }, "商品安全调研");

    expect(plan.categories[0]).toMatchObject({
      outputType: "image",
      inputModes: ["image"],
      chartType: undefined,
    });
    expect(plan.categories[0]?.chartTemplateId).toBeUndefined();
  });

  it("migrates only the output contract without rebinding persisted question IDs", async () => {
    const persistedPlan = {
      title: "商品安全报告",
      description: "管理层报告",
      categories: [{
        id: "safety",
        name: "安全认知",
        description: "分析消费者关注点",
        requirement: "先给结论",
        questionIds: [999, 11],
        outputType: "chart",
        inputModes: ["chart", "text"],
        chartTemplateId: "bar-simple",
        chartType: "line",
        chartStyle: "auto",
        chartConfig: {
          primaryColor: "#4f6edb",
          maxDimensions: 6,
          sort: "none",
          showLabels: true,
          showLegend: false,
          orientation: "vertical",
        },
        dataPrompt: "",
        modulePrompts: {},
        prompt: "先给结论",
        order: 1,
        isCustom: false,
      }],
    };
    const row = {
      id: 31,
      survey_id: 7,
      categoryPlan: persistedPlan,
      created_at: "2026-07-18T00:00:00.000Z",
      updated_at: "2026-07-18T00:00:00.000Z",
    };
    mockQuery.mockResolvedValueOnce([row]).mockResolvedValueOnce([row]);

    await ensureSurveyReportCategoryPlan(7, "商品调研", questions);

    const persistedMigration = JSON.parse(String(mockQuery.mock.calls[1]?.[1]?.[2]));
    expect(persistedMigration.categories[0]).toMatchObject({
      questionIds: [999, 11],
      outputType: "chart",
      inputModes: ["chart"],
      chartTemplateId: "bar-simple",
      chartType: "bar",
    });
  });

  it("normalizes report plans for read-only callers without persisting migration", async () => {
    const row = {
      id: 32,
      survey_id: 7,
      categoryPlan: {
        title: "只读报告",
        description: "",
        categories: [{
          id: "legacy",
          name: "旧章节",
          description: "",
          requirement: "先给结论",
          questionIds: [11],
          outputType: "chart",
          inputModes: ["chart", "text"],
          chartTemplateId: "bar-simple",
          prompt: "先给结论",
          order: 1,
          isCustom: false,
        }],
      },
      created_at: "2026-07-18T00:00:00.000Z",
      updated_at: "2026-07-18T00:00:00.000Z",
    };
    mockQuery.mockResolvedValueOnce([row]);

    const plan = await readSurveyReportCategoryPlan(
      7,
      "商品调研",
      questions
    );

    expect(plan.categories[0]).toMatchObject({
      outputType: "chart",
      inputModes: ["chart"],
      chartTemplateId: "bar-simple",
    });
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(String(mockQuery.mock.calls[0]?.[0])).toContain("SELECT");
  });
});
