import { test, expect } from "@playwright/test";

const uniq = () => `bhg_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function openBoard(page: any) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "H" } })).json()).board;
  await page.goto(`/boards/${board.id}`);
}

// board-shell reskin（issue #468）：老 help-guide 的独立「快捷键」面板已删除（与
// shortcuts-help 功能重复，后者由 board-header-011 spec 覆盖）；欢迎引导重开入口
// 收进 Header 的 ⋯More 菜单（welcome-reopen 菜单项）。

test("欢迎引导可关闭、刷新保持、可从 More 菜单重新打开", async ({ page }) => {
  await openBoard(page);
  await expect(page.getByTestId("welcome-guide")).toBeVisible();
  await page.getByTestId("welcome-dismiss").click();
  await expect(page.getByTestId("welcome-guide")).toBeHidden();

  await page.reload();
  await expect(page.getByTestId("welcome-guide")).toBeHidden();
  await page.getByTestId("board-more-menu").click();
  await expect(page.getByTestId("welcome-reopen")).toBeVisible();
  await page.getByTestId("welcome-reopen").click();
  await expect(page.getByTestId("welcome-guide")).toBeVisible();
});
