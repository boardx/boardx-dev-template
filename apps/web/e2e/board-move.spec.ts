import { test, expect, type APIRequestContext } from "@playwright/test";

const uniq = () => `bv_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

async function newUser(playwright: any): Promise<{ ctx: APIRequestContext; userId: number }> {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  const reg = await (await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email: uniq(), password: "secret123", agreeTerms: true },
  })).json();
  return { ctx, userId: reg.user.id };
}

test("属主把白板从 A 移动到 B（API）", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const a = (await (await page.request.post("/api/rooms", { data: { name: "A" } })).json()).room;
  const b = (await (await page.request.post("/api/rooms", { data: { name: "B" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${a.id}/boards`, { data: { name: "Mover" } })).json()).board;

  const res = await page.request.post(`/api/boards/${board.id}/move`, { data: { targetRoomId: b.id } });
  expect(res.status()).toBe(200);
  const { board: moved } = await res.json();
  expect(String(moved.room_id)).toBe(String(b.id));

  const inA = (await (await page.request.get(`/api/boards?roomId=${a.id}`)).json()).boards;
  const inB = (await (await page.request.get(`/api/boards?roomId=${b.id}`)).json()).boards;
  expect(inA.some((x: { id: number }) => String(x.id) === String(board.id))).toBe(false);
  expect(inB.some((x: { id: number }) => String(x.id) === String(board.id))).toBe(true);
});

test("移动到自己不是成员的房间 → 403", async ({ playwright }) => {
  const owner = await newUser(playwright);
  const a = (await (await owner.ctx.post("/api/rooms", { data: { name: "A" } })).json()).room;
  const board = (await (await owner.ctx.post(`/api/rooms/${a.id}/boards`, { data: { name: "M" } })).json()).board;

  const other = await newUser(playwright);
  const otherRoom = (await (await other.ctx.post("/api/rooms", { data: { name: "Other", visibility: "private" } })).json()).room;

  const res = await owner.ctx.post(`/api/boards/${board.id}/move`, { data: { targetRoomId: otherRoom.id } });
  expect(res.status()).toBe(403);

  await owner.ctx.dispose();
  await other.ctx.dispose();
});

test("房间成员（非管理者）移动 → 403", async ({ playwright }) => {
  const owner = await newUser(playwright);
  const a = (await (await owner.ctx.post("/api/rooms", { data: { name: "A", visibility: "private" } })).json()).room;
  const b = (await (await owner.ctx.post("/api/rooms", { data: { name: "B" } })).json()).room;
  const board = (await (await owner.ctx.post(`/api/rooms/${a.id}/boards`, { data: { name: "M" } })).json()).board;

  const member = await newUser(playwright);
  await owner.ctx.post(`/api/rooms/${a.id}/members`, { data: { userId: member.userId } });
  const res = await member.ctx.post(`/api/boards/${board.id}/move`, { data: { targetRoomId: b.id } });
  expect(res.status()).toBe(403);

  await owner.ctx.dispose();
  await member.ctx.dispose();
});

test("UI：属主选目标房间移动，目标房间列表出现该板", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const a = (await (await page.request.post("/api/rooms", { data: { name: "RoomA" } })).json()).room;
  const b = (await (await page.request.post("/api/rooms", { data: { name: "RoomB" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${a.id}/boards`, { data: { name: "UIMove" } })).json()).board;

  await page.goto(`/boards/${board.id}`);
  // reskin(issue #468): 该入口收进 Header ⋯More 菜单，先确保面板展开。
  if (!(await page.getByTestId("board-more-panel").isVisible())) await page.getByTestId("board-more-menu").click();
  await page.getByTestId("board-meta-edit").click();
  await page.getByTestId("move-room").selectOption(String(b.id));
  await page.getByTestId("move-btn").click();

  await page.goto(`/rooms/${b.id}/boards`);
  await expect(page.getByTestId("board-list")).toContainText("UIMove");
});
