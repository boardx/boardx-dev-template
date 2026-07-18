export function selectExactReportVersion<T extends { id: string }>(
  artifacts: T[],
  artifactId: string | null
): { isExplicitRequest: boolean; artifact: T | undefined } {
  return {
    isExplicitRequest: artifactId !== null,
    artifact: artifactId === null
      ? undefined
      : artifacts.find((artifact) => artifact.id === artifactId),
  };
}

export function isExactReportVersionResponse(
  payload: { report?: unknown; selectedArtifactId?: unknown } | null | undefined,
  artifactId: string
): boolean {
  return Boolean(payload?.report) && payload?.selectedArtifactId === artifactId;
}
