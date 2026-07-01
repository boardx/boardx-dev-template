import { test, expect } from "@playwright/test";

const uniq = () => `ctx_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function openOwnBoard(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "C", lastName: "M", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Ctx" } })).json()).board;
  await page.goto(`/boards/${board.id}`);
  return board;
}

test("右键便签 → 上下文菜单出现，含复制/副本/删除/粘贴", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  const item = page.getByTestId("items-layer").locator('[data-testid^="item-"]').first();
  await item.click({ button: "right" });
  await expect(page.getByTestId("context-menu")).toBeVisible();
  await expect(page.getByTestId("ctx-copy")).toBeVisible();
  await expect(page.getByTestId("ctx-duplicate")).toBeVisible();
  await expect(page.getByTestId("ctx-delete")).toBeVisible();
  await expect(page.getByTestId("ctx-paste")).toBeVisible();
});

test("上下文菜单 删除 → 便签移除", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  const items = page.getByTestId("items-layer").locator('[data-testid^="item-"]');
  await items.first().click({ button: "right" });
  await page.getByTestId("ctx-delete").click();
  await expect(items).toHaveCount(0);
});

test("上下文菜单 创建副本 → 便签变两个", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  const items = page.getByTestId("items-layer").locator('[data-testid^="item-"]');
  await items.first().click({ button: "right" });
  await page.getByTestId("ctx-duplicate").click();
  await expect(items).toHaveCount(2);
});
