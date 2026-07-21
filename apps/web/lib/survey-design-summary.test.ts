import { describe, expect, it } from "vitest";
import { buildSurveyDesignSummary } from "./survey-design-summary";

describe("buildSurveyDesignSummary", () => {
  it("derives stable categories, duration, segment variables and grounded hypotheses", () => {
    expect(
      buildSurveyDesignSummary([
        { id: "q1", title: "你的年龄段是？", category: "demographics" },
        { id: "q2", title: "你是否购买过此类商品？", category: "behavior" },
        { id: "q3", title: "你最关注哪些安全信息？", category: "safety" },
        { id: "q4", title: "还有哪些意见？", category: "demographics" },
      ])
    ).toEqual({
      categories: ["demographics", "behavior", "safety"],
      questionCount: 4,
      estimatedMinutes: 2,
      segmentVariables: ["demographics"],
      hypotheses: [
        { id: "H1", title: "你的年龄段是？", category: "demographics" },
        { id: "H2", title: "你是否购买过此类商品？", category: "behavior" },
        { id: "H3", title: "你最关注哪些安全信息？", category: "safety" },
      ],
    });
  });

  it("omits blank categories and keeps an empty survey deterministic", () => {
    expect(buildSurveyDesignSummary([])).toEqual({
      categories: [],
      questionCount: 0,
      estimatedMinutes: 0,
      segmentVariables: [],
      hypotheses: [],
    });

    expect(
      buildSurveyDesignSummary([
        { id: "q1", title: "未分类问题", category: "  " },
        { id: "q2", title: "", category: undefined },
      ])
    ).toMatchObject({
      categories: [],
      questionCount: 2,
      estimatedMinutes: 1,
      segmentVariables: [],
      hypotheses: [{ id: "H1", title: "未分类问题", category: undefined }],
    });
  });
});
