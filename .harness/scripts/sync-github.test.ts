import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildIssueBody,
  decideClose,
  isProjectedBody,
  partitionTitleMatches,
  projectionMarker,
} from "./sync-github";
import { PHASES_DIR } from "./lib/paths";
import type { Feature, FeatureList } from "./lib/types";

function makeFeature(overrides: Partial<Feature> = {}): Feature {
  return {
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
    ...overrides,
  };
}

describe("buildIssueBody", () => {
  it("links p27 feature issues to parent issue 662", () => {
    const feature = makeFeature();
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

  it("embeds the projection marker so future syncs can recognize their own issues", () => {
    const feature = makeFeature();
    const featureList: FeatureList = { phase: "p27", features: [feature] };

    const body = buildIssueBody(feature, "p27", "01", "boardx/boardx-dev-template", featureList);

    expect(body).toContain(projectionMarker("p27", "F01"));
    expect(isProjectedBody(body, "p27", "F01")).toBe(true);
    // marker 是 per-feature 的：不会误认别的 feature 的投影
    expect(isProjectedBody(body, "p27", "F02")).toBe(false);
  });

  describe("Story section（人类拍板 2026-07-19：闭环延伸到 GitHub）", () => {
    it("缺 spec_ref → 醒目提示，不是静默省略", () => {
      const feature = makeFeature(); // 无 spec_ref
      const featureList: FeatureList = { phase: "p27", features: [feature] };
      const body = buildIssueBody(feature, "p27", "01", "boardx/boardx-dev-template", featureList);
      expect(body).toContain("## Story");
      expect(body).toContain("⚠ 缺少可追溯的 story");
    });

    it("有效 spec_ref → 渲染指向 requirements 文件的链接 + 章节 ID", () => {
      const phaseDir = join(PHASES_DIR, "phase-zz-sync-test-fixture");
      const reqDir = join(phaseDir, "requirements");
      mkdirSync(reqDir, { recursive: true });
      writeFileSync(join(reqDir, "auth.md"), "## R3 验收线索\n内容", "utf8");
      try {
        const feature = makeFeature({ spec_ref: "auth.md#R3" });
        const featureList: FeatureList = { phase: "zz-sync-test", features: [feature] };
        const body = buildIssueBody(feature, "zz-sync-test", "01", "boardx/boardx-dev-template", featureList);
        expect(body).toContain("[requirements/auth.md]");
        expect(body).toContain("requirements/auth.md");
        expect(body).toContain("`R3`");
        expect(body).not.toContain("⚠ 缺少可追溯的 story");
      } finally {
        rmSync(phaseDir, { recursive: true, force: true });
      }
    });
  });
});

describe("partitionTitleMatches (#713 marker guard)", () => {
  const phaseId = "p29";
  const featureId = "F03";
  const marker = projectionMarker(phaseId, featureId);

  const manualIssue = {
    number: 100,
    title: "[F03] 修登录",
    body: "人工开的 issue，标题恰好和投影撞名。没有任何 marker。",
    state: "OPEN",
  };
  const projectedIssue = {
    number: 101,
    title: "[F03] 修登录",
    body: `${marker}\n\n## 交付契约（user_visible_behavior）\n...`,
    state: "OPEN",
  };

  it("treats a title-colliding manual issue (no marker) as a collision, never as the projection", () => {
    const { projection, collisions } = partitionTitleMatches([manualIssue], phaseId, featureId);
    expect(projection).toBeNull();
    expect(collisions).toEqual([manualIssue]);
    // 净效果：edit 路径拿不到 existing → 不 edit；close 路径 decideClose(null) → 不关。
    expect(decideClose(projection)).toBe("skip-missing");
  });

  it("picks the marker-bearing projection even when a manual issue shadows it in search order", () => {
    const { projection, collisions } = partitionTitleMatches(
      [manualIssue, projectedIssue],
      phaseId,
      featureId,
    );
    expect(projection).toBe(projectedIssue);
    expect(collisions).toEqual([manualIssue]);
  });

  it("does not accept a marker for a different feature", () => {
    const otherFeatureIssue = {
      ...projectedIssue,
      body: `${projectionMarker(phaseId, "F04")}\n\n...`,
    };
    const { projection } = partitionTitleMatches([otherFeatureIssue], phaseId, featureId);
    expect(projection).toBeNull();
  });

  it("marker judgement uses the pre-edit body, so injecting the marker via edit cannot bypass the guard", () => {
    // #713 根因回归测试：旧实现在 edit 后用「刚写入的新 body」（必带 marker）回填
    // issueForClose，导致人工 issue 被当作投影关闭。守卫必须只看 GitHub 上的现存 body。
    const { projection } = partitionTitleMatches([manualIssue], phaseId, featureId);
    expect(projection).toBeNull();
    const bodyWeWouldWrite = `${marker}\n...`;
    expect(isProjectedBody(bodyWeWouldWrite, phaseId, featureId)).toBe(true); // 新 body 必带 marker
    expect(isProjectedBody(manualIssue.body, phaseId, featureId)).toBe(false); // 但判定依据是现存 body
  });
});

describe("decideClose (idempotency, #526)", () => {
  it("never closes when no projection issue was found", () => {
    expect(decideClose(null)).toBe("skip-missing");
  });

  it("does not re-close an already closed projection issue (and never reopens)", () => {
    expect(
      decideClose({ number: 7, title: "[F01] x", body: "b", state: "CLOSED" }),
    ).toBe("skip-closed");
    expect(
      decideClose({ number: 7, title: "[F01] x", body: "b", state: "closed" }),
    ).toBe("skip-closed");
  });

  it("closes an open projection issue", () => {
    expect(
      decideClose({ number: 7, title: "[F01] x", body: "b", state: "OPEN" }),
    ).toBe("close");
  });
});
