import { test, expect, type APIRequestContext } from "@playwright/test";

const uniq = () => `rcsend_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function newUser(playwright: any): Promise<{ ctx: APIRequestContext; userId: number }> {
  const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
  const reg = await (await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email: uniq(), password: "secret123", agreeTerms: true },
  })).json();
  return { ctx, userId: reg.user.id };
}

test("创建者在线程中发送消息 → 用户气泡 + AVA 回复出现并持久化", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const chat = (await (await page.request.post(`/api/rooms/${room.id}/chats`, { data: { name: "Mine" } })).json()).chat;

  await page.goto(`/rooms/${room.id}/chats/${chat.id}`);
  await expect(page.getByTestId("chat-workspace")).toBeVisible();
  // 空态
  await expect(page.getByTestId("empty")).toBeVisible();

  // 发送消息
  await page.getByTestId("chat-input").fill("帮我整理房间资料");
  await page.getByTestId("chat-send").click();

  // 用户消息出现在当前线程
  await expect(page.getByTestId("msg-user")).toContainText("帮我整理房间资料");
  // AVA 回复成功展示，且关联当前 roomId
  await expect(page.getByTestId("msg-ava")).toContainText(`房间 ${room.id}`);

  // 持久化：刷新后两条消息仍在
  await page.reload();
  await expect(page.getByTestId("msg-user")).toContainText("帮我整理房间资料");
  await expect(page.getByTestId("msg-ava")).toBeVisible();

  // 同一线程继续发送
  await page.getByTestId("chat-input").fill("再来一条");
  await page.getByTestId("chat-send").click();
  await expect(page.getByTestId("msg-user")).toHaveCount(2);
  await expect(page.getByTestId("msg-ava")).toHaveCount(2);
});

test("他人创建的线程 → 只读，无法发送", async ({ page, playwright }) => {
  const owner = await newUser(playwright);
  const room = (await (await owner.ctx.post("/api/rooms", { data: { name: "R", visibility: "private" } })).json()).room;
  const chat = (await (await owner.ctx.post(`/api/rooms/${room.id}/chats`, { data: { name: "Owner Thread" } })).json()).chat;

  // page 注册为成员 B 并被加入房间
  const reg = await (await page.request.post("/api/auth/register", {
    data: { firstName: "B", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  })).json();
  await owner.ctx.post(`/api/rooms/${room.id}/members`, { data: { userId: reg.user.id } });

  await page.goto(`/rooms/${room.id}/chats/${chat.id}`);
  await expect(page.getByTestId("readonly-input")).toBeVisible();
  await expect(page.getByTestId("chat-input")).toBeHidden();

  // 直接 POST 也被拒（仅创建者可发送）
  const res = await page.request.post(`/api/rooms/${room.id}/chats/${chat.id}/messages`, {
    data: { text: "x" },
  });
  expect(res.status()).toBe(403);

  await owner.ctx.dispose();
});

test("未登录访问发送接口 → 401；页面跳转 /login", async ({ page, playwright }) => {
  const owner = await newUser(playwright);
  const room = (await (await owner.ctx.post("/api/rooms", { data: { name: "R", visibility: "private" } })).json()).room;
  const chat = (await (await owner.ctx.post(`/api/rooms/${room.id}/chats`, { data: { name: "X" } })).json()).chat;

  // 干净的未登录上下文
  const anon = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
  const res = await anon.post(`/api/rooms/${room.id}/chats/${chat.id}/messages`, { data: { text: "x" } });
  expect(res.status()).toBe(401);
  await anon.dispose();

  await page.goto(`/rooms/${room.id}/chats/${chat.id}`);
  await expect(page).toHaveURL(/\/login/);

  await owner.ctx.dispose();
});
