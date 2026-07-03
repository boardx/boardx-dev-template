import { expect, test } from "@playwright/test";
import { canvasItems, clickItem, dblclickItem, expectItemCount } from "./helpers/canvas";

// p6:F13：item 锚点迁为 canvas 兼容锚点（策略 2 / issue #269），断言意图不变。
// 注：add-shape 入口断言在本分支基线即失败（main 的 F01 锚点，本分支无该 testid），原样保留。

const uniq = () => `widgets001_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";
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
  await expectItemCount(page, 1);
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
  await expect(page.getByTestId("widget-menu")).toBeVisible();
  await expect(page.getByTestId("wm-duplicate")).toBeVisible();
  await expect(page.getByTestId("wm-delete")).toBeVisible();
  await expect(page.getByTestId("wm-resize-unavailable")).toBeDisabled();
  await expect(page.getByTestId("wm-lock-unavailable")).toBeDisabled();

  await dblclickItem(page, (await canvasItems(page))[0]!.id);
  await page.locator('[data-testid^="item-edit-"]').fill("更新后的便签");
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await canvasItems(page))[0]!.text).toBe("更新后的便签");

  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items[0].x)
    .toBe(41);

  await page.getByTestId("wm-color-blue").click();
  await page.getByTestId("wm-bold").click();
  await expect.poll(async () => (await canvasItems(page))[0]!.color).toBe("blue:bold");
  await expect.poll(async () => (await canvasItems(page))[0]!.bold).toBe(true);

  await page.getByTestId("wm-duplicate").click();
  await expectItemCount(page, 2);
  await page.keyboard.press("Delete");
  await expectItemCount(page, 1);

  await page.getByTestId("add-text").click();
  await expectItemCount(page, 2);
  expect((await canvasItems(page)).at(-1)!.text).toContain("文本");
  await expect(page.getByTestId("wm-color-blue")).toHaveCount(0);

  await page.getByTestId("add-shape").click();
  await expectItemCount(page, 3);
  await expect
    .poll(async () => {
      const body = await (await page.request.get(`/api/boards/${board.id}/items`)).json();
      return body.items.some((item: { type: string }) => item.type === "rect");
    })
    .toBe(true);

  await clickItem(page, (await canvasItems(page)).at(-1)!.id, { button: "right" });
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
  await expectItemCount(page, 1);
  expect((await canvasItems(page))[0]!.text).toBe("只读组件");
  await expect(page.getByTestId("add-note")).toHaveCount(0);
  await expect(page.getByTestId("add-text")).toHaveCount(0);
  await expect(page.getByTestId("add-shape")).toHaveCount(0);
  await clickItem(page, (await canvasItems(page))[0]!.id, { button: "right" });
  await expect(page.getByTestId("context-menu")).toHaveCount(0);
  await expect(page.getByTestId("widget-menu")).toHaveCount(0);

  await owner.dispose();
});
