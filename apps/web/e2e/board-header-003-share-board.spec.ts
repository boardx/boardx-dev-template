import { test, expect } from "@playwright/test";

const uniq = () => `bsh_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

// uc-board-header-003-share-board：在板页 Header 打开分享面板，
// 面板展示复制链接 + 可见性说明 + 二维码占位；复制链接可用。
test("板页 Header 打开分享面板：复制链接 + 可见性 + 二维码占位", async ({ page, context }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "S", lastName: "H", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (
    await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "ShareBoard" } })).json()
  ).board;

  // 允许 clipboard 写入
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  await page.goto(`/boards/${board.id}`);

  // 现有 Header 行为完好
  await expect(page.getByTestId("board-header")).toBeVisible();
  await expect(page.getByTestId("board-title")).toHaveText("ShareBoard");
  await expect(page.getByTestId("board-role")).toBeVisible();

  // 面板默认不展示，点 Share 打开
  await expect(page.getByTestId("share-panel")).toHaveCount(0);
  await page.getByTestId("board-share").click();
  await expect(page.getByTestId("share-panel")).toBeVisible();

  // 可见性说明（默认 room → 房间成员可访问）
  await expect(page.getByTestId("share-visibility")).toContainText("房间成员可访问");

  // 分享链接 = 当前地址栏（issue #584：地址栏此时已规范化到 public_id 形式）
  await expect(page.getByTestId("share-url")).toHaveValue(page.url());

  // 复制链接：写入剪贴板 + 成功提示
  await page.getByTestId("share-copy").click();
  await expect(page.getByTestId("share-copy-status")).toContainText("已复制");
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toBe(page.url());

  // 二维码占位：默认收起，点击展开
  await expect(page.getByTestId("share-qr")).toHaveCount(0);
  await page.getByTestId("share-qr-toggle").click();
  await expect(page.getByTestId("share-qr")).toBeVisible();

  // 关闭面板
  await page.getByTestId("board-share").click();
  await expect(page.getByTestId("share-panel")).toHaveCount(0);
});
