import { test, expect } from "@playwright/test";

// p20-F10：legacy 单画布下线后，本 spec 迁移到 board 模型
// （画布页 /boards/[id]：选中后 Delete 删除；DELETE 走 /api/board-items/[itemId]）。
const uniq = () => `cd_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

const items = (page: any) => page.getByTestId("items-layer").locator('[data-testid^="item-"]');

test("删除 item：板上消失且列表不含", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "C" } })).json()).board;
  const item = (await (await page.request.post(`/api/boards/${board.id}/items`, {
    data: { type: "note", x: 10, y: 10, text: "del me" },
  })).json()).item;

  await page.goto(`/boards/${board.id}`);
  await expect(page.getByTestId(`item-${item.id}`)).toBeVisible();
  // 选中后 Delete 删除
  await page.getByTestId(`item-${item.id}`).click();
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
  await page.keyboard.press("Delete");
  await expect(items(page)).toHaveCount(0);

  // 列表不含
  await expect
    .poll(async () => (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items.length)
    .toBe(0);
});

test("非 board 成员删除 item → 403", async ({ page, playwright }) => {
  const owner = await playwright.request.newContext({ baseURL: BASE_URL });
  await owner.post("/api/auth/register", {
    data: { firstName: "O", lastName: "O", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await owner.post("/api/rooms", { data: { name: "P", visibility: "private" } })).json()).room;
  const board = (await (await owner.post(`/api/rooms/${room.id}/boards`, { data: { name: "C" } })).json()).board;
  const item = (await (await owner.post(`/api/boards/${board.id}/items`, { data: { type: "note", x: 1, y: 1 } })).json()).item;

  await page.request.post("/api/auth/register", {
    data: { firstName: "X", lastName: "X", email: uniq(), password: "secret123", agreeTerms: true },
  });
  expect((await page.request.delete(`/api/board-items/${item.id}`)).status()).toBe(403);
  await owner.dispose();
});
