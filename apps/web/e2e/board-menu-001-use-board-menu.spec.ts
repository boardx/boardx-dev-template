import { expect, test } from "@playwright/test";

// uc-board-menu-001-use-board-menu：通过 Board Menu 选择工具并在画布创建或放置内容。
const uniq = () => `bm001_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function openOwnBoard(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "Board Menu" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Menu Board" } })).json()).board;
  await page.goto(`/boards/${board.id}`);
  return board;
}

const items = (page: import("@playwright/test").Page) => page.getByTestId("items-layer").locator('[data-testid^="item-"]');

test("编辑者使用 Board Menu：工具可见、面板可打开、创建后选中", async ({ page }) => {
  await openOwnBoard(page);

  await expect(page.getByTestId("board-menu")).toBeVisible();
  await expect(page.getByTestId("board-tool-select")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("board-tool-pan")).toBeEnabled();
  await expect(page.getByTestId("add-note")).toBeEnabled();
  await expect(page.getByTestId("add-text")).toBeEnabled();
  await expect(page.getByTestId("board-tool-shape")).toBeEnabled();
  await expect(page.getByTestId("board-tool-draw")).toBeDisabled();
  await expect(page.getByTestId("board-tool-connector")).toBeDisabled();

  await page.getByTestId("board-tool-pan").click();
  await expect(page.getByTestId("board-tool-pan")).toHaveAttribute("aria-pressed", "true");

  await page.getByTestId("board-tool-assets").click();
  await expect(page.getByTestId("board-assets-panel")).toBeVisible();
  await expect(page.getByTestId("board-assets-search")).toBeVisible();
  await expect(page.getByText("图片")).toBeVisible();
  await expect(page.getByText("图标")).toBeVisible();

  await page.getByTestId("board-tool-templates").click();
  await expect(page.getByTestId("board-templates-panel")).toBeVisible();
  await expect(page.getByText("Brainstorm")).toBeVisible();
  await expect(page.getByText("Kanban")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("board-templates-panel")).toHaveCount(0);
  await expect(page.getByTestId("board-tool-select")).toHaveAttribute("aria-pressed", "true");

  await page.getByTestId("add-note").click();
  await expect(items(page)).toHaveCount(1);
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
  await expect(page.getByTestId("widget-menu")).toBeVisible();

  await page.getByTestId("board-tool-shape").click();
  await expect(items(page)).toHaveCount(2);
  await expect(items(page).last()).toContainText("矩形");
  await expect(page.getByTestId("board-tool-shape")).toHaveAttribute("aria-pressed", "true");
});

test("viewer 不显示会改变内容的 Board Menu", async ({ page, playwright }) => {
  const owner = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
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

  await expect(page.getByTestId("board-menu")).toHaveCount(0);
  await expect(page.getByTestId("add-note")).toHaveCount(0);
  await expect(page.getByTestId("add-text")).toHaveCount(0);

  await owner.dispose();
});
