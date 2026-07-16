import { describe, expect, it } from "vitest";
import { renderRoadmapPhase } from "./roadmap";

describe("renderRoadmapPhase", () => {
  it("preserves a phase tracking issue", () => {
    const yaml = renderRoadmapPhase({
      id: "p27",
      slug: "aiStore",
      name: "AI Store",
      goal: "Complete AI Store",
      status: "not_started",
      depends_on: [],
      tracking_issue: 662,
    });

    expect(yaml).toContain('id: "p27"');
    expect(yaml).toContain("tracking_issue: 662");
  });
});
