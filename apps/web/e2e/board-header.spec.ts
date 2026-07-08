import { expect, test } from "@playwright/test";
import { expectItemCount, waitForCanvasReady } from "./helpers/canvas";

// p7:F01 — Board Header 框架（状态/授权入口/返回/同步指示/撤销重做）。
// 覆盖 uc-board-header-001（框架可见）+ 008（安全返回）+ 009（同步状态，已有基础设施，
// 这里只做本 feature 范围内的最小确认）+ 010（撤销/重做可用态）。
// 001/009 的更细行为（在线成员/统计/计时器等其它入口）由各自 sibling feature
// （F04/F05/F06/F07）的专属 spec 覆盖，这里不重复断言，避免维护两份相同用例。
const uniq = () => `bh_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function createRoomAndBoard(page: import("@playwright/test").Page, boardName = "Header Board") {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "Header Room" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: boardName } })).json())
    .board;
  return { room, board };
}

test("uc-board-header-001：框架四要素（返回/标题/同步状态/撤销重做）均可见", async ({ page }) => {
  const { board } = await createRoomAndBoard(page);
  await page.goto(`/boards/${board.id}`);
  await waitForCanvasReady(page);

  const header = page.getByTestId("board-header");
  await expect(header).toBeVisible();
  await expect(page.getByTestId("board-back")).toBeVisible();
  await expect(header.getByTestId("board-title")).toHaveText("Header Board");
  await expect(page.getByTestId("board-sync-status")).toBeVisible();
  await expect(page.getByTestId("undo")).toBeVisible();
  await expect(page.getByTestId("redo")).toBeVisible();
});

test("uc-board-header-008：点击返回 → 回到所属房间的白板列表", async ({ page }) => {
  const { room, board } = await createRoomAndBoard(page);
  await page.goto(`/boards/${board.id}`);
  await waitForCanvasReady(page);

  await page.getByTestId("board-back").click();
  // 客户端路由切到 (app)/rooms/[id] 分支需要重新拉取 room+board 数据，系统负载高时
  // 观测到 1s+ 才真正跳转（已确认点击本身立即生效，只是导航慢），给足够宽松的等待窗口。
  await expect(page).toHaveURL(new RegExp(`/rooms/${room.id}/boards$`), { timeout: 15_000 });
});

test("uc-board-header-008：返回后原白板内容与 Header 状态不受影响（安全离开）", async ({ page }) => {
  const { board } = await createRoomAndBoard(page);
  await page.request.post(`/api/boards/${board.id}/items`, { data: { type: "note", x: 24, y: 24, text: "n1" } });
  await page.goto(`/boards/${board.id}`);
  await waitForCanvasReady(page);

  await page.getByTestId("board-back").click();
  await expect(page).toHaveURL(new RegExp(`/rooms/${board.room_id}/boards$`));

  // 重新访问同一白板（不依赖浏览器历史栈的 goBack 语义，只验证"离开不会破坏白板内容"
  // 这个业务意图本身）：白板标题、原有内容都必须原样还在。
  await page.goto(`/boards/${board.id}`);
  await waitForCanvasReady(page);
  await expect(page.getByTestId("board-title")).toHaveText(board.name);
  await expectItemCount(page, 1);
});

test("uc-board-header-010：无操作历史时撤销/重做禁用；操作后撤销可用，撤销后重做可用", async ({ page }) => {
  const { board } = await createRoomAndBoard(page);
  await page.goto(`/boards/${board.id}`);
  await waitForCanvasReady(page);

  await expect(page.getByTestId("undo")).toBeDisabled();
  await expect(page.getByTestId("redo")).toBeDisabled();

  await page.getByTestId("add-note").click();
  await expect(page.getByTestId("undo")).toBeEnabled();
  await expect(page.getByTestId("redo")).toBeDisabled();

  await page.getByTestId("undo").click();
  await expect(page.getByTestId("redo")).toBeEnabled();

  await page.getByTestId("redo").click();
  await expect(page.getByTestId("undo")).toBeEnabled();
});

test("viewer 也能看到返回入口（uc-008 对所有 actor 开放，不受编辑权限限制）", async ({ page, playwright }) => {
  const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";
  const owner = await playwright.request.newContext({ baseURL: BASE_URL });
  await owner.post("/api/auth/register", {
    data: { firstName: "O", lastName: "O", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await owner.post("/api/rooms", { data: { name: "Viewer Room" } })).json()).room;
  const board = (await (await owner.post(`/api/rooms/${room.id}/boards`, { data: { name: "Viewer Board" } })).json())
    .board;
  await owner.patch(`/api/boards/${board.id}/visibility`, { data: { visibility: "public" } });

  await page.request.post("/api/auth/register", {
    data: { firstName: "V", lastName: "V", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.goto(`/boards/${board.id}`);
  await waitForCanvasReady(page);

  await expect(page.getByTestId("board-back")).toBeVisible();
  await expect(page.getByTestId("board-back")).toBeEnabled();

  await owner.dispose();
});
