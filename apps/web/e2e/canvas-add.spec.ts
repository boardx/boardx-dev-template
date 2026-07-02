import { test, expect } from "@playwright/test";

const uniq = () => `ca_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

test("添加便签后出现在板上且刷新仍在", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;

  await page.goto(`/rooms/${room.id}/board`);
  await expect(page.getByTestId("item-count")).toHaveText("0 个");
  await page.getByTestId("add-note").click();
  await expect(page.getByTestId("item-count")).toHaveText("1 个");

  // 刷新仍在（持久化）
  await page.reload();
  await expect(page.getByTestId("item-count")).toHaveText("1 个");
});

test("非房间成员添加 item → 403", async ({ page, playwright }) => {
  const owner = await playwright.request.newContext({ baseURL: BASE_URL });
  await owner.post("/api/auth/register", {
    data: { firstName: "O", lastName: "O", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await owner.post("/api/rooms", { data: { name: "Priv", visibility: "private" } })).json()).room;

  await page.request.post("/api/auth/register", {
    data: { firstName: "X", lastName: "X", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const res = await page.request.post(`/api/rooms/${room.id}/items`, { data: { type: "note", x: 1, y: 1 } });
  expect(res.status()).toBe(403);
  await owner.dispose();
});
