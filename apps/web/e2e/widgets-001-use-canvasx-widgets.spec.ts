import { expect, test } from "@playwright/test";

const uniq = () => `widgets001_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";
const canvasItems = (page: import("@playwright/test").Page) => page.getByTestId("items-layer").locator('[data-testid^="item-"]');

async function openOwnBoard(page: import("@playwright/test").Page, name = "Widgets Board") {
  await page.request.post("/api/auth/register", {
    data: { firstName: "W", lastName: "X", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "Widgets Room" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name } })).json()).board;
  await page.goto(`/boards/${board.id}`);
  return { room, board };
}

test("编辑者创建并管理 CanvasX widgets，菜单显示能力边界", async ({ page }) => {
  const { board } = await openOwnBoard(page);

  await page.getByTestId("add-note").click();
  const items = canvasItems(page);
  await expect(items).toHaveCount(1);
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
  await expect(page.getByTestId("widget-menu")).toBeVisible();
  await expect(page.getByTestId("wm-duplicate")).toBeVisible();
  await expect(page.getByTestId("wm-delete")).toBeVisible();
  await expect(page.getByTestId("wm-resize-unavailable")).toBeDisabled();
  await expect(page.getByTestId("wm-lock-unavailable")).toBeDisabled();

  await items.first().dblclick();
  await page.locator('[data-testid^="item-edit-"]').fill("更新后的便签");
  await page.keyboard.press("Enter");
  await expect(items.first()).toContainText("更新后的便签");

  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items[0].x)
    .toBe(41);

  await page.getByTestId("wm-color-blue").click();
  await page.getByTestId("wm-bold").click();
  await expect(items.first()).toHaveClass(/bg-tag-blue/);
  await expect(items.first()).toHaveClass(/font-bold/);

  await page.getByTestId("wm-duplicate").click();
  await expect(items).toHaveCount(2);
  await page.keyboard.press("Delete");
  await expect(items).toHaveCount(1);

  await page.getByTestId("add-text").click();
  await expect(items).toHaveCount(2);
  await expect(items.last()).toContainText("文本");
  await expect(page.getByTestId("wm-color-blue")).toHaveCount(0);

  await page.getByTestId("add-shape").click();
  await expect(items).toHaveCount(3);
  await expect
    .poll(async () => {
      const body = await (await page.request.get(`/api/boards/${board.id}/items`)).json();
      return body.items.some((item: { type: string }) => item.type === "rect");
    })
    .toBe(true);

  await items.last().click({ button: "right" });
  await expect(page.getByTestId("context-menu")).toBeVisible();
  await expect(page.getByTestId("ctx-copy")).toBeVisible();
  await expect(page.getByTestId("ctx-duplicate")).toBeVisible();
  await expect(page.getByTestId("ctx-delete")).toBeVisible();
  await expect(page.getByTestId("ctx-paste")).toBeVisible();
  await expect(page.getByTestId("ctx-lock-unavailable")).toBeDisabled();
});

test("viewer 只能查看 CanvasX widgets，不能创建或打开编辑菜单", async ({ page, playwright }) => {
  const owner = await playwright.request.newContext({ baseURL: BASE_URL });
  await owner.post("/api/auth/register", {
    data: { firstName: "O", lastName: "O", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await owner.post("/api/rooms", { data: { name: "Public Widgets" } })).json()).room;
  const board = (await (await owner.post(`/api/rooms/${room.id}/boards`, { data: { name: "Readonly Widgets" } })).json()).board;
  await owner.post(`/api/boards/${board.id}/items`, { data: { type: "note", x: 20, y: 20, text: "只读组件" } });
  await owner.patch(`/api/boards/${board.id}/visibility`, { data: { visibility: "public" } });

  await page.request.post("/api/auth/register", {
    data: { firstName: "V", lastName: "V", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.goto(`/boards/${board.id}`);

  await expect(page.getByTestId("board-role")).toHaveText("viewer");
  await expect(canvasItems(page)).toHaveCount(1);
  await expect(page.getByText("只读组件")).toBeVisible();
  await expect(page.getByTestId("add-note")).toHaveCount(0);
  await expect(page.getByTestId("add-text")).toHaveCount(0);
  await expect(page.getByTestId("add-shape")).toHaveCount(0);
  await canvasItems(page).first().click({ button: "right" });
  await expect(page.getByTestId("context-menu")).toHaveCount(0);
  await expect(page.getByTestId("widget-menu")).toHaveCount(0);

  await owner.dispose();
});
