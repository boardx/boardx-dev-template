// e2e helpers/canvas.ts — 画布 e2e 的 canvas 兼容锚点（p6:F13，策略 2 / issue #269）。
// 渲染引擎切到 fabric.Canvas 后，item 不再是 DOM 元素；测试经 window.__canvasTestApi
// （仅非生产环境暴露）读取渲染层状态，并把 item 的画布坐标换算成屏幕坐标来驱动
// 真实的鼠标点击/拖拽。断言意图与 DOM 时代逐条对应（可见性→getItems、选中→getSelectedIds、
// 位置→x/y、点击→getItemScreenRect + page.mouse）。
import { expect, type Page } from "@playwright/test";

export interface CanvasItem {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color: string | null;
  kind: "note" | "text" | "shape" | "embed" | "connector" | "draw" | "chart";
  bold: boolean;
  italic: boolean;
  fontFamily: string;
  fontSize: number;
  align: "left" | "center" | "right";
  border: "none" | "gray" | "blue" | "red";
  borderWidth: number;
  opacity: number;
  textColor: "default" | "slate" | "blue" | "green" | "red";
  // p6:F15（uc-widgets-004）：具体形状种类，仅 kind === "shape" 时有意义。
  shapeType: "rect" | "rounded" | "circle" | "triangle" | "diamond" | "hexagon";
  reloadable: boolean;
  reloadCount: number;
  refreshedAt: number | null;
  locked: boolean;
  z: number;
}

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// 等待渲染引擎就绪（fabric 动态 import 完成、测试 API 挂载）。
export async function waitForCanvasReady(page: Page): Promise<void> {
  await expect
    .poll(async () => page.evaluate(() => window.__canvasTestApi?.engine ?? null), { timeout: 15_000 })
    .toBe("fabric");
}

// 读取渲染层 items（z 即绘制顺序，数组末尾在最上层）。
export function canvasItems(page: Page): Promise<CanvasItem[]> {
  return page.evaluate(() => window.__canvasTestApi!.getItems());
}

// 断言画布 item 数（旧锚点：items-layer 内 [data-testid^="item-"] 计数）。
export async function expectItemCount(page: Page, n: number): Promise<void> {
  await waitForCanvasReady(page);
  await expect.poll(async () => (await canvasItems(page)).length, { timeout: 10_000 }).toBe(n);
}

export function selectedIds(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__canvasTestApi!.getSelectedIds());
}

// 等待指定 item 出现在渲染层并返回它（issue #333：DOM 时代 expect(item-<id>).toBeVisible()
// 自带 auto-wait；迁移到 canvasItems() 一次性读取后丢失了重试语义——引擎就绪(waitForCanvasReady)
// 与首次 items 拉取完成之间存在窗口，预置 item 在该窗口内还没进渲染层，导致间歇失败）。
export async function waitForItem(page: Page, id: string): Promise<CanvasItem> {
  await waitForCanvasReady(page);
  await expect
    .poll(async () => (await canvasItems(page)).some((it) => it.id === id), {
      timeout: 10_000,
      message: `item ${id} 不在渲染层`,
    })
    .toBe(true);
  return (await canvasItems(page)).find((it) => it.id === id)!;
}

export async function itemScreenRect(page: Page, id: string): Promise<ScreenRect> {
  // 同上（issue #333）：对齐 locator.click() 的 actionability auto-wait——先等 item 进渲染层。
  await waitForItem(page, id);
  const rect = await page.evaluate((itemId) => window.__canvasTestApi!.getItemScreenRect(itemId), id);
  expect(rect, `item ${id} 不在渲染层`).not.toBeNull();
  return rect!;
}

// p6:F16：连接线当前实际渲染的端点画布坐标（跟随源/目标组件移动后的最新值）。
export function connectorEndpoints(
  page: Page,
  id: string,
): Promise<{ from: { x: number; y: number }; to: { x: number; y: number } } | null> {
  return page.evaluate((itemId) => window.__canvasTestApi!.getConnectorEndpoints(itemId), id);
}

// 点击 item 中心（旧锚点：item-<id> div 的 click）。支持 Shift 多选与右键。
export async function clickItem(
  page: Page,
  id: string,
  opts: { shift?: boolean; button?: "left" | "right" } = {},
): Promise<void> {
  const r = await itemScreenRect(page, id);
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  if (opts.shift) await page.keyboard.down("Shift");
  await page.mouse.click(cx, cy, { button: opts.button ?? "left" });
  if (opts.shift) await page.keyboard.up("Shift");
}

// 双击 item 中心（旧锚点：item-<id> 的 dblclick → 编辑框）。
export async function dblclickItem(page: Page, id: string): Promise<void> {
  const r = await itemScreenRect(page, id);
  await page.mouse.dblclick(r.x + r.width / 2, r.y + r.height / 2);
}

// 点击画布真实空白处（旧锚点：items-layer 空白 click → 清除选择）。
// 空白点由渲染层根据当前 viewport + items 命中测试计算，避免硬编码某个角落恒空。
export async function clickCanvasBlank(page: Page): Promise<void> {
  await waitForCanvasReady(page);
  const p = await page.evaluate(() => window.__canvasTestApi!.getCanvasBlankScreenPoint());
  expect(p, "canvas blank point").not.toBeNull();
  await page.mouse.click(p!.x, p!.y);
}
