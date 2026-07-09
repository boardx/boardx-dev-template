import { test, expect } from "@playwright/test";

const uniq = () => `bh011_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function openBoard(page: any) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (
    await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "H" } })).json()
  ).board;
  await page.goto(`/boards/${board.id}`);
  // board-shell reskin（issue #468）：快捷键入口收进 Header 的 ⋯More 菜单，先展开。
  await page.getByTestId("board-more-menu").click();
  await expect(page.getByTestId("board-shortcuts-open")).toBeVisible();
}

test("Header 快捷键入口打开帮助弹窗并按分类列出快捷键", async ({ page }) => {
  await openBoard(page);

  // 入口在 Header 的 More 菜单内（不破坏既有 board-header 结构）。
  await expect(page.getByTestId("board-header").getByTestId("board-shortcuts-open")).toBeVisible();

  // 初始隐藏。
  await expect(page.getByTestId("shortcuts-help-panel")).toBeHidden();

  // 打开。
  await page.getByTestId("board-shortcuts-open").click();
  const panel = page.getByTestId("shortcuts-help-panel");
  await expect(panel).toBeVisible();

  // 上下文提示 + 分类标题。
  await expect(page.getByTestId("shortcuts-help-hint")).toBeVisible();
  await expect(panel.getByTestId("shortcuts-group-编辑")).toBeVisible();
  await expect(panel.getByTestId("shortcuts-group-选择")).toBeVisible();
  await expect(panel.getByTestId("shortcuts-group-排列")).toBeVisible();

  // 列出 board-canvas 实际支持的快捷键操作说明。
  await expect(panel).toContainText("撤销");
  await expect(panel).toContainText("重做");
  await expect(panel).toContainText("复制");
  await expect(panel).toContainText("粘贴");
  await expect(panel).toContainText("删除选中");
  await expect(panel).toContainText("全选");
  await expect(panel).toContainText("取消选择");

  // 至少渲染了一个按键组合（kbd）。
  await expect(panel.locator("kbd").first()).toBeVisible();
});

test("关闭按钮可关闭快捷键弹窗", async ({ page }) => {
  await openBoard(page);
  await page.getByTestId("board-shortcuts-open").click();
  await expect(page.getByTestId("shortcuts-help-panel")).toBeVisible();

  await page.getByTestId("shortcuts-help-close").click();
  await expect(page.getByTestId("shortcuts-help-panel")).toBeHidden();
});

test("按 Esc 关闭快捷键弹窗（UC 主流程第 7 步）", async ({ page }) => {
  await openBoard(page);
  await page.getByTestId("board-shortcuts-open").click();
  await expect(page.getByTestId("shortcuts-help-panel")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("shortcuts-help-panel")).toBeHidden();
});

test("既有 Header testid 仍在（board-header/board-title/board-role/快捷键帮助引导）", async ({
  page,
}) => {
  await openBoard(page);
  await expect(page.getByTestId("board-header")).toBeVisible();
  await expect(page.getByTestId("board-title")).toBeVisible();
  await expect(page.getByTestId("board-role")).toBeVisible();
  // 欢迎引导重开入口迁入 More 菜单（reskin：老 help-open 快捷键面板已删，见 shortcuts-help）。
  await expect(page.getByTestId("welcome-reopen")).toBeVisible();
});
