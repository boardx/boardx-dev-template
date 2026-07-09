import { test, expect, type APIRequestContext } from "@playwright/test";

const uniq = () => `bo_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

async function newUser(playwright: any): Promise<APIRequestContext> {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email: uniq(), password: "secret123", agreeTerms: true },
  });
  return ctx;
}

test("属主打开白板：标题 + owner 角色 + 画布/缩放占位 + 编辑入口可见", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Open Me" } })).json()).board;

  await page.goto(`/boards/${board.id}`);
  await expect(page.getByTestId("board-title")).toHaveText("Open Me");
  await expect(page.getByTestId("board-role")).toHaveText("owner");
  await expect(page.getByTestId("canvas-viewport")).toBeVisible();
  await expect(page.getByTestId("zoom-control")).toBeVisible();
  await expect(page.getByTestId("board-bottom-dock")).toBeVisible();
});

test("非房间成员打开白板 → API 403", async ({ playwright }) => {
  const owner = await newUser(playwright);
  const room = (await (await owner.post("/api/rooms", { data: { name: "Secret", visibility: "private" } })).json()).room;
  const board = (await (await owner.post(`/api/rooms/${room.id}/boards`, { data: { name: "Private" } })).json()).board;

  const outsider = await newUser(playwright);
  const res = await outsider.get(`/api/boards/${board.id}`);
  expect(res.status()).toBe(403);

  await owner.dispose();
  await outsider.dispose();
});

test("打开不存在的白板 → 404", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const res = await page.request.get("/api/boards/99999999");
  expect(res.status()).toBe(404);
});
