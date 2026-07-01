import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

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

// 添加 n 个便签，返回按 DOM 顺序排列的 item testid 列表（后添加的靠后 = 上层）。
async function addNotes(page: Page, n: number) {
  const items = page.getByTestId("items-layer").locator('[data-testid^="item-"]');
  for (let i = 0; i < n; i++) {
    await page.getByTestId("add-note").click();
    await expect(items).toHaveCount(i + 1);
  }
}

// 读取当前 DOM 顺序的 item id（去掉 item- 前缀），顺序即 z-order（末尾在最上层）。
async function orderIds(page: Page): Promise<string[]> {
  const handles = await page.getByTestId("items-layer").locator('[data-testid^="item-"]').all();
  const ids: string[] = [];
  for (const h of handles) {
    const tid = await h.getAttribute("data-testid");
    ids.push((tid ?? "").replace("item-", ""));
  }
  return ids;
}

test("上下文菜单含四个图层顺序入口（置顶/上移/下移/置底）", async ({ page }) => {
  await openOwnBoard(page);
  await addNotes(page, 1);
  await page.getByTestId("items-layer").locator('[data-testid^="item-"]').first().click({ button: "right" });
  await expect(page.getByTestId("context-menu")).toBeVisible();
  await expect(page.getByTestId("ctx-bring-front")).toBeVisible();
  await expect(page.getByTestId("ctx-bring-forward")).toBeVisible();
  await expect(page.getByTestId("ctx-send-backward")).toBeVisible();
  await expect(page.getByTestId("ctx-send-back")).toBeVisible();
});

test("置于底层 → 选中对象移到 DOM 最前（最底层）", async ({ page }) => {
  await openOwnBoard(page);
  await addNotes(page, 3);
  const before = await orderIds(page);
  // 用左上角首个便签（不与左下角小地图/引导浮层重叠，右键稳定）。
  const a = before[0]!;
  // 先置顶，使 a 处于最上层
  await page.getByTestId(`item-${a}`).click({ button: "right" });
  await page.getByTestId("ctx-bring-front").click();
  expect((await orderIds(page)).at(-1)).toBe(a);
  // 再置于底层 → a 回到数组最前（最底层）
  await page.getByTestId(`item-${a}`).click({ button: "right" });
  await page.getByTestId("ctx-send-back").click();
  const after = await orderIds(page);
  expect(after[0]).toBe(a); // 现在排在数组最前 = 最底层
  expect(after).toHaveLength(3);
  // 保留选中态
  await expect(page.getByTestId(`item-${a}`)).toHaveAttribute("data-selected", "true");
});

test("置于顶层 → 选中对象移到 DOM 最后（最上层）", async ({ page }) => {
  await openOwnBoard(page);
  await addNotes(page, 3);
  const before = await orderIds(page);
  const bottom = before[0]!; // 最先添加的，当前在最底层
  await page.getByTestId(`item-${bottom}`).click({ button: "right" });
  await page.getByTestId("ctx-bring-front").click();
  const after = await orderIds(page);
  expect(after[after.length - 1]).toBe(bottom); // 现在排在数组最后 = 最上层
  await expect(page.getByTestId(`item-${bottom}`)).toHaveAttribute("data-selected", "true");
});

test("上移一层 / 下移一层 → 相邻交换，保留其它顺序", async ({ page }) => {
  await openOwnBoard(page);
  await addNotes(page, 3);
  const start = await orderIds(page); // [a, b, c]，c 在最上层
  const a = start[0]!;
  const b = start[1]!;
  const c = start[2]!;

  // 上移 a 一层 → [b, a, c]
  await page.getByTestId(`item-${a}`).click({ button: "right" });
  await page.getByTestId("ctx-bring-forward").click();
  expect(await orderIds(page)).toEqual([b, a, c]);

  // 下移 a 一层 → 回到 [a, b, c]
  await page.getByTestId(`item-${a}`).click({ button: "right" });
  await page.getByTestId("ctx-send-backward").click();
  expect(await orderIds(page)).toEqual([a, b, c]);
});

test("z-index 样式随图层顺序更新（遮挡关系可见）", async ({ page }) => {
  await openOwnBoard(page);
  await addNotes(page, 2);
  const ids = await orderIds(page);
  const lower = ids[0]!;
  const higher = ids[1]!;
  // 初始：higher 的 z-index 应大于 lower
  const zLower0 = await page.getByTestId(`item-${lower}`).evaluate((el) => (el as HTMLElement).style.zIndex);
  const zHigher0 = await page.getByTestId(`item-${higher}`).evaluate((el) => (el as HTMLElement).style.zIndex);
  expect(Number(zHigher0)).toBeGreaterThan(Number(zLower0));

  // 把 lower 置于顶层 → 它的 z-index 变为最大
  await page.getByTestId(`item-${lower}`).click({ button: "right" });
  await page.getByTestId("ctx-bring-front").click();
  const zLower1 = await page.getByTestId(`item-${lower}`).evaluate((el) => (el as HTMLElement).style.zIndex);
  const zHigher1 = await page.getByTestId(`item-${higher}`).evaluate((el) => (el as HTMLElement).style.zIndex);
  expect(Number(zLower1)).toBeGreaterThan(Number(zHigher1));
});
