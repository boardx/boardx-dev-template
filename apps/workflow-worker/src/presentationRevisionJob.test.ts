import { describe, it, expect } from "vitest";
import { processPresentationRevisionJob } from "./presentationRevisionJob";
import { PRESENTATION_REVISION_FORCE_FAIL_MARKER } from "@repo/ai";

const SLIDES = [
  { n: 1, title: "标题页", bullets: ["主题：X"] },
  { n: 2, title: "X — 第 2 页", bullets: ["要点 2-1", "要点 2-2"] },
];

describe("processPresentationRevisionJob", () => {
  it("kind='plan' 成功 → ready 且返回全部幻灯片 + 摘要", async () => {
    const outcome = await processPresentationRevisionJob({
      revisionId: "pr_1",
      artifactId: "pa_1",
      kind: "plan",
      instructions: "受众改为投资人",
      currentTitle: "X",
      currentSlides: SLIDES,
    });
    expect(outcome.status).toBe("ready");
    expect(outcome.slides).toHaveLength(2);
    expect(outcome.summary?.length).toBeGreaterThan(0);
  });

  it("kind='page' 成功 → 仅目标页被替换，其余页原样保留", async () => {
    const outcome = await processPresentationRevisionJob({
      revisionId: "pr_2",
      artifactId: "pa_1",
      kind: "page",
      pageN: 2,
      instructions: "加一张架构图",
      currentTitle: "X",
      currentSlides: SLIDES,
    });
    expect(outcome.status).toBe("ready");
    expect(outcome.slides).toHaveLength(2);
    expect(outcome.slides?.[0]).toEqual(SLIDES[0]); // 第 1 页未变
    expect(outcome.slides?.[1]?.bullets).toContain("优化：加一张架构图");
  });

  it("kind='page' 目标页不存在 → error", async () => {
    const outcome = await processPresentationRevisionJob({
      revisionId: "pr_3",
      artifactId: "pa_1",
      kind: "page",
      pageN: 99,
      instructions: "任意要求",
      currentTitle: "X",
      currentSlides: SLIDES,
    });
    expect(outcome.status).toBe("error");
    expect(outcome.errorMessage).toBeTruthy();
  });

  it("强制失败触发词 → error，不影响原 slides（调用方不应回写 artifacts）", async () => {
    const outcome = await processPresentationRevisionJob({
      revisionId: "pr_4",
      artifactId: "pa_1",
      kind: "plan",
      instructions: PRESENTATION_REVISION_FORCE_FAIL_MARKER,
      currentTitle: "X",
      currentSlides: SLIDES,
    });
    expect(outcome.status).toBe("error");
    expect(outcome.errorMessage).toBeTruthy();
    expect(outcome.slides).toBeUndefined();
  });
});
