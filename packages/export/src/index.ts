// @repo/export — headless 画布导出能力（issue #638，人类拍板 2026-07-15）。
//
// 架构选择：**不用 headless chrome**。board_items 是确定性图元（type/x/y/w/h/text/color），
// 用纯 JS 直接渲染成 SVG（矢量图片）与 PDF（pdf-lib）——零原生依赖、任何环境可跑
// （devapp / 云 / 私有 / 甚至 Workers），完全可单测、产物确定非空。headless chrome
// 有 chrome 二进制依赖、平台绑定，违背"架构可跨云/私有部署"硬约束，故不选。
//
// 消费方：p7-F09（幻灯片导出 PDF）、p7-F15（导出选中内容）。接法见 apps/web 的
// /api/boards/[id]/export 端点。选中导出 = 传入过滤后的 items 子集即可。
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

/** 导出输入：board_items 的最小渲染子集（与 packages/data 的 BoardItemRow 对齐）。 */
export interface ExportItem {
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string | null;
  color?: string | null;
}

export interface ExportOptions {
  /** 画布标题，渲染在页眉；缺省不渲染 */
  title?: string;
  /** 内边距（画布坐标单位），默认 24 */
  padding?: number;
}

const DEFAULT_PADDING = 24;
const MIN_CANVAS = 320; // 空板也给一个可视最小尺寸，产物永远非空

/** 十六进制/命名色 → 归一，非法回退。SVG 与 PDF 共用。 */
function normColor(c: string | null | undefined, fallback: string): string {
  if (!c) return fallback;
  const s = c.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
  if (/^[a-zA-Z]+$/.test(s)) return s; // 命名色（black/red…）SVG 直接认
  return fallback;
}

function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const named: Record<string, string> = { black: "#000000", white: "#ffffff", red: "#e5484d", blue: "#3b82f6", green: "#22c55e", gray: "#6b7280", grey: "#6b7280", yellow: "#eab308" };
  let h = (named[hex.toLowerCase()] ?? hex).replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6).padEnd(6, "0"), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

/** 计算包围盒（含内边距），空 items 回退最小画布。 */
export function computeBounds(items: ExportItem[], padding = DEFAULT_PADDING): { width: number; height: number; minX: number; minY: number } {
  if (items.length === 0) return { width: MIN_CANVAS, height: MIN_CANVAS, minX: 0, minY: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const it of items) {
    minX = Math.min(minX, it.x);
    minY = Math.min(minY, it.y);
    maxX = Math.max(maxX, it.x + Math.max(0, it.w));
    maxY = Math.max(maxY, it.y + Math.max(0, it.h));
  }
  return {
    minX: minX - padding,
    minY: minY - padding,
    width: Math.max(MIN_CANVAS, maxX - minX + padding * 2),
    height: Math.max(MIN_CANVAS, maxY - minY + padding * 2),
  };
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]!));
}

/** board_items → SVG 字符串（矢量图片，本身即合法导出格式，浏览器/编辑器可直接打开）。 */
export function renderBoardToSvg(items: ExportItem[], opts: ExportOptions = {}): string {
  const padding = opts.padding ?? DEFAULT_PADDING;
  const b = computeBounds(items, padding);
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${b.width}" height="${b.height}" viewBox="0 0 ${b.width} ${b.height}">`);
  parts.push(`<rect width="${b.width}" height="${b.height}" fill="#ffffff"/>`);
  if (opts.title) {
    parts.push(`<text x="${padding}" y="${padding}" font-family="sans-serif" font-size="16" font-weight="bold" fill="#111111">${escapeXml(opts.title)}</text>`);
  }
  for (const it of items) {
    const x = it.x - b.minX, y = it.y - b.minY;
    const fill = normColor(it.color, "#e5e7eb");
    if (it.type === "line" || it.type === "connector") {
      parts.push(`<line x1="${x}" y1="${y}" x2="${x + it.w}" y2="${y + it.h}" stroke="${normColor(it.color, "#111111")}" stroke-width="2"/>`);
    } else if (it.type === "ellipse" || it.type === "circle") {
      parts.push(`<ellipse cx="${x + it.w / 2}" cy="${y + it.h / 2}" rx="${Math.max(1, it.w / 2)}" ry="${Math.max(1, it.h / 2)}" fill="${fill}" stroke="#111111"/>`);
    } else {
      // rect / sticky / text / 未知类型统一按矩形块渲染（不丢内容）
      parts.push(`<rect x="${x}" y="${y}" width="${Math.max(1, it.w)}" height="${Math.max(1, it.h)}" fill="${fill}" stroke="#111111" rx="4"/>`);
    }
    if (it.text) {
      parts.push(`<text x="${x + 6}" y="${y + 18}" font-family="sans-serif" font-size="13" fill="#111111">${escapeXml(String(it.text).slice(0, 120))}</text>`);
    }
  }
  parts.push(`</svg>`);
  return parts.join("\n");
}

/** board_items → PDF（pdf-lib，纯 JS）。返回 Uint8Array，永远非空（空板也出一页）。 */
export async function renderBoardToPdf(items: ExportItem[], opts: ExportOptions = {}): Promise<Uint8Array> {
  const padding = opts.padding ?? DEFAULT_PADDING;
  const b = computeBounds(items, padding);
  const doc = await PDFDocument.create();
  const page = doc.addPage([b.width, b.height]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  // PDF 原点在左下，画布在左上——y 翻转
  const flipY = (yTop: number, h: number): number => b.height - yTop - h;

  page.drawRectangle({ x: 0, y: 0, width: b.width, height: b.height, color: rgb(1, 1, 1) });
  if (opts.title) {
    page.drawText(opts.title.slice(0, 80), { x: padding, y: b.height - padding - 12, size: 14, font: bold, color: rgb(0.07, 0.07, 0.07) });
  }
  for (const it of items) {
    const x = it.x - b.minX, yTop = it.y - b.minY;
    const w = Math.max(1, it.w), h = Math.max(1, it.h);
    const c = hexToRgb01(normColor(it.color, "#e5e7eb"));
    if (it.type === "line" || it.type === "connector") {
      page.drawLine({ start: { x, y: flipY(yTop, 0) }, end: { x: x + it.w, y: flipY(yTop + it.h, 0) }, thickness: 2, color: rgb(0.07, 0.07, 0.07) });
    } else {
      page.drawRectangle({ x, y: flipY(yTop, h), width: w, height: h, color: rgb(c.r, c.g, c.b), borderColor: rgb(0.07, 0.07, 0.07), borderWidth: 1 });
    }
    if (it.text) {
      page.drawText(String(it.text).slice(0, 80), { x: x + 6, y: flipY(yTop, 0) - 16, size: 11, font, color: rgb(0.07, 0.07, 0.07) });
    }
  }
  return doc.save();
}

export type ExportFormat = "pdf" | "svg";

export interface RenderedExport {
  body: Uint8Array;
  contentType: string;
  extension: string;
}

/** 统一入口：按格式渲染，返回二进制 + content-type（供端点直接回响应）。 */
export async function renderBoard(items: ExportItem[], format: ExportFormat, opts: ExportOptions = {}): Promise<RenderedExport> {
  if (format === "svg") {
    return { body: new TextEncoder().encode(renderBoardToSvg(items, opts)), contentType: "image/svg+xml", extension: "svg" };
  }
  return { body: await renderBoardToPdf(items, opts), contentType: "application/pdf", extension: "pdf" };
}
