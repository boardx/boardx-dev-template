import { describe, expect, it } from "vitest";
import type { SurveyReportArtifactVersion } from "@repo/data";
import {
  captureSurveyReportRequestEpoch,
  createSurveyReportRequestState,
  markSurveyReportRequestsRequirementsChanged,
  markSurveyReportGenerationRequirementsChanged,
  resolveSurveyReportGenerationStatus,
  settleSurveyReportRefresh,
} from "./survey-report-generation";

function artifact(
  overrides: Partial<SurveyReportArtifactVersion> = {}
): SurveyReportArtifactVersion {
  return {
    id: "artifact-1",
    surveyId: 7,
    sourceRevision: "rev-1",
    requirementHash: "req-1",
    templateVersion: "survey-report-v1",
    responseCount: 10,
    report: {},
    status: "ready",
    modelId: "qwen3.7-max",
    provider: "qwen",
    createdAt: "2026-07-18T03:00:00.000Z",
    ...overrides,
  };
}

describe("resolveSurveyReportGenerationStatus", () => {
  it("marks a report stale when the source revision changes", () => {
    const status = resolveSurveyReportGenerationStatus({
      currentSourceRevision: "rev-2",
      currentRequirementHash: "req-1",
      currentResponseCount: 12,
      artifacts: [artifact()],
    });

    expect(status.stale).toBe(true);
    expect(status.requirementChanged).toBe(false);
    expect(status.latestArtifact?.newResponseCount).toBe(2);
  });

  it("marks changed requirements without treating the old artifact as current", () => {
    const status = resolveSurveyReportGenerationStatus({
      currentSourceRevision: "rev-1",
      currentRequirementHash: "req-2",
      currentResponseCount: 10,
      artifacts: [artifact()],
    });

    expect(status.stale).toBe(false);
    expect(status.requirementChanged).toBe(true);
    expect(status.currentArtifact).toBeNull();
  });

  it("selects the exact artifact for the current source and requirement", () => {
    const current = artifact({
      id: "artifact-current",
      sourceRevision: "rev-2",
      requirementHash: "req-2",
      responseCount: 12,
      createdAt: "2026-07-18T04:00:00.000Z",
    });
    const status = resolveSurveyReportGenerationStatus({
      currentSourceRevision: "rev-2",
      currentRequirementHash: "req-2",
      currentResponseCount: 12,
      artifacts: [current, artifact()],
    });

    expect(status.stale).toBe(false);
    expect(status.requirementChanged).toBe(false);
    expect(status.currentArtifact?.id).toBe("artifact-current");
    expect(status.versions).toHaveLength(2);
  });
});

describe("markSurveyReportGenerationRequirementsChanged", () => {
  it("keeps an unavailable generation unavailable", () => {
    expect(markSurveyReportGenerationRequirementsChanged(undefined)).toBeUndefined();
  });

  it("marks an existing generation as changed while retaining report history", () => {
    const generation = resolveSurveyReportGenerationStatus({
      currentSourceRevision: "rev-1",
      currentRequirementHash: "req-1",
      currentResponseCount: 10,
      artifacts: [artifact()],
    });

    const changed = markSurveyReportGenerationRequirementsChanged(generation);

    expect(changed).toMatchObject({ requirementChanged: true });
    expect(changed?.latestArtifact).toEqual(generation.latestArtifact);
    expect(changed?.versions).toEqual(generation.versions);
  });
});

describe("survey report request epochs", () => {
  it("ignores a response captured before requirements changed", () => {
    const initial = createSurveyReportRequestState();
    const oldEpoch = captureSurveyReportRequestEpoch(initial);
    const changed = markSurveyReportRequestsRequirementsChanged(initial);

    expect(settleSurveyReportRefresh(changed, oldEpoch, true)).toEqual({
      accepted: false,
      state: changed,
    });
  });

  it("accepts a successful response captured after requirements changed", () => {
    const changed = markSurveyReportRequestsRequirementsChanged(
      createSurveyReportRequestState()
    );
    const newEpoch = captureSurveyReportRequestEpoch(changed);

    expect(settleSurveyReportRefresh(changed, newEpoch, true)).toEqual({
      accepted: true,
      state: {
        epoch: newEpoch,
        requirementsChangedOverride: false,
      },
    });
  });

  it("retains the requirements-changed override when refresh fails", () => {
    const changed = markSurveyReportRequestsRequirementsChanged(
      createSurveyReportRequestState()
    );
    const newEpoch = captureSurveyReportRequestEpoch(changed);

    expect(settleSurveyReportRefresh(changed, newEpoch, false)).toEqual({
      accepted: false,
      state: changed,
    });
  });
});
