import { test, expect, type APIRequestContext } from "@playwright/test";

const uniq = () => `bx_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

async function newUser(playwright: any): Promise<{ ctx: APIRequestContext; userId: number }> {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  const reg = await (await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email: uniq(), password: "secret123", agreeTerms: true },
  })).json();
  return { ctx, userId: reg.user.id };
}

test("属主删除白板：列表移除且 GET 404（API）", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Doomed" } })).json()).board;

  const del = await page.request.delete(`/api/boards/${board.id}`);
  expect(del.status()).toBe(200);
  expect((await page.request.get(`/api/boards/${board.id}`)).status()).toBe(404);
  const list = (await (await page.request.get(`/api/boards?roomId=${room.id}`)).json()).boards;
  expect(list.some((x: { id: number }) => String(x.id) === String(board.id))).toBe(false);
});

test("房间成员（非管理者）删除 → 403", async ({ playwright }) => {
  const owner = await newUser(playwright);
  const room = (await (await owner.ctx.post("/api/rooms", { data: { name: "R", visibility: "private" } })).json()).room;
  const board = (await (await owner.ctx.post(`/api/rooms/${room.id}/boards`, { data: { name: "B" } })).json()).board;

  const member = await newUser(playwright);
  await owner.ctx.post(`/api/rooms/${room.id}/members`, { data: { userId: member.userId } });
  const res = await member.ctx.delete(`/api/boards/${board.id}`);
  expect(res.status()).toBe(403);

  await owner.ctx.dispose();
  await member.ctx.dispose();
});

test("UI：属主确认删除后回到房间白板列表且不含该板", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "DeleteUI" } })).json()).board;

  await page.goto(`/boards/${board.id}`);
  // 新板欢迎引导卡（bottom-left）会遮住 meta 面板低处的删除按钮，先关掉（同 canvas-guidelines）。
  await page.getByTestId("welcome-dismiss").click();
  // reskin(issue #468): 该入口收进 Header ⋯More 菜单，先确保面板展开。
  if (!(await page.getByTestId("board-more-panel").isVisible())) await page.getByTestId("board-more-menu").click();
  await page.getByTestId("board-meta-edit").click();
  await page.getByTestId("board-delete").click();
  await page.getByTestId("board-delete-confirm").click();

  await expect(page).toHaveURL(new RegExp(`/rooms/${room.id}/boards`));
  await expect(page.getByTestId("empty")).toBeVisible();
});
