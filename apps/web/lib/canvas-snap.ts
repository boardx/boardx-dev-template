// canvas-snap.ts — 对齐吸附（uc-canvas-007）纯逻辑。
// 从 board-canvas.tsx 抽出，供 DOM 覆盖层（参考线渲染）与 fabric 渲染层（拖拽吸附）共用（p6:F13）。
// 拖动组件时，若其边缘/中心线与其它组件的边缘/中心线足够接近（画布坐标系阈值
// SNAP_TOLERANCE），则吸附到该对齐位置并显示参考线。

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
