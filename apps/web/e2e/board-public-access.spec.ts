import { test, expect, type APIRequestContext } from "@playwright/test";

const uniq = () => `bpa_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function newUser(playwright: any): Promise<{ ctx: APIRequestContext; userId: number }> {
  const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
  const reg = await (await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email: uniq(), password: "secret123", agreeTerms: true },
  })).json();
  return { ctx, userId: reg.user.id };
}

test("匿名打开 public 白板 → 200 viewer；private → 401", async ({ playwright }) => {
  const owner = await newUser(playwright);
  const room = (await (await owner.ctx.post("/api/rooms", { data: { name: "R", visibility: "private" } })).json()).room;
  const board = (await (await owner.ctx.post(`/api/rooms/${room.id}/boards`, { data: { name: "PubLink" } })).json()).board;

  const anon = await playwright.request.newContext({ baseURL: "http://localhost:3000" });

  // private 时匿名 401
  expect((await anon.get(`/api/boards/${board.id}`)).status()).toBe(401);

  // 改 public 后匿名只读
  await owner.ctx.patch(`/api/boards/${board.id}/visibility`, { data: { visibility: "public" } });
  const get = await anon.get(`/api/boards/${board.id}`);
  expect(get.status()).toBe(200);
  const body = await get.json();
  expect(body.role).toBe("viewer");
  expect(body.anonymous).toBe(true);

  await owner.ctx.dispose();
  await anon.dispose();
});

test("已登录非成员加入 public 白板 → 成为 editor", async ({ playwright }) => {
  const owner = await newUser(playwright);
  const room = (await (await owner.ctx.post("/api/rooms", { data: { name: "R", visibility: "private" } })).json()).room;
  const board = (await (await owner.ctx.post(`/api/rooms/${room.id}/boards`, { data: { name: "JoinMe" } })).json()).board;
  await owner.ctx.patch(`/api/boards/${board.id}/visibility`, { data: { visibility: "public" } });

  const joiner = await newUser(playwright);
  // 加入前是 viewer
  expect((await (await joiner.ctx.get(`/api/boards/${board.id}`)).json()).role).toBe("viewer");
  // 加入
  const res = await joiner.ctx.post(`/api/boards/${board.id}/join`);
  expect(res.status()).toBe(200);
  // 加入后是 editor（房间成员）
  expect((await (await joiner.ctx.get(`/api/boards/${board.id}`)).json()).role).toBe("editor");

  await owner.ctx.dispose();
  await joiner.ctx.dispose();
});

test("加入无权访问的 private 白板 → 403", async ({ playwright }) => {
  const owner = await newUser(playwright);
  const room = (await (await owner.ctx.post("/api/rooms", { data: { name: "R", visibility: "private" } })).json()).room;
  const board = (await (await owner.ctx.post(`/api/rooms/${room.id}/boards`, { data: { name: "NoJoin" } })).json()).board;

  const outsider = await newUser(playwright);
  expect((await outsider.ctx.post(`/api/boards/${board.id}/join`)).status()).toBe(403);

  await owner.ctx.dispose();
  await outsider.ctx.dispose();
});

test("UI：已登录非成员在 public 板上点加入协作 → 变 editor", async ({ page, playwright }) => {
  const owner = await newUser(playwright);
  const room = (await (await owner.ctx.post("/api/rooms", { data: { name: "R", visibility: "private" } })).json()).room;
  const board = (await (await owner.ctx.post(`/api/rooms/${room.id}/boards`, { data: { name: "UIJoin" } })).json()).board;
  await owner.ctx.patch(`/api/boards/${board.id}/visibility`, { data: { visibility: "public" } });

  // 当前 page 注册一个新用户（非成员）
  await page.request.post("/api/auth/register", {
    data: { firstName: "J", lastName: "J", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.goto(`/boards/${board.id}`);
  await expect(page.getByTestId("board-role")).toHaveText("viewer");
  await page.getByTestId("join-collab").click();
  await expect(page.getByTestId("board-role")).toHaveText("editor");

  await owner.ctx.dispose();
});
