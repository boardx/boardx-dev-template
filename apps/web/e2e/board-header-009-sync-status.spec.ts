import { test, expect } from "@playwright/test";

const uniq = () => `bh009_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function openBoard(page: any) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (
    await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "H" } })).json()
  ).board;
  await page.goto(`/boards/${board.id}`);
  await expect(page.getByTestId("board-header")).toBeVisible();
}

test("进入白板后 Header 显示同步状态指示器与状态文案", async ({ page }) => {
  await openBoard(page);

  // 指示器在 Header 内（不破坏既有结构）。
  const status = page.getByTestId("board-header").getByTestId("board-sync-status");
  await expect(status).toBeVisible();

  // 状态点 + 文案标签都可见。
  await expect(page.getByTestId("board-sync-dot")).toBeVisible();
  await expect(page.getByTestId("board-sync-label")).toBeVisible();

  // 稳态为「已同步」。
  await expect(page.getByTestId("board-sync-label")).toHaveText("已同步");
  await expect(status).toHaveAttribute("data-sync-state", "synced");

  // 只读入口：带「同步数据状态」提示（UC 主流程第 4 步）。
  await expect(status).toHaveAttribute("title", "同步数据状态");
});

test("触发模拟保存后短暂显示「保存中」再回到「已同步」", async ({ page }) => {
  await openBoard(page);
  const status = page.getByTestId("board-header").getByTestId("board-sync-status");

  await status.click();
  await expect(status).toHaveAttribute("data-sync-state", "saving");
  await expect(page.getByTestId("board-sync-label")).toHaveText("保存中");

  // 同步完成后恢复为「已同步」（UC 主流程第 5 步）。
  await expect(status).toHaveAttribute("data-sync-state", "synced");
  await expect(page.getByTestId("board-sync-label")).toHaveText("已同步");
});

test("既有 Header testid 仍在（board-header/board-title/board-role/计时器）", async ({ page }) => {
  await openBoard(page);
  await expect(page.getByTestId("board-header")).toBeVisible();
  await expect(page.getByTestId("board-title")).toBeVisible();
  await expect(page.getByTestId("board-role")).toBeVisible();
  await expect(page.getByTestId("board-timer")).toBeVisible();
});
