import { describe, expect, it } from "vitest";
import { phaseIdNumber, nextPhaseId, findPhaseIdConflicts } from "./phase-id";

describe("phaseIdNumber", () => {
  it("parses pN ids", () => {
    expect(phaseIdNumber("p30")).toBe(30);
    expect(phaseIdNumber("p0")).toBe(0);
  });

  it("parses legacy numeric ids", () => {
    expect(phaseIdNumber("01")).toBe(1);
    expect(phaseIdNumber("04")).toBe(4);
    expect(phaseIdNumber("24")).toBe(24);
  });

  it("returns null for non-numeric ids", () => {
    expect(phaseIdNumber("foundation")).toBeNull();
    expect(phaseIdNumber("")).toBeNull();
    expect(phaseIdNumber("p")).toBeNull();
  });
});

describe("nextPhaseId", () => {
  it("allocates max(numeric part) + 1 with pN prefix", () => {
    expect(nextPhaseId(["01", "04", "p0", "p29", "p30"])).toBe("p31");
  });

  it("mixes legacy and pN ids correctly", () => {
    expect(nextPhaseId(["24", "p9"])).toBe("p25");
  });

  it("ignores non-numeric ids and handles empty list", () => {
    expect(nextPhaseId(["weird", "p2"])).toBe("p3");
    expect(nextPhaseId([])).toBe("p1");
  });
});

describe("findPhaseIdConflicts", () => {
  const roadmapIds = ["01", "p29", "p30"];
  const dirs = ["phase-01-foundation", "phase-p30-devportal-platform", "requirements", "ROADMAP.md"];

  it("flags an id already registered in roadmap", () => {
    expect(findPhaseIdConflicts("p29", roadmapIds, dirs)).toEqual([
      'roadmap.yaml 已有 id "p29" 的条目',
    ]);
  });

  it("flags an id whose phases/ directory exists (even if roadmap missed it)", () => {
    const conflicts = findPhaseIdConflicts("p30", ["01"], dirs);
    expect(conflicts).toEqual(["phases/phase-p30-devportal-platform 目录已存在"]);
  });

  it("reports both conflict sources at once", () => {
    const conflicts = findPhaseIdConflicts("p30", roadmapIds, dirs);
    expect(conflicts).toHaveLength(2);
  });

  it("does not false-positive on prefix-sharing ids (p3 vs p30)", () => {
    expect(findPhaseIdConflicts("p3", ["p30"], ["phase-p30-devportal-platform"])).toEqual([]);
  });

  it("passes a free id", () => {
    expect(findPhaseIdConflicts("p31", roadmapIds, dirs)).toEqual([]);
  });
});
