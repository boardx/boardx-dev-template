import { test, expect, type APIRequestContext } from "@playwright/test";

const uniq = () => `rcsend_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

async function newUser(playwright: any): Promise<{ ctx: APIRequestContext; userId: number }> {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  const reg = await (await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email: uniq(), password: "secret123", agreeTerms: true },
  })).json();
  return { ctx, userId: reg.user.id };
}

test("创建者在线程中发送消息 → 用户气泡 + AVA 真实回复出现并持久化", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const chat = (await (await page.request.post(`/api/rooms/${room.id}/chats`, { data: { name: "Mine" } })).json()).chat;

  await page.goto(`/rooms/${room.id}/chats/${chat.id}`);
  await expect(page.getByTestId("chat-workspace")).toBeVisible();
  // 空态：作用域限定在消息列表容器内——`empty` testid 不再唯一（房间文件面板
  // room-files-panel 也用了同名 testid 标它自己的空态，属于跨模块的既有命名撞车，
  // 与本 feature 无关，顺手把这里的定位器收紧，不动 room-files-panel 那一侧）。
  await expect(page.getByTestId("message-list").getByTestId("empty")).toBeVisible();

  // 发送消息
  await page.getByTestId("chat-input").fill("帮我整理房间资料");
  await page.getByTestId("chat-send").click();

  // 用户消息出现在当前线程
  await expect(page.getByTestId("msg-user")).toContainText("帮我整理房间资料");
  // p18 room-ava F05：AVA 回复来自真实网关（stub provider 也是同一套 CAP-AI 调用路径），
  // 不再是固定字符串模板"AVA（房间 X 上下文）已收到..."——只断言回复非空且引用了用户的
  // 原话（stub 回复里会原样带出 quoted 用户文本），证明走的是真实生成路径而非写死回声。
  await expect(page.getByTestId("msg-ava")).toContainText("帮我整理房间资料", { timeout: 15_000 });
  await expect(page.getByTestId("msg-ava")).not.toContainText(`房间 ${room.id} 上下文）已收到`);

  // 持久化：刷新后两条消息仍在
  await page.reload();
  await expect(page.getByTestId("msg-user")).toContainText("帮我整理房间资料");
  await expect(page.getByTestId("msg-ava")).toBeVisible();

  // 同一线程继续发送
  await page.getByTestId("chat-input").fill("再来一条");
  await page.getByTestId("chat-send").click();
  await expect(page.getByTestId("msg-user")).toHaveCount(2);
  await expect(page.getByTestId("msg-ava")).toHaveCount(2, { timeout: 15_000 });
});

test("房间配置了 ai_instruction → 系统提示真实注入到 AVA 回复链路", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "C", lastName: "D", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  await page.request.patch(`/api/rooms/${room.id}`, {
    data: { ai_instruction: "用简体中文回复，语气正式" },
  });
  const chat = (await (await page.request.post(`/api/rooms/${room.id}/chats`, { data: { name: "Mine" } })).json()).chat;

  await page.goto(`/rooms/${room.id}/chats/${chat.id}`);
  await page.getByTestId("chat-input").fill("你好");
  await page.getByTestId("chat-send").click();

  // uc-rr-010（p20/F11）：system 消息真实喂给了网关（而非只是历史遗留的字符串拼接），
  // stub provider 在回复里如实引用了系统提示内容，证明注入路径端到端生效。
  await expect(page.getByTestId("msg-ava")).toContainText("用简体中文回复，语气正式", {
    timeout: 15_000,
  });
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
  const anon = await playwright.request.newContext({ baseURL: BASE_URL });
  const res = await anon.post(`/api/rooms/${room.id}/chats/${chat.id}/messages`, { data: { text: "x" } });
  expect(res.status()).toBe(401);
  await anon.dispose();

  await page.goto(`/rooms/${room.id}/chats/${chat.id}`);
  await expect(page).toHaveURL(/\/login/);

  await owner.ctx.dispose();
});
