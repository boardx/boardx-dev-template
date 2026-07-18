import { describe, expect, it } from "vitest";
import { buildReportComposerPreview } from "./survey-report-category-plan";

describe("buildReportComposerPreview", () => {
  it("describes the whole-survey source without simulated chart values", () => {
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
            chartTemplateId: "bar-simple",
            chartType: "bar",
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
    expect(preview.sections[0]?.chart).toBeUndefined();
  });
});
