import { describe, expect, it } from "vitest";
import {
  createSurveyReportWorkspace,
  grepSurveyReportFiles,
  readSurveyReportFile,
  writeSurveyReportFile,
} from "./surveyReportWorkspace";

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
        type: "response",
        id: 201,
        submittedAt: "2026-07-18T10:00:00.000Z",
        answers: { "101": "是" },
      },
      {
        type: "response",
        id: 202,
        submittedAt: "2026-07-18T11:00:00.000Z",
        answers: { "101": "否" },
      },
    ],
  },
};

describe("survey report workspace", () => {
  it("mounts the complete survey snapshot in one read-only source file", () => {
    const workspace = createSurveyReportWorkspace(snapshot);
    const source = readSurveyReportFile(workspace, "/source/survey-source.jsonl");

    expect(source.split("\n")).toHaveLength(5);
    expect(source).toContain('"type":"survey"');
    expect(source).toContain('"type":"question"');
    expect(source.match(/"type":"response"/g)).toHaveLength(2);
    expect(readSurveyReportFile(workspace, "/source/manifest.json")).toContain(
      '"sourceRevision":"survey-58-revision"'
    );
  });

  it("rejects source writes and path traversal", () => {
    const workspace = createSurveyReportWorkspace(snapshot);

    expect(() =>
      writeSurveyReportFile(workspace, "/source/manifest.json", "{}")
    ).toThrow("survey_report_source_read_only");
    expect(() =>
      readSurveyReportFile(workspace, "/source/../secret.json")
    ).toThrow("survey_report_path_denied");
    expect(() =>
      writeSurveyReportFile(workspace, "/outside/result.json", "{}")
    ).toThrow("survey_report_path_denied");
  });

  it("allows task artifacts without mutating the source snapshot", () => {
    const workspace = createSurveyReportWorkspace(snapshot);
    const updated = writeSurveyReportFile(
      workspace,
      "/workspace/chapter-plan.json",
      '{"chapter":"用户行为与关键场景"}'
    );

    expect(
      readSurveyReportFile(updated, "/workspace/chapter-plan.json")
    ).toContain("用户行为与关键场景");
    expect(() =>
      readSurveyReportFile(workspace, "/workspace/chapter-plan.json")
    ).toThrow("survey_report_file_not_found");
    expect(readSurveyReportFile(updated, "/source/survey-source.jsonl")).toBe(
      readSurveyReportFile(workspace, "/source/survey-source.jsonl")
    );
  });

  it("searches the shared source with line-level evidence locations", () => {
    const workspace = createSurveyReportWorkspace(snapshot);
    const matches = grepSurveyReportFiles(workspace, "是否购买", "/source/");

    expect(matches).toEqual([
      expect.objectContaining({
        path: "/source/survey-source.jsonl",
        line: 3,
      }),
    ]);
  });
});
