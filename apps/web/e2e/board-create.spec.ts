import { test, expect, type APIRequestContext } from "@playwright/test";

const uniq = () => `bc_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

async function newUser(playwright: any): Promise<APIRequestContext> {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email: uniq(), password: "secret123", agreeTerms: true },
  });
  return ctx;
}

test("在房间内创建白板后出现在白板列表", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "BoardRoom" } })).json()).room;

  await page.goto(`/rooms/${room.id}/boards`);
  await page.getByTestId("show-create-board").click();
  await page.getByTestId("board-name").fill("My First Board");
  await page.getByTestId("create-board").click();
  await expect(page.getByTestId("board-list")).toContainText("My First Board");
});

test("空名白板用默认标题创建（201）", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;

  const res = await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "   " } });
  expect(res.status()).toBe(201);
  const { board } = await res.json();
  expect(board.name).toBe("Untitled Board");
});

test("非房间成员创建白板 → 403", async ({ playwright }) => {
  const owner = await newUser(playwright);
  const room = (await (await owner.post("/api/rooms", { data: { name: "Secret", visibility: "private" } })).json()).room;

  const outsider = await newUser(playwright);
  const res = await outsider.post(`/api/rooms/${room.id}/boards`, { data: { name: "Sneaky" } });
  expect(res.status()).toBe(403);

  await owner.dispose();
  await outsider.dispose();
});
