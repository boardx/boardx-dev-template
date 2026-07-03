import { test, expect, type APIRequestContext } from "@playwright/test";
import { canvasItems, clickCanvasBlank, clickItem, expectItemCount } from "./helpers/canvas";

// p6:F13 渲染引擎切 fabric 后，item 锚点迁为 canvas 兼容锚点（策略 2 / issue #269）：
// item 计数 → __canvasTestApi.getItems()；点选/多选 → getItemScreenRect + 真实鼠标点击。
// 断言意图逐条保留：出现并自动选中 / 点选 / Shift 多选 / 空白清除 / 全选删除 / 方向键移动持久化。
const uniq = () => `csl_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

async function newUser(playwright: any): Promise<{ ctx: APIRequestContext; userId: number }> {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  const reg = await (await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email: uniq(), password: "secret123", agreeTerms: true },
  })).json();
  return { ctx, userId: reg.user.id };
}

async function openOwnBoard(page: any) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "C" } })).json()).board;
  await page.goto(`/boards/${board.id}`);
  return board;
}

test("加便签 → 出现并自动选中（board-keyed item）", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await expectItemCount(page, 1);
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
});

test("点选 / Shift 多选 / 点空白清除 / Esc 清除", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await page.getByTestId("add-note").click();
  await expectItemCount(page, 2);
  const items = await canvasItems(page);

  // 直接对 <canvas> 上的 item 屏幕位置做真实点击；断言仍由 selection-count 验证行为。
  await clickItem(page, items[0]!.id);
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
  await clickItem(page, items[1]!.id, { shift: true });
  await expect(page.getByTestId("selection-count")).toHaveText("已选 2");

  await clickCanvasBlank(page);
  await expect(page.getByTestId("selection-count")).toHaveText("已选 0");

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("selection-count")).toHaveText("已选 0");
});

test("Ctrl/Cmd+A 全选 + Delete 删除选中", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await page.getByTestId("add-note").click();
  await expectItemCount(page, 2);

  await page.keyboard.press("ControlOrMeta+a");
  await expect(page.getByTestId("selection-count")).toHaveText("已选 2");

  await page.keyboard.press("Delete");
  await expectItemCount(page, 0);
  // 刷新后确认已落库删除
  await page.reload();
  await expectItemCount(page, 0);
});

test("方向键移动选中 item 并持久化", async ({ page }) => {
  const board = await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
  const before = (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items[0];
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => {
    const it = (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items[0];
    return it.x;
  }).toBeGreaterThan(before.x);
});

test("viewer 无编辑工具栏；POST item → 403", async ({ page, playwright }) => {
  const owner = await newUser(playwright);
  const room = (await (await owner.ctx.post("/api/rooms", { data: { name: "R", visibility: "private" } })).json()).room;
  const board = (await (await owner.ctx.post(`/api/rooms/${room.id}/boards`, { data: { name: "C" } })).json()).board;
  await owner.ctx.patch(`/api/boards/${board.id}/visibility`, { data: { visibility: "public" } });

  // page 注册非成员（public → viewer）
  await page.request.post("/api/auth/register", {
    data: { firstName: "V", lastName: "V", email: uniq(), password: "secret123", agreeTerms: true },
  });
  expect((await page.request.post(`/api/boards/${board.id}/items`, { data: { type: "note", x: 1, y: 1 } })).status()).toBe(403);
  await page.goto(`/boards/${board.id}`);
  await expect(page.getByTestId("board-role")).toHaveText("viewer");
  await expect(page.getByTestId("add-note")).toHaveCount(0);

  await owner.ctx.dispose();
});
