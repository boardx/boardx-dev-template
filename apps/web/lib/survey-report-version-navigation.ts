export async function selectReportVersionAndOpenReport(
  artifactId: string,
  onSelectVersion: (artifactId: string) => Promise<void>,
  onOpenReport: () => void | Promise<void>
) {
  await onSelectVersion(artifactId);
  await onOpenReport();
}
