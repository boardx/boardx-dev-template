import { expect, test } from "@playwright/test";
import { canvasItems, expectItemCount } from "./helpers/canvas";

// p6:F13：item 锚点迁为 canvas 兼容锚点（策略 2 / issue #269），断言意图不变。
// board-shell reskin（issue #468）：顶部 Board Menu 工具条 → 底部悬浮 dock（board-bottom-dock）。
// 工具 testid 不变（add-note/add-text/board-tool-*）；draw/connector 已上线（enabled）；
// 旧 assets/templates 面板整组下线，dock 中 table/kanban/code/image 为 disabled 占位。

// uc-board-menu-001-use-board-menu：通过底部工具 dock 选择工具并在画布创建或放置内容。
const uniq = () => `bm001_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

async function openOwnBoard(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "Board Menu" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Menu Board" } })).json()).board;
  await page.goto(`/boards/${board.id}`);
  return board;
}

test("编辑者使用底部工具 dock：工具可见、占位禁用、创建后选中", async ({ page }) => {
  await openOwnBoard(page);

  await expect(page.getByTestId("board-bottom-dock")).toBeVisible();
  await expect(page.getByTestId("board-tool-select")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("board-tool-pan")).toBeEnabled();
  await expect(page.getByTestId("add-note")).toBeEnabled();
  await expect(page.getByTestId("add-text")).toBeEnabled();
  await expect(page.getByTestId("board-tool-shape")).toBeEnabled();
  await expect(page.getByTestId("board-tool-draw")).toBeEnabled();
  await expect(page.getByTestId("board-tool-connector")).toBeEnabled();

  // 未实现能力以禁用占位存在（不消失，给用户能力地图）。
  await expect(page.getByTestId("dock-tool-table")).toBeDisabled();
  await expect(page.getByTestId("dock-tool-kanban")).toBeDisabled();
  await expect(page.getByTestId("dock-tool-code")).toBeDisabled();
  await expect(page.getByTestId("dock-tool-image")).toBeDisabled();

  await page.getByTestId("board-tool-pan").click();
  await expect(page.getByTestId("board-tool-pan")).toHaveAttribute("aria-pressed", "true");

  // 形状类型切换：dock 上 shape 按钮旁的下拉箭头打开 shape picker。
  await page.getByTestId("board-tool-shape-menu").click();
  await expect(page.getByTestId("board-shape-panel")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("board-shape-panel")).toHaveCount(0);

  await page.getByTestId("add-note").click();
  await expectItemCount(page, 1);
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
  await expect(page.getByTestId("widget-menu")).toBeVisible();

  await page.getByTestId("board-tool-shape").click();
  await expectItemCount(page, 2);
  expect((await canvasItems(page)).at(-1)!.text).toContain("矩形");
  await expect(page.getByTestId("board-tool-shape")).toHaveAttribute("aria-pressed", "true");
});

test("viewer 不显示会改变内容的工具 dock", async ({ page, playwright }) => {
  const owner = await playwright.request.newContext({ baseURL: BASE_URL });
  await owner.post("/api/auth/register", {
    data: { firstName: "O", lastName: "O", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await owner.post("/api/rooms", { data: { name: "Public Room" } })).json()).room;
  const board = (await (await owner.post(`/api/rooms/${room.id}/boards`, { data: { name: "Public Board" } })).json()).board;
  await owner.patch(`/api/boards/${board.id}/visibility`, { data: { visibility: "public" } });

  await page.request.post("/api/auth/register", {
    data: { firstName: "V", lastName: "V", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.goto(`/boards/${board.id}`);

  await expect(page.getByTestId("board-bottom-dock")).toHaveCount(0);
  await expect(page.getByTestId("add-note")).toHaveCount(0);
  await expect(page.getByTestId("add-text")).toHaveCount(0);

  await owner.dispose();
});
