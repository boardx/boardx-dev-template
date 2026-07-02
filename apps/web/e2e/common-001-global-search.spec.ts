import { test, expect, type APIRequestContext } from "@playwright/test";

const uniq = () => `gs_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

async function newCtx(playwright: any): Promise<APIRequestContext> {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email: uniq(), password: "secret123", agreeTerms: true },
  });
  return ctx;
}

test("API：按关键词跨 rooms/boards/teams 聚合，且只含有权限资源", async ({ page }) => {
  await register(page);
  // 自建资源：room + board + team，名称统一带 Zeta 前缀方便检索。
  const tag = `Zeta${Math.floor(Math.random() * 1e6)}`;
  const room = (await (await page.request.post("/api/rooms", { data: { name: `${tag} Room` } })).json()).room;
  await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: `${tag} Board` } });
  await page.request.post("/api/teams", { data: { name: `${tag} Team` } });

  const data = await (await page.request.get(`/api/search?q=${tag}`)).json();
  expect(data.rooms.some((r: { name: string }) => r.name === `${tag} Room`)).toBe(true);
  expect(data.boards.some((b: { name: string }) => b.name === `${tag} Board`)).toBe(true);
  expect(data.teams.some((t: { name: string }) => t.name === `${tag} Team`)).toBe(true);
});

test("API：搜索不泄露他人私有 room 内的 board", async ({ playwright }) => {
  const owner = await newCtx(playwright);
  const tag = `Sec${Math.floor(Math.random() * 1e6)}`;
  const room = (await (await owner.post("/api/rooms", { data: { name: `${tag} Room`, visibility: "private" } })).json()).room;
  await owner.post(`/api/rooms/${room.id}/boards`, { data: { name: `${tag} Board` } });

  const outsider = await newCtx(playwright);
  const data = await (await outsider.get(`/api/search?q=${tag}`)).json();
  expect(data.rooms.length).toBe(0);
  expect(data.boards.length).toBe(0);

  await owner.dispose();
  await outsider.dispose();
});

test("UI：登录后 /search?q= 显示分组结果，点击跳转", async ({ page }) => {
  await register(page);
  const tag = `Omega${Math.floor(Math.random() * 1e6)}`;
  const room = (await (await page.request.post("/api/rooms", { data: { name: `${tag} Room` } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: `${tag} Board` } })).json()).board;

  await page.goto(`/search?q=${tag}`);
  await expect(page.getByTestId("results")).toBeVisible();
  await expect(page.getByTestId("group-rooms")).toContainText(`${tag} Room`);
  await expect(page.getByTestId("group-boards")).toContainText(`${tag} Board`);

  // 点击 board 结果进入 board 页面。
  await page.getByTestId(`board-${board.id}`).click();
  await page.waitForURL(`**/boards/${board.id}`);
});

test("UI：无匹配显示空态", async ({ page }) => {
  await register(page);
  await page.goto(`/search?q=NoSuchResource_${Date.now()}`);
  await expect(page.getByTestId("empty")).toBeVisible();
});

test("UI：空查询显示提示", async ({ page }) => {
  await register(page);
  await page.goto("/search");
  await expect(page.getByTestId("hint")).toBeVisible();
});

test("UI：未登录访问 /search 跳转 /login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`/search?q=anything`);
  await page.waitForURL("**/login");
  expect(page.url()).toContain("/login");
});
