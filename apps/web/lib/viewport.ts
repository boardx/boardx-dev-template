// apps/web/lib/viewport.ts — 画布视口变换纯函数（P6 F05）

export const MIN_SCALE = 0.2;
export const MAX_SCALE = 4;
export const ZOOM_IN_FACTOR = 1.2;
export const ZOOM_OUT_FACTOR = 1 / 1.2;

export interface Viewport {
  scale: number;
  tx: number;
  ty: number;
}

export const DEFAULT_VIEWPORT: Viewport = { scale: 1, tx: 0, ty: 0 };

export function clampScale(s: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

/** 以因子缩放（带 clamp）。 */
export function zoomBy(scale: number, factor: number): number {
  return clampScale(scale * factor);
}

/** 缩放百分比（整数）。 */
export function toPercent(scale: number): number {
  return Math.round(scale * 100);
}

/** 重置到 100% 居中。 */
export function resetViewport(): Viewport {
  return { ...DEFAULT_VIEWPORT };
}
