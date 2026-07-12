// p22/F01 Room 主从（master-detail）双栏布局壳（uc 见 requirements/00-overview.md 优先级0）
// 契约：/rooms 下渲染左右双栏（data-testid=rooms-two-pane）；左栏（room-list-panel）常驻
// 房间列表，切换房间左栏不消失；右栏渲染详情（复用既有五 tab）或空态。
import { test, expect, type Page } from "@playwright/test";

const uniq = (p: string) => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: Page, prefix: string): Promise<string> {
  const email = uniq(prefix);
  const res = await page.request.post("/api/auth/register", {
    data: { firstName: "U", lastName: prefix, email, password: "secret123", agreeTerms: true },
  });
  expect(res.ok()).toBe(true);
  return email;
}

async function createRoom(page: Page, name: string): Promise<number> {
  const res = await page.request.post("/api/rooms", { data: { name, visibility: "private" } });
  const d = await res.json();
  return d.room.id as number;
}

test("未选中任何房间时：双栏壳渲染，左栏房间列表 + 右栏空态", async ({ page }) => {
  await register(page, "twopane1");
  const roomA = await createRoom(page, "Alpha Room");
  const roomB = await createRoom(page, "Beta Room");

  await page.goto("/rooms");
  await expect(page.getByTestId("rooms-two-pane")).toBeVisible();
  await expect(page.getByTestId("room-list-panel")).toBeVisible();
  await expect(page.getByTestId(`room-${roomA}`)).toBeVisible();
  await expect(page.getByTestId(`room-${roomB}`)).toBeVisible();
  await expect(page.getByTestId("rooms-empty-state")).toBeVisible();
});

test("点击左栏房间：左栏不消失，右栏渲染该房间详情并高亮", async ({ page }) => {
  await register(page, "twopane2");
  const roomId = await createRoom(page, "Gamma Room");

  await page.goto("/rooms");
  await page.getByTestId(`room-${roomId}`).click();

  // 左栏依旧常驻可见（不是整页替换）。
  await expect(page.getByTestId("room-list-panel")).toBeVisible();
  await expect(page.getByTestId(`room-${roomId}`)).toHaveAttribute("data-active", "true");

  // 右栏渲染详情壳（复用既有五 tab 结构，默认落 Boards）。
  await expect(page.getByTestId("room-shell")).toBeVisible();
  await expect(page.getByTestId("room-header-name")).toHaveText("Gamma Room");
  // issue #584：左栏卡片链接直接是 public_id 形式（room-${roomId} testid 仍用数字锚定，
  // 但 href 本身已切到 public_id），不预测具体值，只断言格式正确、不是旧数字形式。
  await expect(page).toHaveURL(/\/rooms\/rm_[0-9A-Za-z]{12}\/boards$/);
});

test("切换到另一个房间：左栏高亮切换，右栏内容随之替换，不整页跳转丢失左栏", async ({ page }) => {
  await register(page, "twopane3");
  const roomA = await createRoom(page, "Room A");
  const roomB = await createRoom(page, "Room B");

  await page.goto(`/rooms/${roomA}/boards`);
  await expect(page.getByTestId(`room-${roomA}`)).toHaveAttribute("data-active", "true");

  await page.getByTestId(`room-${roomB}`).click();
  await expect(page.getByTestId("room-list-panel")).toBeVisible();
  await expect(page.getByTestId(`room-${roomB}`)).toHaveAttribute("data-active", "true");
  await expect(page.getByTestId(`room-${roomA}`)).toHaveAttribute("data-active", "false");
  await expect(page.getByTestId("room-header-name")).toHaveText("Room B");
});

test("搜索/收藏筛选：左栏功能与既有 API 语义一致（p20/F02 搜索、F05 收藏）", async ({ page }) => {
  await register(page, "twopane4");
  // 房间名带时间戳，避免与仓库里历史积累的同名房间在搜索时撞车。
  const uniqueMarker = `Searchable${Date.now()}`;
  const alpha = await createRoom(page, `${uniqueMarker} Alpha`);
  await createRoom(page, "Other Room");

  await page.goto("/rooms");
  await page.getByTestId("room-list-search").fill(uniqueMarker);
  await page.getByTestId("room-list-search").press("Enter");
  await expect(page.getByTestId(`room-${alpha}`)).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("room-list").locator("li")).toHaveCount(1, { timeout: 30000 });

  // 清空搜索，收藏 Alpha，再用 Favorites 筛选。
  await page.getByTestId("room-list-search").fill("");
  await page.getByTestId("room-list-search").press("Enter");
  await page.request.post(`/api/rooms/${alpha}/favorite`);
  await page.getByTestId("room-favorites-filter").click();
  await expect(page.getByTestId(`room-${alpha}`)).toBeVisible({ timeout: 30000 });
});
