import { describe, expect, it } from "vitest";
import { buildReportComposerPreview } from "./survey-report-category-plan";

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
