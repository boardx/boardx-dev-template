import { describe, expect, it } from "vitest";
import {
  createDefaultReportLayout,
  moveReportModule,
  resizeReportModule,
  updateReportModulePrompt,
} from "./survey-report-layout";

describe("survey report layout", () => {
  it("creates chart, image and text modules on a 12-column grid", () => {
    const layout = createDefaultReportLayout();
    expect(layout.map((module) => module.type)).toEqual(["chart", "image", "text"]);
    expect(layout.every((module) => module.x >= 0 && module.x + module.w <= 12)).toBe(true);
  });

  it("clamps moved and resized modules to the export grid", () => {
    const [chart] = createDefaultReportLayout();
    const moved = moveReportModule(chart!, { x: 11, y: -4 });
    const resized = resizeReportModule(moved, { w: 30, h: 0 });
    expect(moved.x + moved.w).toBeLessThanOrEqual(12);
    expect(moved.y).toBe(0);
    expect(resized.w).toBeLessThanOrEqual(12);
    expect(resized.h).toBeGreaterThanOrEqual(2);
  });

  it("keeps an independent generation prompt for every module", () => {
    const layout = createDefaultReportLayout();
    const updated = updateReportModulePrompt(layout, "image", "生成学生画像信息图");
    expect(updated.find((module) => module.id === "image")?.prompt).toBe("生成学生画像信息图");
    expect(updated.find((module) => module.id === "chart")?.prompt).not.toBe("生成学生画像信息图");
  });
});
