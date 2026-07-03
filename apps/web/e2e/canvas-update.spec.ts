import { test, expect } from "@playwright/test";

// p20-F10：legacy 单画布下线后，本 spec 迁移到 board 模型
// （PATCH 走 /api/board-items/[itemId]，列表走 /api/boards/[id]/items）。
const uniq = () => `cu_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

test("移动 + 编辑 item 并持久化", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "C" } })).json()).board;
  const item = (await (await page.request.post(`/api/boards/${board.id}/items`, {
    data: { type: "note", x: 10, y: 10, text: "old" },
  })).json()).item;

  // 移动 + 编辑（命令）
  expect((await page.request.patch(`/api/board-items/${item.id}`, { data: { x: 99, y: 88 } })).status()).toBe(200);
  expect((await page.request.patch(`/api/board-items/${item.id}`, { data: { text: "new-text" } })).status()).toBe(200);

  // GET 校验持久化
  const items = (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items;
  expect(items[0]).toMatchObject({ x: 99, y: 88, text: "new-text" });

  // 板上渲染更新后的文字
  await page.goto(`/boards/${board.id}`);
  await expect(page.getByTestId(`item-${item.id}`)).toContainText("new-text");
});

test("非 board 成员更新 item → 403", async ({ page, playwright }) => {
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
  expect((await page.request.patch(`/api/board-items/${item.id}`, { data: { text: "hack" } })).status()).toBe(403);
  await owner.dispose();
});
