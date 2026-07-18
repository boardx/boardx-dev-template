import { describe, expect, it } from "vitest";
import type { SurveyReportGenerationStatus } from "./survey-report-generation";
import {
  getReportGenerationEligibility,
  getReportGenerationStatus,
} from "./survey-report-composer-state";

const currentGeneration: SurveyReportGenerationStatus = {
  currentSourceRevision: "source-1",
  currentRequirementHash: "requirement-1",
  currentResponseCount: 12,
  stale: false,
  requirementChanged: false,
  currentArtifact: {
    id: "report-1",
    reportVersion: "report-1",
    sourceRevision: "source-1",
    requirementHash: "requirement-1",
    templateVersion: "v1",
    responseCount: 12,
    newResponseCount: 0,
    modelId: "test",
    provider: "test",
    createdAt: "2026-07-18T00:00:00.000Z",
  },
  latestArtifact: {
    id: "report-1",
    reportVersion: "report-1",
    sourceRevision: "source-1",
    requirementHash: "requirement-1",
    templateVersion: "v1",
    responseCount: 12,
    newResponseCount: 0,
    modelId: "test",
    provider: "test",
    createdAt: "2026-07-18T00:00:00.000Z",
  },
  versions: [],
};

describe("getReportGenerationEligibility", () => {
  it("allows generation only for a saved and idle draft", () => {
    expect(getReportGenerationEligibility({ draftDirty: false, saving: false, generating: false }))
      .toMatchObject({ canGenerate: true });
    expect(getReportGenerationEligibility({ draftDirty: true, saving: false, generating: false }))
      .toMatchObject({ canGenerate: false, message: "请先保存要求，保存完成后即可生成。" });
    expect(getReportGenerationEligibility({ draftDirty: false, saving: true, generating: false }))
      .toMatchObject({ canGenerate: false, message: "请先保存要求，保存完成后即可生成。" });
    expect(getReportGenerationEligibility({ draftDirty: false, saving: false, generating: true }))
      .toMatchObject({ canGenerate: false, message: "报告正在生成，请等待完成。" });
  });
});

describe("getReportGenerationStatus", () => {
  it("keeps the saved-draft status ahead of the latest artifact", () => {
    expect(getReportGenerationStatus(currentGeneration, true)).toMatchObject({
      label: "草稿未保存",
      detail: "请先保存要求，保存完成后再判断报告版本状态。",
    });
  });

  it("states that changed requirements retain the most recent successful report", () => {
    const status = getReportGenerationStatus({ ...currentGeneration, requirementChanged: true }, false);

    expect(status).toMatchObject({ label: "要求已修改" });
    expect(status.detail).toContain("分析报告保留最近成功版本");
    expect(status.detail).not.toContain("当前展示");
  });

  it("states that stale facts retain the most recent successful report", () => {
    const status = getReportGenerationStatus({
      ...currentGeneration,
      stale: true,
      latestArtifact: { ...currentGeneration.latestArtifact!, newResponseCount: 3 },
    }, false);

    expect(status).toMatchObject({ label: "数据有更新" });
    expect(status.detail).toContain("分析报告保留最近成功版本");
    expect(status.detail).not.toContain("当前展示");
  });
});
