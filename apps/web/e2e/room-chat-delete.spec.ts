import { test, expect, type APIRequestContext } from "@playwright/test";

const uniq = () => `rcd_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function newUser(playwright: any): Promise<{ ctx: APIRequestContext; userId: number }> {
  const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
  const reg = await (await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email: uniq(), password: "secret123", agreeTerms: true },
  })).json();
  return { ctx, userId: reg.user.id };
}

test("创建者删除线程：确认后从列表移除（API+UI）", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const chat = (await (await page.request.post(`/api/rooms/${room.id}/chats`, { data: { name: "Trash" } })).json()).chat;

  await page.goto(`/rooms/${room.id}/chats`);
  await expect(page.getByTestId(`chat-${chat.id}`)).toBeVisible();
  await page.getByTestId(`del-${chat.id}`).click();
  await page.getByTestId(`del-confirm-${chat.id}`).click();
  await expect(page.getByTestId("empty")).toBeVisible();
});

test("非创建者成员无删除入口且 API 403", async ({ page, playwright }) => {
  const owner = await newUser(playwright);
  const room = (await (await owner.ctx.post("/api/rooms", { data: { name: "R", visibility: "private" } })).json()).room;
  const chat = (await (await owner.ctx.post(`/api/rooms/${room.id}/chats`, { data: { name: "Owned" } })).json()).chat;

  const reg = await (await page.request.post("/api/auth/register", {
    data: { firstName: "B", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  })).json();
  await owner.ctx.post(`/api/rooms/${room.id}/members`, { data: { userId: reg.user.id } });

  // API：成员删他人线程 403
  expect((await page.request.delete(`/api/rooms/${room.id}/chats/${chat.id}`)).status()).toBe(403);

  // UI：成员看不到删除按钮
  await page.goto(`/rooms/${room.id}/chats`);
  await expect(page.getByTestId(`chat-${chat.id}`)).toBeVisible();
  await expect(page.getByTestId(`del-${chat.id}`)).toHaveCount(0);

  await owner.ctx.dispose();
});
