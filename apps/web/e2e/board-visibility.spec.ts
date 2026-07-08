import { test, expect, type APIRequestContext } from "@playwright/test";

const uniq = () => `bvi_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

async function newUser(playwright: any): Promise<{ ctx: APIRequestContext; userId: number }> {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  const reg = await (await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email: uniq(), password: "secret123", agreeTerms: true },
  })).json();
  return { ctx, userId: reg.user.id };
}

test("改为 public 后非成员可只读访问（viewer）", async ({ playwright }) => {
  const owner = await newUser(playwright);
  const room = (await (await owner.ctx.post("/api/rooms", { data: { name: "R", visibility: "private" } })).json()).room;
  const board = (await (await owner.ctx.post(`/api/rooms/${room.id}/boards`, { data: { name: "Pub" } })).json()).board;

  const outsider = await newUser(playwright);
  expect((await outsider.ctx.get(`/api/boards/${board.id}`)).status()).toBe(403);

  const res = await owner.ctx.patch(`/api/boards/${board.id}/visibility`, { data: { visibility: "public" } });
  expect(res.status()).toBe(200);

  const get = await outsider.ctx.get(`/api/boards/${board.id}`);
  expect(get.status()).toBe(200);
  expect((await get.json()).role).toBe("viewer");

  await owner.ctx.dispose();
  await outsider.ctx.dispose();
});

test("team 可见：团队成员（非房间成员）可只读，非团队成员 403", async ({ playwright }) => {
  const owner = await newUser(playwright);
  const team = (await (await owner.ctx.post("/api/teams", { data: { name: "T" } })).json()).team;
  const room = (await (await owner.ctx.post("/api/rooms", { data: { name: "R", visibility: "private", teamId: team.id } })).json()).room;
  const board = (await (await owner.ctx.post(`/api/rooms/${room.id}/boards`, { data: { name: "TeamBoard" } })).json()).board;
  await owner.ctx.patch(`/api/boards/${board.id}/visibility`, { data: { visibility: "team" } });

  // 团队成员（非房间成员）
  const invite = await (await owner.ctx.post(`/api/teams/${team.id}/invites`, { data: {} })).json();
  const teammate = await newUser(playwright);
  await teammate.ctx.post("/api/teams/join", { data: { token: invite.token } });
  const tmGet = await teammate.ctx.get(`/api/boards/${board.id}`);
  expect(tmGet.status()).toBe(200);
  expect((await tmGet.json()).role).toBe("viewer");

  // 非团队成员
  const outsider = await newUser(playwright);
  expect((await outsider.ctx.get(`/api/boards/${board.id}`)).status()).toBe(403);

  await owner.ctx.dispose();
  await teammate.ctx.dispose();
  await outsider.ctx.dispose();
});

test("非房间 owner 改可见范围 → 403；非法值 400", async ({ playwright }) => {
  const owner = await newUser(playwright);
  const room = (await (await owner.ctx.post("/api/rooms", { data: { name: "R", visibility: "private" } })).json()).room;
  const board = (await (await owner.ctx.post(`/api/rooms/${room.id}/boards`, { data: { name: "B" } })).json()).board;

  const member = await newUser(playwright);
  await owner.ctx.post(`/api/rooms/${room.id}/members`, { data: { userId: member.userId } });
  expect((await member.ctx.patch(`/api/boards/${board.id}/visibility`, { data: { visibility: "public" } })).status()).toBe(403);

  expect((await owner.ctx.patch(`/api/boards/${board.id}/visibility`, { data: { visibility: "bogus" } })).status()).toBe(400);

  await owner.ctx.dispose();
  await member.ctx.dispose();
});

test("UI：房间 owner 在板页切换可见范围到 public", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "VisUI" } })).json()).board;

  await page.goto(`/boards/${board.id}`);
  await page.getByTestId("board-meta-edit").click();
  await page.getByTestId("visibility").selectOption("public");
  // selectOption 只触发 onChange，不等待 changeVisibility 的 PATCH+refresh 异步完成——
  // 落库前就 reload 会读到旧值，是竞态而非真实回归（p7:F03 压测暴露，此前偶发概率低，
  // 未被注意到）。先等 REST 侧真正落库，再刷新验证持久化。
  await expect
    .poll(async () => (await (await page.request.get(`/api/boards/${board.id}`)).json()).board?.visibility, {
      timeout: 10_000,
    })
    .toBe("public");
  await page.reload();
  await page.getByTestId("board-meta-edit").click();
  await expect(page.getByTestId("visibility")).toHaveValue("public");
});
