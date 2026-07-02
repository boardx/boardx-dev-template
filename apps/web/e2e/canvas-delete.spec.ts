import { test, expect } from "@playwright/test";

const uniq = () => `cd_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

test("删除 item：板上消失且列表不含", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const item = (await (await page.request.post(`/api/rooms/${room.id}/items`, {
    data: { type: "note", x: 10, y: 10, text: "del me" },
  })).json()).item;

  await page.goto(`/rooms/${room.id}/board`);
  await expect(page.getByTestId(`item-${item.id}`)).toBeVisible();
  await page.getByTestId(`del-${item.id}`).click();
  await expect(page.getByTestId(`item-${item.id}`)).toHaveCount(0);

  // 列表不含
  const items = (await (await page.request.get(`/api/rooms/${room.id}/items`)).json()).items;
  expect(items.length).toBe(0);
});

test("非房间成员删除 item → 403", async ({ page, playwright }) => {
  const owner = await playwright.request.newContext({ baseURL: BASE_URL });
  await owner.post("/api/auth/register", {
    data: { firstName: "O", lastName: "O", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await owner.post("/api/rooms", { data: { name: "P", visibility: "private" } })).json()).room;
  const item = (await (await owner.post(`/api/rooms/${room.id}/items`, { data: { type: "note", x: 1, y: 1 } })).json()).item;

  await page.request.post("/api/auth/register", {
    data: { firstName: "X", lastName: "X", email: uniq(), password: "secret123", agreeTerms: true },
  });
  expect((await page.request.delete(`/api/items/${item.id}`)).status()).toBe(403);
  await owner.dispose();
});
