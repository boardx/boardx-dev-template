export async function selectReportVersionAndOpenReport(
  artifactId: string,
  onSelectVersion: (artifactId: string) => Promise<boolean>,
  onOpenReport: () => void | Promise<void>
) {
  const loaded = await onSelectVersion(artifactId);
  if (loaded) {
    await onOpenReport();
  }
}
