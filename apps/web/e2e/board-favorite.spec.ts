import { test, expect } from "@playwright/test";

const uniq = () => `bf_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: any) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

test("收藏/取消收藏切换并体现在收藏列表（API）", async ({ page }) => {
  await register(page);
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Fav Board" } })).json()).board;

  // 初始未收藏
  let fav = await (await page.request.get("/api/boards?scope=favorite")).json();
  expect(fav.boards.length).toBe(0);

  // 收藏
  const add = await page.request.post(`/api/boards/${board.id}/favorite`);
  expect(add.status()).toBe(200);
  fav = await (await page.request.get("/api/boards?scope=favorite")).json();
  expect(fav.boards.some((b: { id: number }) => String(b.id) === String(board.id))).toBe(true);

  // 取消收藏
  await page.request.delete(`/api/boards/${board.id}/favorite`);
  fav = await (await page.request.get("/api/boards?scope=favorite")).json();
  expect(fav.boards.length).toBe(0);
});

test("非成员收藏他人私有白板 → 403", async ({ page, playwright }) => {
  await register(page);
  const room = (await (await page.request.post("/api/rooms", { data: { name: "Secret", visibility: "private" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "P" } })).json()).board;

  const outsider = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
  await outsider.post("/api/auth/register", {
    data: { firstName: "O", lastName: "O", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const res = await outsider.post(`/api/boards/${board.id}/favorite`);
  expect(res.status()).toBe(403);
  await outsider.dispose();
});

test("UI：点星标收藏，刷新后保持", async ({ page }) => {
  await register(page);
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Star Me" } })).json()).board;

  await page.goto(`/rooms/${room.id}/boards`);
  const star = page.getByTestId(`fav-${board.id}`);
  await expect(star).toHaveAttribute("aria-pressed", "false");
  await star.click();
  await expect(star).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(page.getByTestId(`fav-${board.id}`)).toHaveAttribute("aria-pressed", "true");
});
