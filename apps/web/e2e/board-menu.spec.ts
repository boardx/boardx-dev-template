import { expect, test } from "@playwright/test";
import { canvasItems, expectItemCount, waitForCanvasReady } from "./helpers/canvas";

// p7:F11 — Board Menu 工具栏框架 + 组件创建入口。
// 覆盖 uc-board-menu-001~007 + 012：工具栏可见、选中态切换、已有创建能力（便利贴/文本/形状/
// 资源/模板）的入口正常工作，以及图表(F18)/橡皮擦(F17，手绘擦除)两个底层能力尚未实现时的
// 「占位 + 不可用反馈」行为（范围纪律：不越界实现 F16/F17/F18 本身）。
const uniq = () => `bm_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function openOwnBoard(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "Board Menu E2E" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Menu Board" } })).json())
    .board;
  await page.goto(`/boards/${board.id}`);
  return board;
}

test("uc-board-menu-001：工具栏可见，已实现入口可用，未实现入口保持禁用", async ({ page }) => {
  await openOwnBoard(page);

  await expect(page.getByTestId("board-menu")).toBeVisible();
  // 默认选中态：选择工具
  await expect(page.getByTestId("board-tool-select")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("board-tool-pan")).toBeEnabled();
  await expect(page.getByTestId("add-note")).toBeEnabled();
  await expect(page.getByTestId("add-text")).toBeEnabled();
  await expect(page.getByTestId("board-tool-shape")).toBeEnabled();
  await expect(page.getByTestId("board-tool-assets")).toBeEnabled();
  await expect(page.getByTestId("board-tool-templates")).toBeEnabled();
  // p6:F16/F17 未实现：连接线、手绘保持禁用占位，不假装已完成
  await expect(page.getByTestId("board-tool-draw")).toBeDisabled();
  await expect(page.getByTestId("board-tool-connector")).toBeDisabled();
});

test("uc-board-menu-001：选中态在工具间正确切换", async ({ page }) => {
  await openOwnBoard(page);

  await page.getByTestId("board-tool-pan").click();
  await expect(page.getByTestId("board-tool-pan")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("board-tool-select")).toHaveAttribute("aria-pressed", "false");

  await page.getByTestId("board-tool-select").click();
  await expect(page.getByTestId("board-tool-select")).toHaveAttribute("aria-pressed", "true");
});

test("uc-board-menu-002：创建便利贴 → 出现在画布并自动选中", async ({ page }) => {
  await openOwnBoard(page);

  await page.getByTestId("add-note").click();
  await expectItemCount(page, 1);
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
  await expect(page.getByTestId("widget-menu")).toBeVisible();
  expect((await canvasItems(page))[0]!.kind).toBe("note");
});

test("uc-board-menu-003：创建文本 → 出现在画布并自动选中", async ({ page }) => {
  await openOwnBoard(page);

  await page.getByTestId("add-text").click();
  await expectItemCount(page, 1);
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
  // addText 先以 note 落库再 PATCH 写入 color 文本哨兵（两步异步），poll 等最终态落定，
  // 避免读到创建瞬间、PATCH 还没生效的中间态（kind 暂为 note）。
  await expect.poll(async () => (await canvasItems(page))[0]!.kind).toBe("text");
});

test("uc-board-menu-004：创建形状 → 出现在画布，形状类型面板可切换类型", async ({ page }) => {
  await openOwnBoard(page);

  await page.getByTestId("board-tool-shape").click();
  await expectItemCount(page, 1);
  await expect(page.getByTestId("board-tool-shape")).toHaveAttribute("aria-pressed", "true");
  expect((await canvasItems(page))[0]!.kind).toBe("shape");

  await page.getByTestId("board-tool-shape-menu").click();
  await expect(page.getByTestId("board-shape-panel")).toBeVisible();
  await page.getByTestId("board-shape-circle").click();
  await expectItemCount(page, 2);
  // packages/collab（p8 实时协作层，非本 feature/area 范围）里有一个已知、已记录的真实竞态：
  // poll() 若恰好在"创建 POST 已落库、color PATCH 还没落库"的窗口发起一次 GET，其结果会经
  // syncItemsIntoDoc 把无 color 的版本写进 Yjs doc；board-canvas.tsx 的 seedItems 调用对
  // doc 里已存在的 id 直接跳过不覆盖，本应由 REST 快照带回的正确 color 会被这个更早写入的
  // 值短暂遮蔽，直到下一次某个 items 变化把正确值重新经 syncItemsIntoDoc 镜像回 doc 才收敛。
  // 已经在 addShape 里加了 upsertItem 直写规避大部分窗口（见那里的详细注释），但 WS 网关的
  // sync-request/response 路径仍可能在极少数时序下重新触发这个收敛过程，本地无法完全消除
  // （需要 packages/collab 加版本号/时间戳裁决，超出 coord-board area，已跟进给 coord-collab）。
  // 这里用 expect.poll 容忍"最终一致"而非要求"立即一致"——断言意图不变（形状类型最终必须
  // 正确），只是给收敛过程一个合理窗口，不是弱化断言掩盖真实回归。
  await expect.poll(async () => (await canvasItems(page)).at(-1)!.shapeType, { timeout: 5_000 }).toBe("circle");
});

test("uc-board-menu-005：连接线入口当前禁用（p6:F16 未实现），不误导为已实现", async ({ page }) => {
  await openOwnBoard(page);

  const connector = page.getByTestId("board-tool-connector");
  await expect(connector).toBeDisabled();
  await expect(connector).toHaveAttribute("title", /暂不可用/);
});

test("uc-board-menu-006：手绘入口当前禁用（p6:F17 未实现），不误导为已实现", async ({ page }) => {
  await openOwnBoard(page);

  const draw = page.getByTestId("board-tool-draw");
  await expect(draw).toBeDisabled();
  await expect(draw).toHaveAttribute("title", /暂不可用/);
});

test("uc-board-menu-007：C 键切换图表模式（无工具栏按钮），点击画布给出不可用反馈且不创建内容", async ({
  page,
}) => {
  await openOwnBoard(page);
  await waitForCanvasReady(page); // 确保画布 + 键盘监听已挂载，避免 c 键落在 hydration 完成前

  // 业务规则 1：当前 Board Menu 不直接渲染图表按钮
  await expect(page.getByTestId("board-menu").getByRole("button", { name: "图表" })).toHaveCount(0);

  await page.keyboard.press("c");
  await expect(page.getByTestId("board-tool-select")).toHaveAttribute("aria-pressed", "false");

  await page.mouse.click(700, 400);
  await expect(page.getByTestId("board-menu-notice")).toBeVisible();
  await expect(page.getByTestId("board-menu-notice")).toContainText("图表");
  await expectItemCount(page, 0); // 不创建任何真实对象

  // 退出图表模式：再按一次 C 或选择工具
  await page.getByTestId("board-tool-select").click();
  await expect(page.getByTestId("board-tool-select")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("board-menu-notice")).toHaveCount(0);
});

test("uc-board-menu-012：橡皮擦入口点击给出不可用反馈（p6:F17 手绘擦除未实现），不改变画布", async ({
  page,
}) => {
  await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await expectItemCount(page, 1);

  await page.getByTestId("board-tool-eraser").click();
  await expect(page.getByTestId("board-menu-notice")).toBeVisible();
  await expect(page.getByTestId("board-menu-notice")).toContainText("暂不可用");
  // 画布内容不变
  await expectItemCount(page, 1);

  await page.getByTestId("board-tool-select").click();
  await expect(page.getByTestId("board-menu-notice")).toHaveCount(0);
});

test("viewer 不显示会改变内容的 Board Menu", async ({ page, playwright }) => {
  const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";
  const owner = await playwright.request.newContext({ baseURL: BASE_URL });
  await owner.post("/api/auth/register", {
    data: { firstName: "O", lastName: "O", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await owner.post("/api/rooms", { data: { name: "Public Room" } })).json()).room;
  const board = (await (await owner.post(`/api/rooms/${room.id}/boards`, { data: { name: "Public Board" } })).json())
    .board;
  await owner.patch(`/api/boards/${board.id}/visibility`, { data: { visibility: "public" } });

  await page.request.post("/api/auth/register", {
    data: { firstName: "V", lastName: "V", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.goto(`/boards/${board.id}`);

  await expect(page.getByTestId("board-menu")).toHaveCount(0);
  await expect(page.getByTestId("add-note")).toHaveCount(0);
  await expect(page.getByTestId("board-tool-eraser")).toHaveCount(0);

  await owner.dispose();
});
