import { test, expect } from "@playwright/test";

const uniq = () => `sty_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function openOwnBoard(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "S", lastName: "Y", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Style" } })).json()).board;
  await page.goto(`/boards/${board.id}`);
  return board;
}

test("字重：选中便签 → wm-bold 加粗，持久化（color 追加 :bold）", async ({ page }) => {
  const board = await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
  await page.getByTestId("wm-bold").click();
  const item = page.getByTestId("items-layer").locator('[data-testid^="item-"]').first();
  await expect(item).toHaveClass(/font-bold/);
  await expect
    .poll(async () => (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items[0].color)
    .toContain(":bold");
});

test("字重与颜色共存：先改蓝色再加粗 → color=blue:bold，仍是蓝底加粗", async ({ page }) => {
  const board = await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await page.getByTestId("wm-color-blue").click();
  await page.getByTestId("wm-bold").click();
  await expect
    .poll(async () => (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items[0].color)
    .toBe("blue:bold");
});
