import { test, expect } from "@playwright/test";

const uniq = () => `hrb_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

test("Home 最近白板：访问过的白板出现且可点击跳转 Board", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Recent One" } })).json()).board;
  // 打开一次记录访问
  await page.request.get(`/api/boards/${board.id}`);

  await page.goto("/home");
  await expect(page.getByTestId("recent-boards-list")).toContainText("Recent One");
  await page.getByTestId(`recent-board-${board.id}`).click();
  await expect(page).toHaveURL(new RegExp(`/boards/${board.id}`));
  await expect(page.getByTestId("board-title")).toHaveText("Recent One");
});

test("无最近白板时显示空状态 + 进入房间入口", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.goto("/home");
  await expect(page.getByTestId("recent-boards-empty")).toBeVisible();
  await page.getByTestId("goto-rooms").click();
  await expect(page).toHaveURL(/\/rooms/);
});
