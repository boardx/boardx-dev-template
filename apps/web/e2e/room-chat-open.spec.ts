import { test, expect, type APIRequestContext } from "@playwright/test";

const uniq = () => `rco_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function newUser(playwright: any): Promise<{ ctx: APIRequestContext; userId: number }> {
  const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
  const reg = await (await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email: uniq(), password: "secret123", agreeTerms: true },
  })).json();
  return { ctx, userId: reg.user.id };
}

test("成员打开他人创建的线程 → 只读态（无输入区，有仅查看标记）", async ({ page, playwright }) => {
  const owner = await newUser(playwright);
  const room = (await (await owner.ctx.post("/api/rooms", { data: { name: "R", visibility: "private" } })).json()).room;
  const chat = (await (await owner.ctx.post(`/api/rooms/${room.id}/chats`, { data: { name: "Owner Thread" } })).json()).chat;

  // page 注册为成员 B 并被加入房间
  const reg = await (await page.request.post("/api/auth/register", {
    data: { firstName: "B", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  })).json();
  await owner.ctx.post(`/api/rooms/${room.id}/members`, { data: { userId: reg.user.id } });

  await page.goto(`/rooms/${room.id}/chats/${chat.id}`);
  await expect(page.getByTestId("chat-workspace")).toBeVisible();
  await expect(page.getByTestId("readonly-badge")).toBeVisible();
  await expect(page.getByTestId("readonly-input")).toBeVisible();
  await expect(page.getByTestId("chat-input")).toBeHidden();

  await owner.ctx.dispose();
});

test("创建者打开自己的线程 → 可编辑（有输入区，无只读标记）", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const chat = (await (await page.request.post(`/api/rooms/${room.id}/chats`, { data: { name: "Mine" } })).json()).chat;

  await page.goto(`/rooms/${room.id}/chats/${chat.id}`);
  await expect(page.getByTestId("chat-input")).toBeVisible();
  await expect(page.getByTestId("readonly-badge")).toBeHidden();
});

test("非房间成员打开线程 → 403", async ({ playwright }) => {
  const owner = await newUser(playwright);
  const room = (await (await owner.ctx.post("/api/rooms", { data: { name: "R", visibility: "private" } })).json()).room;
  const chat = (await (await owner.ctx.post(`/api/rooms/${room.id}/chats`, { data: { name: "X" } })).json()).chat;

  const outsider = await newUser(playwright);
  const res = await outsider.ctx.get(`/api/rooms/${room.id}/chats/${chat.id}`);
  expect(res.status()).toBe(403);

  await owner.ctx.dispose();
  await outsider.ctx.dispose();
});
