import { test, expect, type APIRequestContext } from "@playwright/test";

const uniq = () => `rcl_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function newUser(playwright: any): Promise<APIRequestContext> {
  const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
  await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email: uniq(), password: "secret123", agreeTerms: true },
  });
  return ctx;
}

test("房间 Chat 列表显示线程（名称+创建者）与 New Chat", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  await page.request.post(`/api/rooms/${room.id}/chats`, { data: { name: "Kickoff" } });

  await page.goto(`/rooms/${room.id}/chats`);
  await expect(page.getByTestId("new-chat")).toBeVisible();
  await expect(page.getByTestId("chat-list")).toContainText("Kickoff");
});

test("无线程显示空状态", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  await page.goto(`/rooms/${room.id}/chats`);
  await expect(page.getByTestId("empty")).toBeVisible();
});

test("非房间成员列出聊天 → 403", async ({ playwright }) => {
  const owner = await newUser(playwright);
  const room = (await (await owner.post("/api/rooms", { data: { name: "Secret", visibility: "private" } })).json()).room;
  const outsider = await newUser(playwright);
  const res = await outsider.get(`/api/rooms/${room.id}/chats`);
  expect(res.status()).toBe(403);
  await owner.dispose();
  await outsider.dispose();
});
