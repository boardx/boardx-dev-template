// p7:F08（uc-board-header-007）：白板备份与恢复
// 覆盖：创建备份→列表可见；添加新 item→恢复旧备份→items 回到备份时刻（REST 断言）；
// viewer 无备份入口 + 备份 API 403。
import { test, expect, type APIRequestContext } from "@playwright/test";

const uniq = () => `bk_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

async function newUser(playwright: any): Promise<APIRequestContext> {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email: uniq(), password: "secret123", agreeTerms: true },
  });
  return ctx;
}

async function makeBoard(req: APIRequestContext | any, name = "B") {
  const room = (await (await req.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await req.post(`/api/rooms/${room.id}/boards`, { data: { name } })).json()).board;
  return { room, board };
}

async function addNote(req: APIRequestContext | any, boardId: number | string, text: string) {
  const res = await req.post(`/api/boards/${boardId}/items`, {
    data: { type: "note", x: 10, y: 10, text },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).item;
}

async function listItems(req: APIRequestContext | any, boardId: number | string) {
  const res = await req.get(`/api/boards/${boardId}/items`);
  expect(res.status()).toBe(200);
  return (await res.json()).items as Array<{ id: string; text: string }>;
}

test("API：创建备份→列表可见；恢复后 items 回到备份时刻（保留原 id）", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const { board } = await makeBoard(page.request);

  // 备份时刻状态：一个 note
  const itemA = await addNote(page.request, board.id, "before-backup");

  // 创建备份
  const createRes = await page.request.post(`/api/boards/${board.id}/backups`, {
    data: { label: "v1" },
  });
  expect(createRes.status()).toBe(201);
  const { backup } = await createRes.json();
  expect(backup.label).toBe("v1");

  // 列表可见
  const list = (await (await page.request.get(`/api/boards/${board.id}/backups`)).json()).backups;
  expect(list.length).toBe(1);
  expect(list[0].label).toBe("v1");

  // 备份后添加新 item → 当前有 2 个
  await addNote(page.request, board.id, "after-backup");
  expect((await listItems(page.request, board.id)).length).toBe(2);

  // 恢复 → 回到备份时刻：只剩 itemA，且原 id 保留
  const restoreRes = await page.request.post(`/api/boards/${board.id}/backups/${backup.id}/restore`);
  expect(restoreRes.status()).toBe(200);
  const items = await listItems(page.request, board.id);
  expect(items.length).toBe(1);
  expect(items[0]!.id).toBe(itemA.id);
  expect(items[0]!.text).toBe("before-backup");

  // 空 label → 400
  const bad = await page.request.post(`/api/boards/${board.id}/backups`, { data: { label: "  " } });
  expect(bad.status()).toBe(400);

  // 不属于该 board 的 backupId → 404
  const { board: other } = await makeBoard(page.request, "Other");
  const wrong = await page.request.post(`/api/boards/${other.id}/backups/${backup.id}/restore`);
  expect(wrong.status()).toBe(404);
});

test("UI：备份面板创建备份→列表可见→行内确认恢复→items 回到备份状态", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const { board } = await makeBoard(page.request, "BackupUI");
  const itemA = await addNote(page.request, board.id, "keep-me");

  await page.goto(`/boards/${board.id}`);
  await expect(page.getByTestId("board-header")).toBeVisible();

  // 打开备份面板：空状态
  await page.getByTestId("board-backup").click();
  await expect(page.getByTestId("backup-panel")).toBeVisible();
  await expect(page.getByTestId("backup-empty")).toBeVisible();

  // 创建备份
  await page.getByTestId("backup-label").fill("快照一");
  await page.getByTestId("backup-create").click();
  await expect(page.getByTestId("backup-msg")).toContainText("备份已创建");
  await expect(page.getByTestId("backup-list")).toContainText("快照一");

  // 备份后新增一个 item（模拟白板被改动）
  await addNote(page.request, board.id, "added-later");
  expect((await listItems(page.request, board.id)).length).toBe(2);

  // 恢复：先出行内二次确认，再确认
  const backupId = (
    await (await page.request.get(`/api/boards/${board.id}/backups`)).json()
  ).backups[0].id;
  await page.getByTestId(`backup-restore-${backupId}`).click();
  await expect(page.getByTestId("restore-confirm-text")).toBeVisible();
  await page.getByTestId(`backup-restore-confirm-${backupId}`).click();
  await expect(page.getByTestId("backup-msg")).toContainText("恢复成功");

  // REST 断言：items 回到备份时刻
  const items = await listItems(page.request, board.id);
  expect(items.length).toBe(1);
  expect(items[0]!.id).toBe(itemA.id);
  expect(items[0]!.text).toBe("keep-me");
});

test("viewer：无备份入口，备份 API 一律 403", async ({ playwright, browser }) => {
  const owner = await newUser(playwright);
  const { board } = await makeBoard(owner, "ViewerNo");
  await owner.patch(`/api/boards/${board.id}/visibility`, { data: { visibility: "public" } });
  const backup = (
    await (await owner.post(`/api/boards/${board.id}/backups`, { data: { label: "v1" } })).json()
  ).backup;

  // 已登录非成员（public 白板下是 viewer，无管理权限）
  const viewer = await newUser(playwright);
  expect((await (await viewer.get(`/api/boards/${board.id}`)).json()).role).toBe("viewer");
  expect((await viewer.get(`/api/boards/${board.id}/backups`)).status()).toBe(403);
  expect((await viewer.post(`/api/boards/${board.id}/backups`, { data: { label: "x" } })).status()).toBe(403);
  expect((await viewer.post(`/api/boards/${board.id}/backups/${backup.id}/restore`)).status()).toBe(403);

  // UI：viewer 页面不显示备份入口
  const viewerPage = await (await browser.newContext({ baseURL: BASE_URL })).newPage();
  await viewerPage.request.post("/api/auth/register", {
    data: { firstName: "V", lastName: "V", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await viewerPage.goto(`/boards/${board.id}`);
  await expect(viewerPage.getByTestId("board-header")).toBeVisible();
  await expect(viewerPage.getByTestId("board-backup")).toHaveCount(0);

  await owner.dispose();
  await viewer.dispose();
  await viewerPage.context().close();
});
