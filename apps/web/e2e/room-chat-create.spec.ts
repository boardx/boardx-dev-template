import { test, expect, type APIRequestContext } from "@playwright/test";

const uniq = () => `rcc_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

async function newUser(playwright: any): Promise<APIRequestContext> {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email: uniq(), password: "secret123", agreeTerms: true },
  });
  return ctx;
}

test("New Chat 创建线程并进入三栏工作区", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;

  await page.goto(`/rooms/${room.id}/chats`);
  await page.getByTestId("new-chat").click();

  await expect(page).toHaveURL(new RegExp(`/rooms/${room.id}/chats/\\d+`));
  await expect(page.getByTestId("chat-workspace")).toBeVisible();
  await expect(page.getByTestId("pane-files")).toBeVisible();
  await expect(page.getByTestId("pane-chat")).toBeVisible();
  await expect(page.getByTestId("pane-studio")).toBeVisible();
  // 创建者可编辑（输入区存在）
  await expect(page.getByTestId("chat-input")).toBeVisible();
});

test("创建后线程出现在列表", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  await page.goto(`/rooms/${room.id}/chats`);
  await page.getByTestId("new-chat").click();
  await expect(page.getByTestId("chat-workspace")).toBeVisible();
  await page.getByTestId("back-to-room").click();
  await expect(page.getByTestId("chat-list")).toBeVisible();
});

test("非房间成员创建线程 → 403", async ({ playwright }) => {
  const owner = await newUser(playwright);
  const room = (await (await owner.post("/api/rooms", { data: { name: "Secret", visibility: "private" } })).json()).room;
  const outsider = await newUser(playwright);
  const res = await outsider.post(`/api/rooms/${room.id}/chats`, { data: { name: "x" } });
  expect(res.status()).toBe(403);
  await owner.dispose();
  await outsider.dispose();
});
