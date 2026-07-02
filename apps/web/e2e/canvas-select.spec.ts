import { test, expect, type APIRequestContext } from "@playwright/test";

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
  await expect(page.getByTestId("items-layer").locator('[data-testid^="item-"]')).toHaveCount(1);
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
});

test("点选 / Shift 多选 / 点空白清除 / Esc 清除", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await page.getByTestId("add-note").click();
  const items = page.getByTestId("items-layer").locator('[data-testid^="item-"]');
  await expect(items).toHaveCount(2);

  // 画布表面有 CSS transform，Playwright 命中测试会误判可点击性；用 force 直点真实元素，
  // 断言仍由 selection-count 验证真实行为。
  await items.nth(0).click({ force: true });
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
  await items.nth(1).click({ modifiers: ["Shift"], force: true });
  await expect(page.getByTestId("selection-count")).toHaveText("已选 2");

  await page.getByTestId("items-layer").click({ position: { x: 5, y: 5 }, force: true });
  await expect(page.getByTestId("selection-count")).toHaveText("已选 0");

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("selection-count")).toHaveText("已选 0");
});

test("Ctrl/Cmd+A 全选 + Delete 删除选中", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await page.getByTestId("add-note").click();
  const items = page.getByTestId("items-layer").locator('[data-testid^="item-"]');
  await expect(items).toHaveCount(2);

  await page.keyboard.press("ControlOrMeta+a");
  await expect(page.getByTestId("selection-count")).toHaveText("已选 2");

  await page.keyboard.press("Delete");
  await expect(items).toHaveCount(0);
  // 刷新后确认已落库删除
  await page.reload();
  await expect(page.getByTestId("items-layer").locator('[data-testid^="item-"]')).toHaveCount(0);
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
