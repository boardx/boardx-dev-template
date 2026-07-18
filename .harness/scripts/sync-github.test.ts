import { describe, expect, it } from "vitest";
import { buildIssueBody } from "./sync-github";
import type { Feature, FeatureList } from "./lib/types";

describe("buildIssueBody", () => {
  it("links p27 feature issues to parent issue 662", () => {
    const feature: Feature = {
      id: "F01",
      priority: 1,
      area: "ai-store-data",
      title: "Team tenancy",
      user_visible_behavior: "Team resources are isolated.",
      status: "not_started",
      sprint: "01",
      owner: null,
      capability: "CAP-DATA",
      depends_on: [],
      wave: 0,
      verification: ["true"],
      evidence: "",
      notes: "Parent issue projection test.",
    };
    const featureList: FeatureList = { phase: "p27", features: [feature] };

    const body = buildIssueBody(
      feature,
      "p27",
      "01",
      "boardx/boardx-dev-template",
      featureList,
      662,
    );

    expect(body).toContain("## Parent Tracking Issue");
    expect(body).toContain("Parent: #662");
    expect(body).toContain(
      "https://github.com/boardx/boardx-dev-template/issues/662",
    );
  });
});
