import { describe, expect, it, vi } from "vitest";
import { selectReportVersionAndOpenReport } from "./survey-report-version-navigation";

describe("selectReportVersionAndOpenReport", () => {
  it("loads the selected immutable version before opening the full analysis report", async () => {
    const calls: string[] = [];
    const onSelectVersion = vi.fn(async (artifactId: string) => {
      calls.push(`select:${artifactId}`);
    });
    const onOpenReport = vi.fn(async () => {
      calls.push("open-report");
    });

    await selectReportVersionAndOpenReport("report-v2", onSelectVersion, onOpenReport);

    expect(onSelectVersion).toHaveBeenCalledWith("report-v2");
    expect(onOpenReport).toHaveBeenCalledOnce();
    expect(calls).toEqual(["select:report-v2", "open-report"]);
  });

  it("does not navigate when loading the selected version fails", async () => {
    const onSelectVersion = vi.fn(async () => {
      throw new Error("load failed");
    });
    const onOpenReport = vi.fn();

    await expect(
      selectReportVersionAndOpenReport("report-v2", onSelectVersion, onOpenReport)
    ).rejects.toThrow("load failed");

    expect(onOpenReport).not.toHaveBeenCalled();
  });
});
