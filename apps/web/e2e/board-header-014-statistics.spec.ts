import { test, expect } from "@playwright/test";

const uniq = () => `stats_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

test("板统计：header 入口打开面板，显示组件总数/便签/文本", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "S", lastName: "T", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Stats" } })).json()).board;
  // 放两个便签
  await page.request.post(`/api/boards/${board.id}/items`, { data: { type: "note", x: 10, y: 10, text: "a" } });
  await page.request.post(`/api/boards/${board.id}/items`, { data: { type: "note", x: 20, y: 20, text: "b" } });

  await page.goto(`/boards/${board.id}`);
  await expect(page.getByTestId("board-header")).toBeVisible();
  // reskin(issue #468): 该入口收进 Header ⋯More 菜单，先确保面板展开。
  if (!(await page.getByTestId("board-more-panel").isVisible())) await page.getByTestId("board-more-menu").click();
  await page.getByTestId("board-stats-open").click();
  await expect(page.getByTestId("board-stats-panel")).toBeVisible();
  await expect(page.getByTestId("stat-total")).toHaveText("2");
  await expect(page.getByTestId("stat-notes")).toHaveText("2");
  await expect(page.getByTestId("stat-texts")).toHaveText("0");
});
