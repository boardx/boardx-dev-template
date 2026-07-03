import { test, expect } from "@playwright/test";

// p20-F10：legacy 单画布下线后，本 spec 迁移到 board 模型
// （先 POST /api/rooms/[id]/boards 建板 → 画布页 /boards/[id] + /api/boards/[id]/items）。
const uniq = () => `ca_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

const items = (page: any) => page.getByTestId("items-layer").locator('[data-testid^="item-"]');

test("添加便签后出现在板上且刷新仍在", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "C" } })).json()).board;

  await page.goto(`/boards/${board.id}`);
  await expect(items(page)).toHaveCount(0);
  await page.getByTestId("add-note").click();
  await expect(items(page)).toHaveCount(1);

  // 刷新仍在（持久化）
  await page.reload();
  await expect(items(page)).toHaveCount(1);
});

test("非 board 成员添加 item → 403", async ({ page, playwright }) => {
  const owner = await playwright.request.newContext({ baseURL: BASE_URL });
  await owner.post("/api/auth/register", {
    data: { firstName: "O", lastName: "O", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await owner.post("/api/rooms", { data: { name: "Priv", visibility: "private" } })).json()).room;
  const board = (await (await owner.post(`/api/rooms/${room.id}/boards`, { data: { name: "C" } })).json()).board;

  await page.request.post("/api/auth/register", {
    data: { firstName: "X", lastName: "X", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const res = await page.request.post(`/api/boards/${board.id}/items`, { data: { type: "note", x: 1, y: 1 } });
  expect(res.status()).toBe(403);
  await owner.dispose();
});
