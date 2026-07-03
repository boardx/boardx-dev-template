import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { canvasItems, clickItem, expectItemCount, selectedIds } from "./helpers/canvas";

// p6:F13：item 锚点迁为 canvas 兼容锚点（策略 2 / issue #269）。
// z-order 语义不变：items 数组顺序即绘制顺序（fabric 对象栈序 = 旧 DOM 顺序/z-index），
// 旧「DOM 顺序 / style.zIndex」断言迁为渲染层 getItems() 的数组顺序（z 字段）；
// 右键 → getItemScreenRect + 真实鼠标右键；选中态 → getSelectedIds。断言意图逐条保留。
const uniq = () => `arr_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function openOwnBoard(page: Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "R", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Arr" } })).json())
    .board;
  // 预置「欢迎引导已关闭」标记，避免左下角引导浮层拦截对象右键点击。
  await page.addInitScript(() => window.localStorage.setItem("board_welcome_dismissed", "1"));
  await page.goto(`/boards/${board.id}`);
  return board;
}

// 添加 n 个便签（后添加的排在渲染层数组末尾 = 上层）。
async function addNotes(page: Page, n: number) {
  for (let i = 0; i < n; i++) {
    await page.getByTestId("add-note").click();
    await expectItemCount(page, i + 1);
  }
}

// 读取当前绘制顺序的 item id（数组末尾在最上层）。
async function orderIds(page: Page): Promise<string[]> {
  return (await canvasItems(page)).map((it) => it.id);
}

test("上下文菜单含四个图层顺序入口（置顶/上移/下移/置底）", async ({ page }) => {
  await openOwnBoard(page);
  await addNotes(page, 1);
  await clickItem(page, (await orderIds(page))[0]!, { button: "right" });
  await expect(page.getByTestId("context-menu")).toBeVisible();
  await expect(page.getByTestId("ctx-bring-front")).toBeVisible();
  await expect(page.getByTestId("ctx-bring-forward")).toBeVisible();
  await expect(page.getByTestId("ctx-send-backward")).toBeVisible();
  await expect(page.getByTestId("ctx-send-back")).toBeVisible();
});

test("置于底层 → 选中对象移到绘制顺序最前（最底层）", async ({ page }) => {
  await openOwnBoard(page);
  await addNotes(page, 3);
  const before = await orderIds(page);
  // 用左上角首个便签（不与左下角小地图/引导浮层重叠，右键稳定）。
  const a = before[0]!;
  // 先置顶，使 a 处于最上层
  await clickItem(page, a, { button: "right" });
  await page.getByTestId("ctx-bring-front").click();
  await expect.poll(async () => (await orderIds(page)).at(-1)).toBe(a);
  // 再置于底层 → a 回到数组最前（最底层）
  await clickItem(page, a, { button: "right" });
  await page.getByTestId("ctx-send-back").click();
  await expect.poll(async () => (await orderIds(page))[0]).toBe(a);
  expect(await orderIds(page)).toHaveLength(3);
  // 保留选中态
  expect(await selectedIds(page)).toContain(a);
});

test("置于顶层 → 选中对象移到绘制顺序最后（最上层）", async ({ page }) => {
  await openOwnBoard(page);
  await addNotes(page, 3);
  const before = await orderIds(page);
  const bottom = before[0]!; // 最先添加的，当前在最底层
  await clickItem(page, bottom, { button: "right" });
  await page.getByTestId("ctx-bring-front").click();
  await expect.poll(async () => (await orderIds(page)).at(-1)).toBe(bottom);
  expect(await selectedIds(page)).toContain(bottom);
});

test("上移一层 / 下移一层 → 相邻交换，保留其它顺序", async ({ page }) => {
  await openOwnBoard(page);
  await addNotes(page, 3);
  const start = await orderIds(page); // [a, b, c]，c 在最上层
  const a = start[0]!;
  const b = start[1]!;
  const c = start[2]!;

  // 上移 a 一层 → [b, a, c]
  await clickItem(page, a, { button: "right" });
  await page.getByTestId("ctx-bring-forward").click();
  await expect.poll(async () => orderIds(page)).toEqual([b, a, c]);

  // 下移 a 一层 → 回到 [a, b, c]
  await clickItem(page, a, { button: "right" });
  await page.getByTestId("ctx-send-backward").click();
  await expect.poll(async () => orderIds(page)).toEqual([a, b, c]);
});

test("渲染层叠放顺序随图层操作更新（遮挡关系可见）", async ({ page }) => {
  await openOwnBoard(page);
  await addNotes(page, 2);
  const ids = await orderIds(page);
  const lower = ids[0]!;
  const higher = ids[1]!;
  // 初始：higher 的 z 应大于 lower（后绘制覆盖先绘制）
  const items0 = await canvasItems(page);
  expect(items0.find((it) => it.id === higher)!.z).toBeGreaterThan(items0.find((it) => it.id === lower)!.z);

  // 把 lower 置于顶层 → 它的 z 变为最大
  await clickItem(page, lower, { button: "right" });
  await page.getByTestId("ctx-bring-front").click();
  await expect
    .poll(async () => {
      const items1 = await canvasItems(page);
      return items1.find((it) => it.id === lower)!.z - items1.find((it) => it.id === higher)!.z;
    })
    .toBeGreaterThan(0);
});
