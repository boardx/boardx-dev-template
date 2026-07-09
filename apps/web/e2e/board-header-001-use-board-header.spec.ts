import { expect, test } from "@playwright/test";

const uniq = () => `bh001_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

async function createBoard(page: import("@playwright/test").Page, name = "Header Board") {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "Header Room" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name } })).json()).board;
  return { room, board };
}

test("owner 通过 Board Header 理解状态并进入授权操作", async ({ page, context }) => {
  const { board } = await createBoard(page, "Header Owner");
  await page.request.post(`/api/boards/${board.id}/items`, { data: { type: "note", x: 24, y: 24, text: "header" } });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  await page.goto(`/boards/${board.id}`);

  const header = page.getByTestId("board-header");
  await expect(header).toBeVisible();
  await expect(header.getByTestId("board-title")).toHaveText("Header Owner");
  await expect(header.getByTestId("board-role")).toHaveText("owner");
  await expect(header.getByTestId("board-sync-status")).toHaveAttribute("data-sync-state", "synced");
  await expect(header.getByTestId("board-sync-label")).toHaveText("已同步");
  // reskin(issue #468): 该入口收进 Header ⋯More 菜单，先确保面板展开。
  if (!(await page.getByTestId("board-more-panel").isVisible())) await page.getByTestId("board-more-menu").click();
  await expect(header.getByTestId("board-stats-open")).toBeVisible();
  await expect(header.getByTestId("board-shortcuts-open")).toBeVisible();
  await expect(header.getByTestId("board-timer")).toBeVisible();
  await expect(header.getByTestId("board-share")).toBeVisible();
  // reskin(issue #468): 该入口收进 Header ⋯More 菜单，先确保面板展开。
  if (!(await page.getByTestId("board-more-panel").isVisible())) await page.getByTestId("board-more-menu").click();
  await expect(header.getByTestId("board-meta-edit")).toBeVisible();
  await expect(page.getByTestId("board-bottom-dock")).toBeVisible();
  await expect(page.getByTestId("canvas-viewport")).toBeVisible();

  // reskin(issue #468): 该入口收进 Header ⋯More 菜单，先确保面板展开。
  if (!(await page.getByTestId("board-more-panel").isVisible())) await page.getByTestId("board-more-menu").click();
  await page.getByTestId("board-stats-open").click();
  await expect(page.getByTestId("board-stats-panel")).toBeVisible();
  await expect(page.getByTestId("stat-total")).toHaveText("1");
  // 统计面板悬浮在 More 菜单之上，会拦截后续菜单点击——先 toggle 关掉。
  await page.getByTestId("board-stats-open").click();
  await expect(page.getByTestId("board-stats-panel")).toBeHidden();

  // reskin(issue #468): 该入口收进 Header ⋯More 菜单，先确保面板展开。
  if (!(await page.getByTestId("board-more-panel").isVisible())) await page.getByTestId("board-more-menu").click();
  await page.getByTestId("board-shortcuts-open").click();
  await expect(page.getByTestId("shortcuts-help-panel")).toBeVisible();
  await expect(page.getByTestId("shortcuts-help-panel")).toContainText("撤销");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("shortcuts-help-panel")).toBeHidden();

  // More 菜单开着时其遮罩会拦截 header 其余按钮——用 Esc 收起（issue #488：
  // More 面板支持 Esc 关闭，替代此前脆弱的硬编码坐标点空白）。
  if (await page.getByTestId("board-more-panel").isVisible()) {
    await page.keyboard.press("Escape");
  }
  await expect(page.getByTestId("board-more-panel")).toBeHidden();

  await page.getByTestId("timer-duration").selectOption("1");
  await page.getByTestId("timer-start").click();
  await expect(page.getByTestId("timer-status")).toHaveText("运行中");
  await page.getByTestId("timer-stop").click();
  await expect(page.getByTestId("timer-status")).toHaveText("未开始");

  // reskin(issue #468): 该入口收进 Header ⋯More 菜单，先确保面板展开。
  if (!(await page.getByTestId("board-more-panel").isVisible())) await page.getByTestId("board-more-menu").click();
  await page.getByTestId("board-meta-edit").click();
  await expect(page.getByTestId("board-meta-form")).toBeVisible();
  await expect(page.getByTestId("board-settings")).toBeVisible();

  await page.getByTestId("board-share").click();
  await expect(page.getByTestId("share-panel")).toBeVisible();
  await expect(page.getByTestId("share-visibility")).toContainText("房间成员可访问");
  await expect(page.getByTestId("share-url")).toHaveValue(`${new URL(page.url()).origin}/boards/${board.id}`);
  await page.getByTestId("share-copy").click();
  await expect(page.getByTestId("share-copy-status")).toContainText("已复制");
  await page.getByTestId("share-qr-toggle").click();
  await expect(page.getByTestId("share-qr")).toBeVisible();
});

test("viewer 在 Header 中只看到授权入口，加入后获得编辑入口", async ({ page, playwright }) => {
  const owner = await playwright.request.newContext({ baseURL: BASE_URL });
  await owner.post("/api/auth/register", {
    data: { firstName: "O", lastName: "O", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await owner.post("/api/rooms", { data: { name: "Public Header" } })).json()).room;
  const board = (await (await owner.post(`/api/rooms/${room.id}/boards`, { data: { name: "Join Header" } })).json()).board;
  await owner.patch(`/api/boards/${board.id}/visibility`, { data: { visibility: "public" } });

  await page.request.post("/api/auth/register", {
    data: { firstName: "V", lastName: "V", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.goto(`/boards/${board.id}`);

  const header = page.getByTestId("board-header");
  await expect(header.getByTestId("board-title")).toHaveText("Join Header");
  await expect(header.getByTestId("board-role")).toHaveText("viewer");
  await expect(header.getByTestId("board-share")).toBeVisible();
  await expect(header.getByTestId("join-collab")).toBeVisible();
  await expect(page.getByTestId("board-bottom-dock")).toHaveCount(0);
  await expect(header.getByTestId("board-meta-edit")).toHaveCount(0);

  await header.getByTestId("join-collab").click();
  await expect(header.getByTestId("board-role")).toHaveText("editor");
  await expect(page.getByTestId("board-bottom-dock")).toBeVisible();
  await expect(header.getByTestId("join-collab")).toHaveCount(0);

  await owner.dispose();
});
