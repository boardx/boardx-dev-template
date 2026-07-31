import type {
  SurveyReportArtifactVersion,
  SurveyReportCategoryPlanInput,
} from "@repo/data";
import { areSurveyReportCategoryPlansEqual } from "./survey-report-category-plan";

export interface SurveyReportArtifactSummary {
  id: string;
  reportVersion: string;
  sourceRevision: string;
  requirementHash: string;
  templateVersion: string;
  responseCount: number;
  newResponseCount: number;
  modelId: string;
  provider: string;
  createdAt: string;
}

export interface SurveyReportGenerationStatus {
  currentSourceRevision: string;
  currentRequirementHash: string;
  currentResponseCount: number;
  stale: boolean;
  requirementChanged: boolean;
  currentArtifact: SurveyReportArtifactSummary | null;
  latestArtifact: SurveyReportArtifactSummary | null;
  versions: SurveyReportArtifactSummary[];
  nextHistoryCursor?: string | null;
}

export interface SurveyReportRequestState {
  epoch: number;
  requirementsChangedOverride: boolean;
}

export interface SurveyReportRefreshResolution {
  accepted: boolean;
  state: SurveyReportRequestState;
}

export interface SurveyReportRequestTransition {
  invalidated: boolean;
  requestEpoch: number | null;
  state: SurveyReportRequestState;
}

interface SurveyReportGenerationFailurePayload {
  error?: unknown;
  failedChapter?: {
    chapterId?: unknown;
    title?: unknown;
    status?: unknown;
    retryable?: unknown;
  };
}

export function surveyReportGenerationErrorMessage(
  payload: SurveyReportGenerationFailurePayload
): string | null {
  if (payload.failedChapter?.status !== "failed") {
    return null;
  }
  const title = String(
    payload.failedChapter.title || payload.failedChapter.chapterId || "未知章节"
  );
  if (
    typeof payload.error === "string"
    && (
      payload.error.startsWith("report_template_text_sources_incompatible:")
      || payload.error.startsWith("report_template_image_sources_incompatible:")
    )
  ) {
    return `章节「${title}」缺少可用的匿名聚合证据，上一份完整报告已保留。请调整题目来源或输出类型。`;
  }
  if (payload.error !== "report_template_chapter_generation_failed") return null;
  return `章节「${title}」生成失败，上一份完整报告已保留。请重试生成。`;
}

export function createSurveyReportRequestState(): SurveyReportRequestState {
  return {
    epoch: 0,
    requirementsChangedOverride: false,
  };
}

export function captureSurveyReportRequestEpoch(
  state: SurveyReportRequestState
): number {
  return state.epoch;
}

export function markSurveyReportRequestsRequirementsChanged(
  state: SurveyReportRequestState
): SurveyReportRequestState {
  return {
    epoch: state.epoch + 1,
    requirementsChangedOverride: true,
  };
}

export function beginSurveyReportCategoryPlanPersistence(input: {
  state: SurveyReportRequestState;
  previousPlan: SurveyReportCategoryPlanInput | undefined;
  persistedPlan: SurveyReportCategoryPlanInput;
  invalidateWhenUnchanged: boolean;
}): SurveyReportRequestTransition {
  const unchanged = input.previousPlan
    ? areSurveyReportCategoryPlansEqual(
        input.previousPlan,
        input.persistedPlan
      )
    : false;
  if (unchanged && !input.invalidateWhenUnchanged) {
    return {
      invalidated: false,
      requestEpoch: null,
      state: input.state,
    };
  }
  const state = markSurveyReportRequestsRequirementsChanged(input.state);
  return {
    invalidated: true,
    requestEpoch: state.epoch,
    state,
  };
}

export function beginSurveyReportGenerationRequest(
  state: SurveyReportRequestState
): { requestEpoch: number; state: SurveyReportRequestState } {
  const next = {
    ...state,
    epoch: state.epoch + 1,
  };
  return {
    requestEpoch: next.epoch,
    state: next,
  };
}

export function isSurveyReportRequestCurrent(
  state: SurveyReportRequestState,
  requestEpoch: number
): boolean {
  return state.epoch === requestEpoch;
}

export function settleSurveyReportRefresh(
  state: SurveyReportRequestState,
  requestEpoch: number,
  succeeded: boolean
): SurveyReportRefreshResolution {
  if (!succeeded || !isSurveyReportRequestCurrent(state, requestEpoch)) {
    return { accepted: false, state };
  }
  return {
    accepted: true,
    state: {
      ...state,
      requirementsChangedOverride: false,
    },
  };
}

export function settleSurveyReportGenerationRequest(
  state: SurveyReportRequestState,
  requestEpoch: number,
  succeeded: boolean
): SurveyReportRefreshResolution {
  return settleSurveyReportRefresh(state, requestEpoch, succeeded);
}

export function markSurveyReportGenerationRequirementsChanged(
  generation: SurveyReportGenerationStatus | undefined
): SurveyReportGenerationStatus | undefined {
  if (!generation) return undefined;
  return { ...generation, requirementChanged: true };
}

function summarizeArtifact(
  artifact: SurveyReportArtifactVersion,
  currentResponseCount: number
): SurveyReportArtifactSummary {
  return {
    id: artifact.id,
    reportVersion: artifact.id,
    sourceRevision: artifact.sourceRevision,
    requirementHash: artifact.requirementHash,
    templateVersion: artifact.templateVersion,
    responseCount: artifact.responseCount,
    newResponseCount: Math.max(0, currentResponseCount - artifact.responseCount),
    modelId: artifact.modelId,
    provider: artifact.provider,
    createdAt: artifact.createdAt,
  };
}

export function resolveSurveyReportGenerationStatus(input: {
  currentSourceRevision: string;
  currentRequirementHash: string;
  currentResponseCount: number;
  artifacts: SurveyReportArtifactVersion[];
}): SurveyReportGenerationStatus {
  const versions = input.artifacts.map((artifact) =>
    summarizeArtifact(artifact, input.currentResponseCount)
  );
  const latest = input.artifacts[0];
  const current = input.artifacts.find(
    (artifact) =>
      artifact.sourceRevision === input.currentSourceRevision &&
      artifact.requirementHash === input.currentRequirementHash
  );

  return {
    currentSourceRevision: input.currentSourceRevision,
    currentRequirementHash: input.currentRequirementHash,
    currentResponseCount: input.currentResponseCount,
    stale: Boolean(
      !current &&
      latest &&
      latest.sourceRevision !== input.currentSourceRevision
    ),
    requirementChanged: Boolean(
      !current &&
      latest &&
      latest.sourceRevision === input.currentSourceRevision &&
      latest.requirementHash !== input.currentRequirementHash
    ),
    currentArtifact: current
      ? summarizeArtifact(current, input.currentResponseCount)
      : null,
    latestArtifact: latest
      ? summarizeArtifact(latest, input.currentResponseCount)
      : null,
    versions,
  };
}
