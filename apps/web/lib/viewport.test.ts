import { describe, it, expect } from "vitest";
import { clampScale, zoomBy, toPercent, resetViewport, MIN_SCALE, MAX_SCALE } from "./viewport";

describe("viewport", () => {
  it("clampScale 限制在 [MIN,MAX]", () => {
    expect(clampScale(0.01)).toBe(MIN_SCALE);
    expect(clampScale(99)).toBe(MAX_SCALE);
    expect(clampScale(1.5)).toBe(1.5);
  });

  it("zoomBy 放大缩小并 clamp", () => {
    expect(zoomBy(1, 1.2)).toBeCloseTo(1.2);
    expect(zoomBy(1, 1 / 1.2)).toBeCloseTo(0.8333, 3);
    expect(zoomBy(MAX_SCALE, 2)).toBe(MAX_SCALE);
    expect(zoomBy(MIN_SCALE, 0.1)).toBe(MIN_SCALE);
  });

  it("toPercent 取整百分比", () => {
    expect(toPercent(1)).toBe(100);
    expect(toPercent(1.234)).toBe(123);
  });

  it("resetViewport 回到 100% 居中", () => {
    expect(resetViewport()).toEqual({ scale: 1, tx: 0, ty: 0 });
  });
});
