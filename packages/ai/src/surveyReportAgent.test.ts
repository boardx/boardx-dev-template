import { describe, expect, it } from "vitest";
import {
  runSurveyReportAgent,
  type SurveyReportAgentInput,
} from "./surveyReportAgent";

const snapshot = {
  surveyId: 58,
  sourceRevision: "survey-58-revision",
  contentHash: "content-hash",
  schemaVersion: "survey-source-v1",
  generatedAt: "2026-07-18T12:00:00.000Z",
  responseCount: 2,
  sourceData: {
    format: "survey-source.jsonl",
    records: [
      {
        type: "manifest",
        schemaVersion: "survey-source-v1",
        sourceRevision: "survey-58-revision",
        contentHash: "content-hash",
        responseCount: 2,
      },
      {
        type: "survey",
        id: 58,
        title: "产品反馈问卷",
        description: "了解完整使用体验",
      },
      {
        type: "question",
        id: 101,
        position: 1,
        title: "你是否购买过此类商品？",
        questionType: "single_choice",
        required: true,
        options: ["是", "否"],
        category: "behavior",
      },
      {
        type: "question",
        id: 102,
        position: 2,
        title: "你对商品整体满意度如何？",
        questionType: "rating",
        required: true,
        options: [],
        category: "satisfaction",
      },
      {
        type: "response",
        id: 201,
        submittedAt: "2026-07-18T10:00:00.000Z",
        answers: { "101": "是", "102": 5 },
      },
      {
        type: "response",
        id: 202,
        submittedAt: "2026-07-18T11:00:00.000Z",
        answers: { "101": "否", "102": 3 },
      },
    ],
  },
};

const evidence = [
  {
    id: "q101-option-yes",
    questionId: 101,
    label: "购买过",
    value: 1,
    denominator: 2,
  },
  {
    id: "q102-rating-average",
    questionId: 102,
    label: "平均满意度",
    value: 4,
    denominator: 2,
  },
];

function input(
  overrides: Partial<SurveyReportAgentInput> = {}
): SurveyReportAgentInput {
  return {
    snapshot,
    chapters: [
      {
        id: "behavior",
        categoryKey: "behavior",
        title: "behavior",
        goal: "分析购买行为与满意度之间值得关注的模式",
        requirement: "先给结论，再说明证据、限制与行动建议。",
      },
      {
        id: "satisfaction",
        categoryKey: "satisfaction",
        title: "satisfaction",
        goal: "解释满意度表现和改进方向",
        requirement: "避免把相关性写成因果。",
      },
    ],
    evidence,
    maxModelCalls: 4,
    analyzeChapter: async ({ chapter, tools }) => {
      const source = tools.readFile("/source/survey-source.jsonl");
      expect(source).toContain('"type":"response"');
      const matches = tools.grep("满意度", "/source/");
      expect(matches.length).toBeGreaterThan(0);
      const evidenceId =
        chapter.categoryKey === "behavior"
          ? "q101-option-yes"
          : "q102-rating-average";
      const item = evidence.find((candidate) => candidate.id === evidenceId)!;
      return {
        conclusion: `${chapter.title}存在可验证信号`,
        evidenceRefs: [
          {
            evidenceId,
            value: item.value,
            denominator: item.denominator,
          },
        ],
        limitations: ["样本量较小"],
        recommendation: "补充样本后复核趋势",
      };
    },
    ...overrides,
  };
}

describe("survey report agent", () => {
  it("lets every chapter retrieve from the same whole-survey source", async () => {
    const result = await runSurveyReportAgent(input());

    expect(result.status).toBe("ready");
    expect(
      result.chapters.every(
        (chapter) => chapter.sourceRevision === snapshot.sourceRevision
      )
    ).toBe(true);
    expect(result.audit.sourceReads).toContain(
      "/source/survey-source.jsonl"
    );
    expect(result.chapters.map((chapter) => chapter.title)).toEqual([
      "用户行为与关键场景",
      "满意度与体验评价",
    ]);
  });

  it("rejects claims with missing or mismatched evidence", async () => {
    const result = await runSurveyReportAgent(
      input({
        chapters: [input().chapters[0]!],
        analyzeChapter: async () => ({
          conclusion: "错误结论",
          evidenceRefs: [
            {
              evidenceId: "q101-option-yes",
              value: 2,
              denominator: 2,
            },
            {
              evidenceId: "missing-evidence",
              value: 1,
              denominator: 2,
            },
          ],
          limitations: [],
          recommendation: "不应进入报告",
        }),
      })
    );

    expect(result.status).toBe("failed");
    expect(result.chapters[0]?.status).toBe("rejected");
    expect(result.chapters[0]?.validationErrors).toEqual(
      expect.arrayContaining([
        "evidence_value_mismatch",
        "evidence_not_found",
      ])
    );
  });

  it("stops with a recoverable partial result when budget is exhausted", async () => {
    const result = await runSurveyReportAgent(input({ maxModelCalls: 1 }));

    expect(result.status).toBe("partial");
    expect(result.stopReason).toBe("model_call_budget_exhausted");
    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0]?.status).toBe("accepted");
  });
});
