// @repo/export 单测（issue #638）：产物确定非空 + 格式合法 + 内容包含图元。
import { describe, it, expect } from "vitest";
import { renderBoardToSvg, renderBoardToPdf, renderBoard, computeBounds, type ExportItem } from "./index";

const items: ExportItem[] = [
  { type: "rect", x: 100, y: 100, w: 120, h: 60, text: "Hello", color: "#3b82f6" },
  { type: "ellipse", x: 300, y: 150, w: 80, h: 80, text: null, color: "red" },
  { type: "line", x: 100, y: 250, w: 200, h: 0, text: null, color: "#000000" },
];

describe("computeBounds", () => {
  it("空 items 回退最小画布（产物永远非空）", () => {
    const b = computeBounds([]);
    expect(b.width).toBeGreaterThanOrEqual(320);
    expect(b.height).toBeGreaterThanOrEqual(320);
  });
  it("含内边距地包住所有图元", () => {
    const b = computeBounds(items, 24);
    expect(b.minX).toBeLessThanOrEqual(100 - 24);
    expect(b.width).toBeGreaterThan(380 - 100); // 覆盖到 x=380 的 ellipse 右缘
  });
});

describe("renderBoardToSvg", () => {
  it("产出合法非空 SVG，含每个图元的文本与形状", () => {
    const svg = renderBoardToSvg(items, { title: "My Board" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("My Board");
    expect(svg).toContain("Hello");
    expect(svg).toContain("<ellipse");
    expect(svg).toContain("<line");
    expect(svg.length).toBeGreaterThan(200);
  });
  it("转义文本里的 XML 特殊字符（防注入/损坏）", () => {
    const svg = renderBoardToSvg([{ type: "rect", x: 0, y: 0, w: 50, h: 20, text: '<script>&"', color: null }]);
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });
  it("空板也出合法 SVG", () => {
    expect(renderBoardToSvg([]).startsWith("<svg")).toBe(true);
  });
});

describe("renderBoardToPdf", () => {
  it("产出非空 PDF（%PDF 魔数头）", async () => {
    const pdf = await renderBoardToPdf(items, { title: "My Board" });
    expect(pdf.length).toBeGreaterThan(500);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
  });
  it("空板也出非空 PDF（一页白板）", async () => {
    const pdf = await renderBoardToPdf([]);
    expect(pdf.length).toBeGreaterThan(400);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
  });
});

describe("renderBoard 统一入口", () => {
  it("svg → image/svg+xml", async () => {
    const r = await renderBoard(items, "svg");
    expect(r.contentType).toBe("image/svg+xml");
    expect(r.extension).toBe("svg");
    expect(r.body.length).toBeGreaterThan(0);
  });
  it("pdf → application/pdf", async () => {
    const r = await renderBoard(items, "pdf");
    expect(r.contentType).toBe("application/pdf");
    expect(r.extension).toBe("pdf");
    expect(r.body.length).toBeGreaterThan(0);
  });
});
