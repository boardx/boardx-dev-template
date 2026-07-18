import { describe, expect, it } from "vitest";
import type { SurveyReportCategoryPlanInput } from "@repo/data";
import {
  areSurveyReportCategoryPlansEqual,
  buildReportComposerPreview,
} from "./survey-report-category-plan";

describe("buildReportComposerPreview", () => {
  it("builds only the selected chart output from the whole-survey source", () => {
    const preview = buildReportComposerPreview(
      {
        title: "商品安全报告",
        description: "管理层报告",
        categories: [
          {
            id: "safety",
            name: "安全认知",
            description: "分析消费者关注点",
            requirement: "先给结论，再说明样本边界。",
            questionIds: [1],
            outputType: "chart",
            inputModes: ["chart"],
            chartTemplateId: "line-simple",
            chartType: "line",
            prompt: "旧提示",
            order: 1,
            isCustom: false,
          },
        ],
      },
      [{ id: 1, title: "关注什么？", type: "single", options: ["成分", "认证"] }],
      { title: "商品安全调研", description: "", responses: 12 }
    );

    expect(preview.sections[0]?.requirement).toBe("先给结论，再说明样本边界。");
    expect(preview.sections[0]?.sourceScope).toBe("整份问卷与全部授权答卷");
    expect(preview.sections[0]).toMatchObject({
      inputModes: ["chart"],
      chart: {
        type: "line",
        templateId: "line-simple",
        isSimulated: true,
      },
    });
    expect(preview.sections[0]?.questionCount).toBe(1);
    expect(preview.sections[0]?.text).toBeUndefined();
    expect(preview.sections[0]?.image).toBeUndefined();
  });

  it("builds only the selected image output", () => {
    const preview = buildReportComposerPreview(
      {
        title: "商品安全报告",
        description: "管理层报告",
        categories: [{
          id: "safety-image",
          name: "安全认知",
          description: "分析消费者关注点",
          requirement: "生成一张不含虚构素材的证据图片。",
          questionIds: [],
          outputType: "image",
          inputModes: ["image"],
          prompt: "旧提示",
          order: 1,
          isCustom: false,
        }],
      },
      [{ id: 1, title: "关注什么？", type: "single", options: ["成分", "认证"] }],
      { title: "商品安全调研", description: "", responses: 12 }
    );

    expect(preview.sections[0]).toMatchObject({
      inputModes: ["image"],
      image: {
        title: "安全认知 图片要求",
        prompt: "生成一张不含虚构素材的证据图片。",
      },
    });
    expect(preview.sections[0]?.text).toBeUndefined();
    expect(preview.sections[0]?.chart).toBeUndefined();
  });

  it("builds only the selected text output", () => {
    const preview = buildReportComposerPreview(
      {
        title: "商品安全报告",
        description: "管理层报告",
        categories: [{
          id: "safety-text",
          name: "安全认知",
          description: "分析消费者关注点",
          requirement: "先给结论，再说明样本边界。",
          questionIds: [],
          outputType: "text",
          inputModes: ["text"],
          prompt: "旧提示",
          order: 1,
          isCustom: false,
        }],
      },
      [{ id: 1, title: "关注什么？", type: "single", options: ["成分", "认证"] }],
      { title: "商品安全调研", description: "", responses: 12 }
    );

    expect(preview.sections[0]).toMatchObject({
      inputModes: ["text"],
      text: {
        headline: "安全认知 的报告要求",
      },
    });
    expect(preview.sections[0]?.image).toBeUndefined();
    expect(preview.sections[0]?.chart).toBeUndefined();
  });
});

describe("areSurveyReportCategoryPlansEqual", () => {
  const savedPlan: SurveyReportCategoryPlanInput = {
    title: "商品安全报告",
    description: "管理层报告",
    categories: [{
      id: "safety",
      name: "安全认知",
      description: "分析消费者关注点",
      requirement: "先给结论，再说明样本边界。",
      questionIds: [2, 1],
      outputType: "chart",
      inputModes: ["chart"],
      chartTemplateId: "line-simple",
      chartType: "line",
      chartStyle: "business",
      chartConfig: {
        primaryColor: "#111111",
        maxDimensions: 8,
        sort: "desc",
        showLabels: true,
        showLegend: false,
        orientation: "vertical",
      },
      dataPrompt: "只展示真实答卷分布。",
      modulePrompts: { chart: "按真实证据生成图表。", text: "补充限制说明。" },
      prompt: "旧提示",
      order: 1,
      isCustom: false,
    }],
  };

  it("compares the persisted fields independently of object key insertion order", () => {
    const category = savedPlan.categories[0]!;
    const samePlan: SurveyReportCategoryPlanInput = {
      categories: [{
        isCustom: category.isCustom,
        order: category.order,
        prompt: category.prompt,
        modulePrompts: { text: "补充限制说明。", chart: "按真实证据生成图表。" },
        dataPrompt: category.dataPrompt,
        chartConfig: {
          orientation: "vertical",
          showLegend: false,
          showLabels: true,
          sort: "desc",
          maxDimensions: 8,
          primaryColor: "#111111",
        },
        chartStyle: category.chartStyle,
        chartType: category.chartType,
        chartTemplateId: category.chartTemplateId,
        inputModes: ["chart"],
        outputType: category.outputType,
        questionIds: [2, 1],
        requirement: category.requirement,
        description: category.description,
        name: category.name,
        id: category.id,
      }],
      description: savedPlan.description,
      title: savedPlan.title,
    };

    expect(areSurveyReportCategoryPlansEqual(savedPlan, samePlan)).toBe(true);
  });

  it("detects an unsaved persisted chapter change", () => {
    const changedPlan: SurveyReportCategoryPlanInput = {
      ...savedPlan,
      categories: savedPlan.categories.map((category) => ({
        ...category,
        requirement: "改为先说明限制，再给结论。",
      })),
    };

    expect(areSurveyReportCategoryPlansEqual(savedPlan, changedPlan)).toBe(false);
  });
});
