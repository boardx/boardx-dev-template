import { describe, expect, it } from "vitest";
import type { SurveyReportArtifactVersion } from "@repo/data";
import {
  beginSurveyReportCategoryPlanPersistence,
  beginSurveyReportGenerationRequest,
  captureSurveyReportRequestEpoch,
  createSurveyReportRequestState,
  markSurveyReportRequestsRequirementsChanged,
  markSurveyReportGenerationRequirementsChanged,
  resolveSurveyReportGenerationStatus,
  settleSurveyReportGenerationRequest,
  settleSurveyReportRefresh,
} from "./survey-report-generation";
import type { SurveyReportCategoryPlanInput } from "@repo/data";

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

  const persistedPlan: SurveyReportCategoryPlanInput = {
    title: "消费者洞察报告",
    description: "面向管理层",
    categories: [{
      id: "summary",
      name: "核心结论",
      description: "总结主要发现",
      requirement: "先给结论，再说明限制。",
      questionIds: [2, 1],
      outputType: "text",
      inputModes: ["text"],
      prompt: "先给结论，再说明限制。",
      order: 1,
      isCustom: false,
    }],
  };

  it("invalidates report requests when AI classification persists a changed plan", () => {
    const current = markSurveyReportRequestsRequirementsChanged(
      createSurveyReportRequestState()
    );
    const changedPlan: SurveyReportCategoryPlanInput = {
      ...persistedPlan,
      categories: persistedPlan.categories.map((category) => ({
        ...category,
        requirement: "先说明样本限制，再给结论。",
      })),
    };

    const transition = beginSurveyReportCategoryPlanPersistence({
      state: current,
      previousPlan: persistedPlan,
      persistedPlan: changedPlan,
      invalidateWhenUnchanged: false,
    });

    expect(transition).toEqual({
      invalidated: true,
      requestEpoch: current.epoch + 1,
      state: {
        epoch: current.epoch + 1,
        requirementsChangedOverride: true,
      },
    });
  });

  it("keeps the current epoch when AI classification persists the same normalized plan", () => {
    const current = createSurveyReportRequestState();
    const samePlanWithDifferentKeyOrder: SurveyReportCategoryPlanInput = {
      categories: persistedPlan.categories.map((category) => ({
        isCustom: category.isCustom,
        order: category.order,
        prompt: category.prompt,
        inputModes: ["text"],
        outputType: category.outputType,
        questionIds: [2, 1],
        requirement: category.requirement,
        description: category.description,
        name: category.name,
        id: category.id,
      })),
      description: persistedPlan.description,
      title: persistedPlan.title,
    };

    const transition = beginSurveyReportCategoryPlanPersistence({
      state: current,
      previousPlan: persistedPlan,
      persistedPlan: samePlanWithDifferentKeyOrder,
      invalidateWhenUnchanged: false,
    });

    expect(transition).toEqual({
      invalidated: false,
      requestEpoch: null,
      state: current,
    });
  });

  it("invalidates an old GET token when report generation begins", () => {
    const current = markSurveyReportRequestsRequirementsChanged(
      createSurveyReportRequestState()
    );
    const oldEpoch = captureSurveyReportRequestEpoch(current);

    const generation = beginSurveyReportGenerationRequest(current);

    expect(generation.requestEpoch).toBe(oldEpoch + 1);
    expect(generation.state).toEqual({
      epoch: oldEpoch + 1,
      requirementsChangedOverride: true,
    });
    expect(settleSurveyReportRefresh(generation.state, oldEpoch, true).accepted)
      .toBe(false);
  });

  it("clears the requirements override after current generation succeeds", () => {
    const generation = beginSurveyReportGenerationRequest(
      markSurveyReportRequestsRequirementsChanged(
        createSurveyReportRequestState()
      )
    );

    expect(settleSurveyReportGenerationRequest(
      generation.state,
      generation.requestEpoch,
      true
    )).toEqual({
      accepted: true,
      state: {
        epoch: generation.requestEpoch,
        requirementsChangedOverride: false,
      },
    });
  });

  it("retains the requirements override after current generation fails", () => {
    const generation = beginSurveyReportGenerationRequest(
      markSurveyReportRequestsRequirementsChanged(
        createSurveyReportRequestState()
      )
    );

    expect(settleSurveyReportGenerationRequest(
      generation.state,
      generation.requestEpoch,
      false
    )).toEqual({
      accepted: false,
      state: generation.state,
    });
  });
});
