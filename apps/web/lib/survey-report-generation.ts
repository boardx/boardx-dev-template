import type { SurveyReportArtifactVersion } from "@repo/data";

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
    stale: Boolean(latest && latest.sourceRevision !== input.currentSourceRevision),
    requirementChanged: Boolean(
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
