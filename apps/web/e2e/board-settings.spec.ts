import { test, expect, type APIRequestContext } from "@playwright/test";

const uniq = () => `bst_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function newUser(playwright: any): Promise<{ ctx: APIRequestContext; userId: number }> {
  const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
  const reg = await (await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email: uniq(), password: "secret123", agreeTerms: true },
  })).json();
  return { ctx, userId: reg.user.id };
}

test("管理者更新设置并持久化（API）", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "S" } })).json()).board;

  const res = await page.request.patch(`/api/boards/${board.id}/settings`, { data: { grid: true, snap: true } });
  expect(res.status()).toBe(200);
  expect((await res.json()).settings).toMatchObject({ grid: true, snap: true });

  // 读回持久
  const got = await (await page.request.get(`/api/boards/${board.id}`)).json();
  expect(got.board.settings).toMatchObject({ grid: true, snap: true });
});

test("非管理者改设置 → 403", async ({ playwright }) => {
  const owner = await newUser(playwright);
  const room = (await (await owner.ctx.post("/api/rooms", { data: { name: "R", visibility: "private" } })).json()).room;
  const board = (await (await owner.ctx.post(`/api/rooms/${room.id}/boards`, { data: { name: "S" } })).json()).board;

  const member = await newUser(playwright);
  await owner.ctx.post(`/api/rooms/${room.id}/members`, { data: { userId: member.userId } });
  expect((await member.ctx.patch(`/api/boards/${board.id}/settings`, { data: { grid: true } })).status()).toBe(403);

  await owner.ctx.dispose();
  await member.ctx.dispose();
});

test("UI：属主在板页打开网格并刷新保持", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "SUI" } })).json()).board;

  await page.goto(`/boards/${board.id}`);
  await page.getByTestId("board-meta-edit").click();
  await page.getByTestId("setting-grid").selectOption("on");
  await page.reload();
  await page.getByTestId("board-meta-edit").click();
  await expect(page.getByTestId("setting-grid")).toHaveValue("on");
});
