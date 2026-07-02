import { test, expect, type APIRequestContext } from "@playwright/test";

const uniq = () => `bm_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

async function newUser(playwright: any): Promise<{ ctx: APIRequestContext; userId: number }> {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  const reg = await (await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email: uniq(), password: "secret123", agreeTerms: true },
  })).json();
  return { ctx, userId: reg.user.id };
}

test("属主更新名称/类别/描述并回显（API）", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Old Name" } })).json()).board;

  const res = await page.request.patch(`/api/boards/${board.id}`, {
    data: { name: "New Name", category: "design", description: "hello" },
  });
  expect(res.status()).toBe(200);
  const { board: updated } = await res.json();
  expect(updated.name).toBe("New Name");
  expect(updated.category).toBe("design");
  expect(updated.description).toBe("hello");
});

test("空名更新被拒（400）", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Keep" } })).json()).board;
  const res = await page.request.patch(`/api/boards/${board.id}`, { data: { name: "   " } });
  expect(res.status()).toBe(400);
});

test("房间成员（非管理者）更新 → 403", async ({ playwright }) => {
  const owner = await newUser(playwright);
  const room = (await (await owner.ctx.post("/api/rooms", { data: { name: "R", visibility: "private" } })).json()).room;
  const board = (await (await owner.ctx.post(`/api/rooms/${room.id}/boards`, { data: { name: "B" } })).json()).board;

  const member = await newUser(playwright);
  await owner.ctx.post(`/api/rooms/${room.id}/members`, { data: { userId: member.userId } });
  // 成员可查看
  expect((await member.ctx.get(`/api/boards/${board.id}`)).status()).toBe(200);
  // 但无管理权限改元信息
  const res = await member.ctx.patch(`/api/boards/${board.id}`, { data: { name: "hack" } });
  expect(res.status()).toBe(403);

  await owner.ctx.dispose();
  await member.ctx.dispose();
});

test("UI：属主在板页编辑名称，标题刷新", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Before" } })).json()).board;

  await page.goto(`/boards/${board.id}`);
  await expect(page.getByTestId("board-title")).toHaveText("Before");
  await page.getByTestId("board-meta-edit").click();
  await page.getByTestId("meta-name").fill("After");
  await page.getByTestId("meta-save").click();
  await expect(page.getByTestId("board-title")).toHaveText("After");
});
