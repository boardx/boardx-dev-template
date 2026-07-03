// p20/F05 收藏房间与 Favorites 筛选（uc-rr-004）
// 契约：房间卡片 + 详情页头星标（data-testid=room-favorite-toggle），点击切换收藏并持久化
// （每用户维度）；房间列表 Favorites 筛选只显示已收藏房间；非成员收藏 403；刷新后状态保持。
import { test, expect, type Page, type PlaywrightWorkerArgs } from "@playwright/test";

const uniq = (p: string) => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

async function register(page: Page, prefix: string): Promise<string> {
  const email = uniq(prefix);
  const res = await page.request.post("/api/auth/register", {
    data: { firstName: "U", lastName: prefix, email, password: "secret123", agreeTerms: true },
  });
  expect(res.ok()).toBe(true);
  return email;
}

async function newUserCtx(playwright: PlaywrightWorkerArgs["playwright"], prefix: string) {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  const email = uniq(prefix);
  const res = await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: prefix, email, password: "secret123", agreeTerms: true },
  });
  expect(res.ok()).toBe(true);
  return { ctx, email };
}

async function createRoom(page: Page, name: string): Promise<number> {
  const res = await page.request.post("/api/rooms", { data: { name, visibility: "private" } });
  const d = await res.json();
  return d.room.id as number;
}

test("房间列表卡片星标：点击切换收藏并持久化，Favorites 筛选只显示已收藏房间", async ({ page }) => {
  await register(page, "favlist");
  const roomA = await createRoom(page, "Fav Room A");
  await createRoom(page, "Fav Room B");

  await page.goto("/rooms");
  const starA = page.getByTestId(`room-favorite-toggle-${roomA}`);
  await expect(starA).toBeVisible();
  await expect(starA).toHaveAttribute("aria-pressed", "false");

  await starA.click();
  await expect(starA).toHaveAttribute("aria-pressed", "true");

  // 刷新后状态保持
  await page.reload();
  await expect(page.getByTestId(`room-favorite-toggle-${roomA}`)).toHaveAttribute("aria-pressed", "true");

  // Favorites 筛选：只显示已收藏房间
  await page.getByTestId("room-favorites-filter").click();
  await expect(page.getByTestId(`room-${roomA}`)).toBeVisible();
  await expect(page.getByTestId("room-list")).not.toContainText("Fav Room B");

  // 取消收藏后筛选下消失
  await page.getByTestId(`room-favorite-toggle-${roomA}`).click();
  await expect(page.getByTestId("empty-favorites")).toBeVisible();
});

test("房间详情页头星标：点击切换收藏并持久化，刷新后状态保持", async ({ page }) => {
  await register(page, "favdetail");
  const roomId = await createRoom(page, "Fav Detail Room");

  await page.goto(`/rooms/${roomId}/boards`);
  const star = page.getByTestId("room-favorite-toggle");
  await expect(star).toBeVisible();
  await expect(star).toHaveAttribute("aria-pressed", "false");

  await star.click();
  await expect(star).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(page.getByTestId("room-favorite-toggle")).toHaveAttribute("aria-pressed", "true");
});

test("非成员对房间调用收藏 API 返回 403", async ({ page, playwright }) => {
  const owner = await newUserCtx(playwright, "favowner");
  const room = (await (await owner.ctx.post("/api/rooms", { data: { name: "Secret Fav Room", visibility: "private" } })).json())
    .room;

  await register(page, "favoutsider");
  const postRes = await page.request.post(`/api/rooms/${room.id}/favorite`);
  expect(postRes.status()).toBe(403);
  const deleteRes = await page.request.delete(`/api/rooms/${room.id}/favorite`);
  expect(deleteRes.status()).toBe(403);

  await owner.ctx.dispose();
});
