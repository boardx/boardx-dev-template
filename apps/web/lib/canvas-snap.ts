// canvas-snap.ts — 对齐吸附（uc-canvas-007）纯逻辑。
// 从 board-canvas.tsx 抽出，供 DOM 覆盖层（参考线渲染）与 fabric 渲染层（拖拽吸附）共用（p6:F13）。
// 拖动组件时，若其边缘/中心线与其它组件的边缘/中心线足够接近（画布坐标系阈值
// SNAP_TOLERANCE），则吸附到该对齐位置并显示参考线。
//
// p6:F07 扩展（uc-canvas-007 补齐）：
// - computeResizeSnap：角点缩放时，移动中的边（而非整个矩形的三锚点）对齐邻近组件的边/中心。
// - computeSpacingSnap：与同轴向邻近组件形成等间距时吸附，并产出间距提示（SpacingHint）。
// 本文件保持纯几何（无 DOM / fabric 依赖），渲染层只消费结果；单测见 canvas-snap.test.ts。

export const SNAP_TOLERANCE = 6;

export interface Guide {
  orientation: "v" | "h"; // v=竖直参考线（沿 x 对齐）；h=水平参考线（沿 y 对齐）
  pos: number; // 参考线在画布坐标系中的 x（v）或 y（h）
}

export interface SnapRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// 组件在某一轴上的三条对齐锚点（前/中/后 = 左中右 或 上中下）。
function anchors(start: number, size: number): number[] {
  return [start, start + size / 2, start + size];
}

// 计算拖动结果的吸附增量 + 需显示的参考线。
// dragged: 拖动后（未吸附）的目标 item；others: 其余静止 item。
// 返回沿 x/y 的吸附增量（把 dragged 拉到对齐位置）与参考线集合。
export function computeSnap(
  dragged: SnapRect,
  others: SnapRect[],
): { snapDX: number; snapDY: number; guides: Guide[] } {
  const guides: Guide[] = [];
  let snapDX = 0;
  let snapDY = 0;
  let bestX = SNAP_TOLERANCE + 1;
  let bestY = SNAP_TOLERANCE + 1;

  const dragXA = anchors(dragged.x, dragged.w);
  const dragYA = anchors(dragged.y, dragged.h);

  for (const o of others) {
    const oxA = anchors(o.x, o.w);
    const oyA = anchors(o.y, o.h);
    for (const dx of dragXA) {
      for (const ox of oxA) {
        const diff = Math.abs(dx - ox);
        if (diff <= SNAP_TOLERANCE && diff < bestX) {
          bestX = diff;
          snapDX = ox - dx;
        }
      }
    }
    for (const dy of dragYA) {
      for (const oy of oyA) {
        const diff = Math.abs(dy - oy);
        if (diff <= SNAP_TOLERANCE && diff < bestY) {
          bestY = diff;
          snapDY = oy - dy;
        }
      }
    }
  }

  const snap = { snapDX: bestX <= SNAP_TOLERANCE ? snapDX : 0, snapDY: bestY <= SNAP_TOLERANCE ? snapDY : 0 };

  // 吸附确定后，收集所有与吸附后位置精确重合的对齐线用于绘制参考线。
  if (bestX <= SNAP_TOLERANCE) {
    const snappedX = anchors(dragged.x + snap.snapDX, dragged.w);
    const seen = new Set<number>();
    for (const o of others) {
      for (const ox of anchors(o.x, o.w)) {
        if (snappedX.some((a) => Math.abs(a - ox) < 0.5) && !seen.has(ox)) {
          seen.add(ox);
          guides.push({ orientation: "v", pos: ox });
        }
      }
    }
  }
  if (bestY <= SNAP_TOLERANCE) {
    const snappedY = anchors(dragged.y + snap.snapDY, dragged.h);
    const seen = new Set<number>();
    for (const o of others) {
      for (const oy of anchors(o.y, o.h)) {
        if (snappedY.some((a) => Math.abs(a - oy) < 0.5) && !seen.has(oy)) {
          seen.add(oy);
          guides.push({ orientation: "h", pos: oy });
        }
      }
    }
  }

  return { ...snap, guides };
}

// ── p6:F07 缩放吸附 ─────────────────────────────────────────────────────────

/** 角点缩放的操作角：t/b = 上/下边在动，l/r = 左/右边在动。 */
export type ResizeCorner = "tl" | "tr" | "bl" | "br";

// 角点缩放时的吸附：只有正在移动的两条边参与对齐（老 aligning-guidelines 的
// collect-point 思路：按操作角点取移动边，对齐其它组件的边/中心）。
// rect: 缩放中的候选矩形（未吸附）；corner: 操作角点。
// snapDX/snapDY 是**移动边**需要平移的增量（渲染层据此反推 scale 与原点）。
export function computeResizeSnap(
  rect: SnapRect,
  others: SnapRect[],
  corner: ResizeCorner,
): { snapDX: number; snapDY: number; guides: Guide[] } {
  const movingX = corner.includes("l") ? rect.x : rect.x + rect.w;
  const movingY = corner.includes("t") ? rect.y : rect.y + rect.h;
  let snapDX = 0;
  let snapDY = 0;
  let bestX = SNAP_TOLERANCE + 1;
  let bestY = SNAP_TOLERANCE + 1;
  for (const o of others) {
    for (const ox of anchors(o.x, o.w)) {
      const diff = Math.abs(movingX - ox);
      if (diff <= SNAP_TOLERANCE && diff < bestX) {
        bestX = diff;
        snapDX = ox - movingX;
      }
    }
    for (const oy of anchors(o.y, o.h)) {
      const diff = Math.abs(movingY - oy);
      if (diff <= SNAP_TOLERANCE && diff < bestY) {
        bestY = diff;
        snapDY = oy - movingY;
      }
    }
  }
  const guides: Guide[] = [];
  if (bestX <= SNAP_TOLERANCE) {
    const seen = new Set<number>();
    for (const o of others) {
      for (const ox of anchors(o.x, o.w)) {
        if (Math.abs(movingX + snapDX - ox) < 0.5 && !seen.has(ox)) {
          seen.add(ox);
          guides.push({ orientation: "v", pos: ox });
        }
      }
    }
  }
  if (bestY <= SNAP_TOLERANCE) {
    const seen = new Set<number>();
    for (const o of others) {
      for (const oy of anchors(o.y, o.h)) {
        if (Math.abs(movingY + snapDY - oy) < 0.5 && !seen.has(oy)) {
          seen.add(oy);
          guides.push({ orientation: "h", pos: oy });
        }
      }
    }
  }
  return {
    snapDX: bestX <= SNAP_TOLERANCE ? snapDX : 0,
    snapDY: bestY <= SNAP_TOLERANCE ? snapDY : 0,
    guides,
  };
}

