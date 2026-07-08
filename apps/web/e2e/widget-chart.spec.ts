import { test, expect } from "@playwright/test";
import { canvasItems, clickCanvasBlank, clickItem, expectItemCount, waitForCanvasReady } from "./helpers/canvas";

// p6:F18：图表组件（uc-widgets-008 + uc-board-menu-007）
// - 创建：按 "C" 进入图表模式（Board Menu 无图表按钮，业务规则 4/UC-007），点击画布在点击处
//   创建柱状图组件（默认示例数据），创建后自动选中并回到选择工具。
// - 持久化：type:"note" 落库（服务端白名单只放行 note/rect，不可改），color 哨兵
//   "chart|kind=bar"，text 字段存数据 JSON（{"labels":[...],"values":[...]}）。刷新后仍在。
// - 渲染：fabric.Rect 组合柱状图 + 标签，不引入图表库；数据无效时渲染失败反馈占位
//   （UC 异常流程 1），组件保持可识别/可选中。
// - 编辑：选中后 Widget Menu「编辑数据」（wm-chart-data）打开既有 textarea 编辑 text JSON，
//   保存后按新数据重渲染。
// - 菜单边界：图表无文字/色板/边框语义，相应入口隐藏（业务规则 1：不支持的操作隐藏）。

const uniq = () => `wchart_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function openOwnBoard(page: import("@playwright/test").Page) {
  await page.addInitScript(() => window.localStorage.setItem("board_welcome_dismissed", "1"));
  await page.request.post("/api/auth/register", {
    data: { firstName: "C", lastName: "H", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (
    await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Chart" } })).json()
  ).board;
  await page.goto(`/boards/${board.id}`);
  await waitForCanvasReady(page);
  return board;
}

// C 键进入图表模式 → 点击画布创建图表，返回落库后的图表 item。
async function createChart(page: import("@playwright/test").Page) {
  await page.keyboard.press("c");
  const box = await page.getByTestId("canvas-viewport").boundingBox();
  await page.mouse.click(box!.x + 350, box!.y + 220);
  await expect
    .poll(async () => (await canvasItems(page)).filter((it) => it.kind === "chart").length, { timeout: 10_000 })
    .toBeGreaterThan(0);
  // 创建后回到选择工具（一次一个图表的创建节奏）。
  await expect(page.getByTestId("board-tool-select")).toHaveAttribute("aria-pressed", "true");
  return (await canvasItems(page)).filter((it) => it.kind === "chart").at(-1)!;
}

test("C 键图表模式点击画布 → 创建柱状图组件（默认数据），落库 note + chart 哨兵，刷新后仍在", async ({
  page,
}) => {
  const board = await openOwnBoard(page);
  const chart = await createChart(page);

  expect(chart.kind).toBe("chart");
  expect(chart.color).toContain("chart");
  expect(chart.color).toContain("kind=bar");
  // 默认示例数据（labels/values 等长）。
  const data = JSON.parse(chart.text) as { labels: string[]; values: number[] };
  expect(data.labels.length).toBe(data.values.length);
  expect(data.values.length).toBeGreaterThan(0);

  // 服务端持久化：type 仍为 note，color 携带完整哨兵。
  const body = await (await page.request.get(`/api/boards/${board.id}/items`)).json();
  const persisted = body.items.find((it: { id: string }) => it.id === chart.id);
  expect(persisted.type).toBe("note");
  expect(String(persisted.color)).toContain("chart");

  // 刷新后图表仍在。
  await page.reload();
  await expectItemCount(page, 1);
  expect((await canvasItems(page))[0]!.kind).toBe("chart");
});

test("选中图表 → Widget Menu 展示「编辑数据」入口，编辑数据 JSON 后按新数据重渲染并持久化", async ({
  page,
}) => {
  const board = await openOwnBoard(page);
  const chart = await createChart(page);

  await clickItem(page, chart.id);
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
  await expect(page.getByTestId("wm-chart-data")).toBeVisible();
  // 图表无文字/色板/边框语义，相应入口隐藏（业务规则 1）。
  await expect(page.getByTestId("wm-color-amber")).toHaveCount(0);
  await expect(page.getByTestId("wm-bold")).toHaveCount(0);
  await expect(page.getByTestId("wm-border")).toHaveCount(0);
  await expect(page.getByTestId("wm-font")).toHaveCount(0);

  // 编辑数据：打开 textarea（复用既有编辑覆盖层），改写数据 JSON 后保存。
  await page.getByTestId("wm-chart-data").click();
  const editor = page.getByTestId(`item-edit-${chart.id}`);
  await expect(editor).toBeVisible();
  const next = JSON.stringify({ labels: ["Q1", "Q2"], values: [7, 2] });
  await editor.fill(next);
  await editor.blur();

  // 重渲染（text 变化触发 fabric 对象重建）+ 持久化。
  await expect
    .poll(async () => (await canvasItems(page)).find((it) => it.id === chart.id)!.text)
    .toBe(next);
  await expect
    .poll(async () => {
      const body = await (await page.request.get(`/api/boards/${board.id}/items`)).json();
      return body.items.find((it: { id: string }) => it.id === chart.id).text as string;
    })
    .toBe(next);

  // 刷新后新数据仍在。
  await page.reload();
  await expectItemCount(page, 1);
  expect((await canvasItems(page))[0]!.text).toBe(next);
});

test("图表可选中/移动/锁定/删除；数据无效时保留可识别的失败占位（异常流程 1）", async ({ page }) => {
  await openOwnBoard(page);
  const chart = await createChart(page);

  // 移动。
  await clickItem(page, chart.id);
  const rect = await page.evaluate((id) => window.__canvasTestApi!.getItemScreenRect(id), chart.id);
  const cx = rect!.x + rect!.width / 2;
  const cy = rect!.y + rect!.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 90, cy + 50, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(async () => (await canvasItems(page)).find((it) => it.id === chart.id)!.x)
    .not.toBe(chart.x);

  // 锁定：锁定后编辑/删除入口收敛为解锁 + 置灰删除（uc-widget-menu-003 语义）。
  await clickItem(page, chart.id);
  await page.getByTestId("wm-lock").click();
  await expect
    .poll(async () => (await canvasItems(page)).find((it) => it.id === chart.id)!.locked)
    .toBe(true);
  await clickCanvasBlank(page);
  await clickItem(page, chart.id);
  await expect(page.getByTestId("wm-unlock")).toBeVisible();
  await expect(page.getByTestId("wm-chart-data")).toHaveCount(0);
  await page.getByTestId("wm-unlock").click();
  await expect
    .poll(async () => (await canvasItems(page)).find((it) => it.id === chart.id)!.locked)
    .toBe(false);

  // 数据无效：写入非法 JSON，组件保持可识别/可选中（渲染失败反馈由 fabric 层画占位文字，
  // 这里断言组件仍在渲染层且 chart 判别不变——不因坏数据丢组件）。
  await page.request.patch(`/api/board-items/${chart.id}`, { data: { text: "not-json{{" } });
  await page.reload();
  await expectItemCount(page, 1);
  const broken = (await canvasItems(page))[0]!;
  expect(broken.kind).toBe("chart");
  await clickItem(page, broken.id);
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");

  // 删除。
  await page.getByTestId("wm-delete").click();
  await expectItemCount(page, 0);
});
