import { describe, expect, it, vi } from "vitest";
import { buildSurveyReportEvidence } from "./survey-report-evidence";
import { buildSurveyReportTemplateSnapshot } from "./survey-template-report";
import {
  generateTemplateReportChapters,
  reportEvidenceRefs,
} from "./survey-report-chapter-generation";

const evidence = buildSurveyReportEvidence({
  survey: {
    title: "产品安全调研",
    description: "了解购买决策和安全信任",
    questions: [
      {
        id: 1,
        title: "是否购买过",
        type: "single",
        required: true,
        options: ["是", "否"],
      },
      {
        id: 2,
        title: "最关注的安全信息",
        type: "single",
        required: true,
        options: ["认证", "成分"],
      },
    ],
  },
  responses: [
    { id: 1, answers: { "1": "是", "2": "认证" } },
    { id: 2, answers: { "1": "是", "2": "成分" } },
    { id: 3, answers: { "1": "否", "2": "认证" } },
  ],
});

const snapshot = buildSurveyReportTemplateSnapshot({
  title: "产品安全调研报告",
  description: "管理层阅读版",
  categories: [
    {
      id: "summary",
      name: "管理层摘要",
      description: "",
      requirement: "先给结论，再说明业务含义和下一步动作。",
      questionIds: [],
      outputType: "text",
      inputModes: ["text"],
      prompt: "先给结论，再说明业务含义和下一步动作。",
      order: 1,
      isCustom: true,
    },
    {
      id: "trust-chart",
      name: "安全信任结构",
      description: "",
      requirement: "选择最能体现安全关注差异的题目。",
      questionIds: [],
      outputType: "chart",
      inputModes: ["chart"],
      chartTemplateId: "pie-simple",
      prompt: "选择最能体现安全关注差异的题目。",
      order: 2,
      isCustom: true,
    },
    {
      id: "scenario-image",
      name: "核心场景视觉",
      description: "",
      requirement: "生成克制、专业且不带文字数字的场景信息图。",
      questionIds: [],
      outputType: "image",
      inputModes: ["image"],
      prompt: "生成克制、专业且不带文字数字的场景信息图。",
      order: 3,
      isCustom: true,
    },
  ],
});

const sourceSnapshot = {
  surveyId: 59,
  sourceRevision: "source-revision-1",
  contentHash: "content-hash",
  schemaVersion: "survey-source-v1",
  generatedAt: "2026-07-18T12:00:00.000Z",
  responseCount: 3,
  sourceData: { format: "survey-source.jsonl", records: [] },
};

describe("template report chapter generation", () => {
  it("generates every template chapter in order against one source revision", async () => {
    const generateTextChapterAgent = vi.fn(async (input: { chapterId: string; title: string }) => ({
      headline: "安全信任是当前购买决策的首要解释变量",
      claims: [{
        statement: "认证信息为占比最高的安全关注项。",
        evidenceId: "question-2-top",
        value: 2,
        denominator: 3,
        implication: "用户需要可验证的信任凭据。",
        recommendation: "优先强化认证信息披露。",
      }],
      invalid: false,
    }));
    const callJson = vi.fn(async (_input: { messages: Array<{ content: string }> }) => ({
      questionId: 2,
      interpretation: "认证关注高于成分关注，安全证明应成为首要沟通内容。",
    }));
    const generateImage = vi.fn().mockResolvedValue({
      assetId: "scenario-image",
      objectKey: "survey-reports/7/59/artifact-id/scenario-image.png",
      altText: "消费者查看产品安全认证信息的专业场景图",
      caption: "根据匿名聚合洞察生成。",
    });

    const chapters = await generateTemplateReportChapters({
      snapshot,
      evidence,
      sourceSnapshot,
      sourceRevision: "source-revision-1",
      teamId: 7,
      surveyId: 59,
      artifactId: "artifact-id",
      model: "qwen-test",
    }, {
      callJson,
      generateImage,
      generateTextChapterAgent,
    });

    expect(chapters.map((chapter) => [
      chapter.chapterId,
      chapter.order,
      chapter.outputType,
    ])).toEqual([
      ["summary", 1, "text"],
      ["trust-chart", 2, "chart"],
      ["scenario-image", 3, "image"],
    ]);
    expect(chapters[0]).toMatchObject({
      headline: "安全信任是当前购买决策的首要解释变量",
      evidenceRefs: ["question-2-top"],
    });
    expect(chapters[1]).toMatchObject({
      chartTemplateId: "pie-simple",
      interpretation: "认证关注高于成分关注，安全证明应成为首要沟通内容。",
      evidenceRefs: ["question-2-distribution"],
      sampleSize: 3,
    });
    expect(chapters[2]).toMatchObject({
      assetId: "scenario-image",
      evidenceRefs: expect.arrayContaining(["question-1-top", "question-2-top"]),
    });
    expect(callJson).toHaveBeenCalledTimes(1);
    const chartRequest = JSON.parse(callJson.mock.calls[0]![0].messages[1]!.content);
    expect(chartRequest.sourceRevision).toBe("source-revision-1");
    expect(chartRequest.chapter.requirement).toBeTruthy();
    expect(generateTextChapterAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        chapterId: "summary",
        snapshot: sourceSnapshot,
        modelId: "qwen-test",
      })
    );
    expect(generateImage).toHaveBeenCalledWith(expect.objectContaining({
      artifactId: "artifact-id",
      chapterId: "scenario-image",
    }));
  });

  it("rejects unbound text claims and chart question IDs outside the evidence allowlist", async () => {
    const invalidClaim = vi.fn().mockResolvedValue({
      headline: "虚构结论",
      claims: [{
        statement: "虚构",
        evidenceId: "missing",
        value: 99,
        denominator: 100,
      }],
      invalid: true,
    });
    await expect(generateTemplateReportChapters({
      snapshot: {
        ...snapshot,
        chapters: [snapshot.chapters[0]!],
      },
      evidence,
      sourceSnapshot,
      sourceRevision: "source-revision-1",
      teamId: 7,
      surveyId: 59,
      artifactId: "artifact-id",
      model: "qwen-test",
    }, {
      generateImage: vi.fn(),
      generateTextChapterAgent: invalidClaim,
    })).rejects.toThrow("report_text_evidence_invalid");

    const invalidChart = vi.fn().mockResolvedValue({
      questionId: 999,
      interpretation: "不存在的题目",
    });
    await expect(generateTemplateReportChapters({
      snapshot: {
        ...snapshot,
        chapters: [snapshot.chapters[1]!],
      },
      evidence,
      sourceSnapshot,
      sourceRevision: "source-revision-1",
      teamId: 7,
      surveyId: 59,
      artifactId: "artifact-id",
      model: "qwen-test",
    }, {
      callJson: invalidChart,
      generateImage: vi.fn(),
    })).rejects.toThrow("report_chart_evidence_invalid");
  });

  it("exposes only validated claim and aggregate distribution evidence references", () => {
    expect(reportEvidenceRefs(evidence)).toEqual(new Set([
      "question-1-top",
      "question-2-top",
      "question-1-distribution",
      "question-2-distribution",
    ]));
  });
});
