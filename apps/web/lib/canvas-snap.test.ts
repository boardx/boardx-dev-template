// canvas-snap.test.ts — 对齐/等间距/缩放吸附纯几何单测（p6:F07，uc-canvas-007）。
import { describe, expect, it } from "vitest";
import {
  SNAP_TOLERANCE,
  computeResizeSnap,
  computeSnap,
  computeSpacingSnap,
  type SnapRect,
} from "./canvas-snap";

const rect = (x: number, y: number, w = 100, h = 60): SnapRect => ({ x, y, w, h });

describe("computeSnap（拖动吸附，F06 既有行为基线）", () => {
  it("左边缘接近另一组件左边缘 → 吸附并给出竖直参考线", () => {
    const { snapDX, snapDY, guides } = computeSnap(rect(43, 300), [rect(40, 40)]);
    expect(snapDX).toBe(-3);
    expect(snapDY).toBe(0);
    expect(guides.some((g) => g.orientation === "v" && g.pos === 40)).toBe(true);
  });

  it("中心对齐：不同宽度组件中心接近 → 吸附到中心线", () => {
    // other 中心 x=90；dragged w=40，x=72 → 中心 92，差 2。
    const { snapDX, guides } = computeSnap(rect(72, 300, 40, 40), [rect(40, 40)]);
    expect(snapDX).toBe(-2);
    expect(guides).toContainEqual({ orientation: "v", pos: 90 });
  });

  it("超出阈值不吸附也无参考线", () => {
    // other 的 x 锚点 {40,90,140}、y 锚点 {40,70,100}；dragged 锚点全部距其 > 阈值。
    const { snapDX, snapDY, guides } = computeSnap(rect(300, 400), [rect(40, 40)]);
    expect(snapDX).toBe(0);
    expect(snapDY).toBe(0);
    expect(guides).toHaveLength(0);
  });
});

describe("computeResizeSnap（角点缩放吸附，F07）", () => {
  it("br 角：右边缘接近另一组件右边缘 → 移动边吸附", () => {
    // other 右边缘 240；缩放中 rect 右边缘 243。
    const { snapDX, snapDY, guides } = computeResizeSnap(rect(40, 300, 203, 80), [rect(40, 40, 200, 100)], "br");
    expect(snapDX).toBe(-3);
    expect(snapDY).toBe(0);
    expect(guides).toContainEqual({ orientation: "v", pos: 240 });
  });

  it("br 角：只有移动中的边参与，静止的左边不触发吸附", () => {
    // dragged 左边缘 40 与 other 左边缘 40 完全重合，但操作 br 时左边不动 → 不产生 x 吸附。
    const { snapDX, guides } = computeResizeSnap(rect(40, 300, 150, 80), [rect(40, 40, 200, 100)], "br");
    expect(snapDX).toBe(0);
    expect(guides.filter((g) => g.orientation === "v")).toHaveLength(0);
  });

  it("tl 角：上/左边为移动边，吸附到邻居下边缘", () => {
    // other 下边缘 y=140；缩放中 rect 上边 y=143。
    const { snapDY, guides } = computeResizeSnap(rect(400, 143, 100, 80), [rect(400, 40, 100, 100)], "tl");
    expect(snapDY).toBe(-3);
    expect(guides).toContainEqual({ orientation: "h", pos: 140 });
  });

  it("超出阈值不吸附", () => {
    const { snapDX, snapDY } = computeResizeSnap(rect(40, 300, 150, 80), [rect(500, 500)], "br");
    expect(snapDX).toBe(0);
    expect(snapDY).toBe(0);
  });
});

describe("computeSpacingSnap（等间距吸附与提示，F07）", () => {
  // 三个等高组件横排：A[40..200] gap100 B[300..460]，dragged 拖到 B 右侧附近。
  const A = rect(40, 40, 160, 100);
  const B = rect(300, 40, 160, 100);

  it("构型 A：拖到右侧，与既有间距相等处吸附并给出两段提示", () => {
    const dragged = rect(565, 40, 160, 100); // 与 B 的间隙 105，目标 560（间隙 100）
    const { snapDX, snapDY, hints } = computeSpacingSnap(dragged, [A, B]);
    expect(snapDX).toBe(-5);
    expect(snapDY).toBe(0);
    const h = hints.find((x) => x.orientation === "h")!;
    expect(h.gap).toBe(100);
    expect(h.segs).toHaveLength(2);
    expect(h.segs[0]).toMatchObject({ from: 200, to: 300 });
    expect(h.segs[1]).toMatchObject({ from: 460, to: 560 });
  });

  it("构型 B：拖到左侧，复制右侧两邻居的间距", () => {
    const dragged = rect(-216, 40, 150, 100); // 目标 x=-210（A 左边 40 - gap100 - w150）
    const { snapDX, hints } = computeSpacingSnap(dragged, [A, B]);
    expect(snapDX).toBe(6);
    expect(hints.find((x) => x.orientation === "h")!.gap).toBe(100);
  });

  it("构型 C：位于两个邻居之间 → 吸附到两侧等距（居中）", () => {
    // A 右 200，B2 左 460；dragged w=160 居中 x=250、两侧 gap 50。
    const B2 = rect(460, 40, 160, 100);
    const dragged = rect(254, 40, 160, 100);
    const { snapDX, hints } = computeSpacingSnap(dragged, [A, B2]);
    expect(snapDX).toBe(-4);
    const h = hints.find((x) => x.orientation === "h")!;
    expect(h.gap).toBe(50);
    expect(h.segs[0]).toMatchObject({ from: 200, to: 250 });
    expect(h.segs[1]).toMatchObject({ from: 410, to: 460 });
  });

  it("已在精确等间距位置：delta 为 0 但提示仍在（拖动中持续显示）", () => {
    const dragged = rect(560, 40, 160, 100);
    const { snapDX, hints } = computeSpacingSnap(dragged, [A, B]);
    expect(snapDX).toBe(0);
    expect(hints.find((x) => x.orientation === "h")).toBeTruthy();
  });

  it("横轴投影不重叠的组件不参与等间距", () => {
    // 两邻居在 y=40..140，dragged 在 y=400（无垂直重叠）→ 无提示。
    const dragged = rect(565, 400, 160, 100);
    const { snapDX, hints } = computeSpacingSnap(dragged, [A, B]);
    expect(snapDX).toBe(0);
    expect(hints).toHaveLength(0);
  });

  it("偏差超出阈值不吸附", () => {
    const dragged = rect(580, 40, 160, 100); // 目标 560，偏差 20 > 阈值
    const { snapDX, hints } = computeSpacingSnap(dragged, [A, B]);
    expect(snapDX).toBe(0);
    expect(hints.find((x) => x.orientation === "h")).toBeFalsy();
  });

  it("纵向排布：垂直等间距给出 v 提示", () => {
    const T = rect(40, 40, 160, 100); // 下边 140
    const M = rect(40, 200, 160, 100); // gap 60，下边 300
    const dragged = rect(40, 357, 160, 100); // 目标 y=360
    const { snapDY, hints } = computeSpacingSnap(dragged, [T, M]);
    expect(snapDY).toBe(3);
    const v = hints.find((x) => x.orientation === "v")!;
    expect(v.gap).toBe(60);
  });
});
