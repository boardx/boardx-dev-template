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

test("快捷键帮助面板可开关并列出快捷键", async ({ page }) => {
  await openBoard(page);
  await expect(page.getByTestId("shortcuts-panel")).toBeHidden();
  await page.getByTestId("help-open").click();
  await expect(page.getByTestId("shortcuts-panel")).toBeVisible();
  await expect(page.getByTestId("shortcuts-panel")).toContainText("撤销");
  await page.getByTestId("help-close").click();
  await expect(page.getByTestId("shortcuts-panel")).toBeHidden();
});

test("欢迎引导可关闭、刷新保持、可重新打开", async ({ page }) => {
  await openBoard(page);
  await expect(page.getByTestId("welcome-guide")).toBeVisible();
  await page.getByTestId("welcome-dismiss").click();
  await expect(page.getByTestId("welcome-guide")).toBeHidden();

  await page.reload();
  await expect(page.getByTestId("welcome-guide")).toBeHidden();
  await expect(page.getByTestId("welcome-reopen")).toBeVisible();
  await page.getByTestId("welcome-reopen").click();
  await expect(page.getByTestId("welcome-guide")).toBeVisible();
});