// ── p6:F07 等间距吸附与提示 ─────────────────────────────────────────────────

/**
 * 等间距提示：orientation="h" 表示水平排布（沿 x 轴的间隙），"v" 表示垂直排布。
 * segs 是每段相等间隙的起止（主轴坐标）与提示徽标的横轴位置（画布坐标）。
 */
export interface SpacingHint {
  orientation: "h" | "v";
  gap: number;
  segs: Array<{ from: number; to: number; cross: number }>;
}

interface AxisRect {
  start: number;
  size: number;
  crossStart: number;
  crossSize: number;
}

function toAxis(r: SnapRect, axis: "x" | "y"): AxisRect {
  return axis === "x"
    ? { start: r.x, size: r.w, crossStart: r.y, crossSize: r.h }
    : { start: r.y, size: r.h, crossStart: r.x, crossSize: r.w };
}

interface AxisSpacing {
  delta: number;
  gap: number;
  segs: Array<{ from: number; to: number; cross: number }>;
}

// 单轴等间距检测：dragged 与横轴方向上有投影重叠的邻居比较。
// 三种构型（均要求间隙 > 0）：
//   A. dragged 在最近左邻 l1 右侧，复制 l2↔l1 的既有间距；
//   B. dragged 在最近右邻 r1 左侧，复制 r1↔r2 的既有间距；
//   C. dragged 位于 l1 与 r1 之间，取两侧等距（居中）。
// 取偏差最小且在 SNAP_TOLERANCE 内的构型。
function spacingAxis(dragged: SnapRect, others: SnapRect[], axis: "x" | "y"): AxisSpacing | null {
  const d = toAxis(dragged, axis);
  const cross = d.crossStart + d.crossSize / 2;
  const cands = others
    .map((o) => toAxis(o, axis))
    .filter((o) => o.crossStart < d.crossStart + d.crossSize && o.crossStart + o.crossSize > d.crossStart);
  const lefts = cands
    .filter((o) => o.start + o.size <= d.start + SNAP_TOLERANCE)
    .sort((a, b) => b.start + b.size - (a.start + a.size));
  const rights = cands
    .filter((o) => o.start >= d.start + d.size - SNAP_TOLERANCE)
    .sort((a, b) => a.start - b.start);
  const l1 = lefts[0];
  const l2 = lefts[1];
  const r1 = rights[0];
  const r2 = rights[1];

  const options: AxisSpacing[] = [];
  if (l1 && l2) {
    const gap = l1.start - (l2.start + l2.size);
    if (gap > 0) {
      const desired = l1.start + l1.size + gap;
      const delta = desired - d.start;
      if (Math.abs(delta) <= SNAP_TOLERANCE)
        options.push({
          delta,
          gap,
          segs: [
            { from: l2.start + l2.size, to: l1.start, cross },
            { from: l1.start + l1.size, to: desired, cross },
          ],
        });
    }
  }
  if (r1 && r2) {
    const gap = r2.start - (r1.start + r1.size);
    if (gap > 0) {
      const desired = r1.start - gap - d.size;
      const delta = desired - d.start;
      if (Math.abs(delta) <= SNAP_TOLERANCE)
        options.push({
          delta,
          gap,
          segs: [
            { from: desired + d.size, to: r1.start, cross },
            { from: r1.start + r1.size, to: r2.start, cross },
          ],
        });
    }
  }
  if (l1 && r1) {
    const gap = (r1.start - (l1.start + l1.size) - d.size) / 2;
    if (gap > 0) {
      const desired = l1.start + l1.size + gap;
      const delta = desired - d.start;
      if (Math.abs(delta) <= SNAP_TOLERANCE)
        options.push({
          delta,
          gap,
          segs: [
            { from: l1.start + l1.size, to: desired, cross },
            { from: desired + d.size, to: r1.start, cross },
          ],
        });
    }
  }
  if (!options.length) return null;
  options.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));
  return options[0]!;
}

// 等间距吸附：返回把 dragged 拉到等间距位置的增量与间距提示。
// 与 computeSnap 的关系由调用方裁决（约定：某轴已发生边/中心吸附时忽略该轴的等间距）。
export function computeSpacingSnap(
  dragged: SnapRect,
  others: SnapRect[],
): { snapDX: number; snapDY: number; hints: SpacingHint[] } {
  const hx = spacingAxis(dragged, others, "x");
  const hy = spacingAxis(dragged, others, "y");
  const hints: SpacingHint[] = [];
  if (hx) hints.push({ orientation: "h", gap: hx.gap, segs: hx.segs });
  if (hy) hints.push({ orientation: "v", gap: hy.gap, segs: hy.segs });
  return { snapDX: hx?.delta ?? 0, snapDY: hy?.delta ?? 0, hints };
}
