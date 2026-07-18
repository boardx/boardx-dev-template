import { describe, expect, it } from "vitest";
import {
  isExactReportVersionResponse,
  selectExactReportVersion,
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
