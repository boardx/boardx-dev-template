import { describe, expect, it, vi } from "vitest";
import {
  isExactReportVersionResponse,
  selectExactReportVersion,
  selectReportVersionAndOpenReport,
} from "./survey-report-version-navigation";

describe("selectExactReportVersion", () => {
  const artifacts = [{ id: "report-v2" }, { id: "report-v1" }];

  it("does not fall back to the latest artifact for an invalid explicit version ID", () => {
    expect(selectExactReportVersion(artifacts, "missing-version")).toEqual({
      isExplicitRequest: true,
      artifact: undefined,
    });
  });

  it("returns only the exact artifact for an explicit version ID", () => {
    expect(selectExactReportVersion(artifacts, "report-v1")).toEqual({
      isExplicitRequest: true,
      artifact: { id: "report-v1" },
    });
  });
});

describe("isExactReportVersionResponse", () => {
  it("rejects a successful response for a different artifact", () => {
    expect(
      isExactReportVersionResponse(
        { report: { title: "Latest" }, selectedArtifactId: "report-v2" },
        "report-v1"
      )
    ).toBe(false);
  });

  it("accepts a response for the requested artifact", () => {
    expect(
      isExactReportVersionResponse(
        { report: { title: "Historical" }, selectedArtifactId: "report-v1" },
        "report-v1"
      )
    ).toBe(true);
  });
});

describe("selectReportVersionAndOpenReport", () => {
  it("opens the full analysis report after loading the selected immutable version", async () => {
    const calls: string[] = [];
    const onSelectVersion = vi.fn(async (artifactId: string) => {
      calls.push(`select:${artifactId}`);
      return true;
    });
    const onOpenReport = vi.fn(async () => {
      calls.push("open-report");
    });

    await selectReportVersionAndOpenReport("report-v2", onSelectVersion, onOpenReport);

    expect(onSelectVersion).toHaveBeenCalledWith("report-v2");
    expect(onOpenReport).toHaveBeenCalledOnce();
    expect(calls).toEqual(["select:report-v2", "open-report"]);
  });

  it("does not navigate when loading the selected version resolves false", async () => {
    const onSelectVersion = vi.fn(async () => false);
    const onOpenReport = vi.fn();

    await selectReportVersionAndOpenReport("report-v2", onSelectVersion, onOpenReport);

    expect(onSelectVersion).toHaveBeenCalledWith("report-v2");
    expect(onOpenReport).not.toHaveBeenCalled();
  });

  it("does not navigate when loading the selected version rejects", async () => {
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
