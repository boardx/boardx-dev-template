import { test, expect } from "@playwright/test";

// uc-widget-menu-009 刷新组件：让用户刷新支持重新加载的组件内容。
// 可刷新组件（嵌入/资源，color:"embed" 哨兵）点击刷新 → 内容重新加载 + 可见重载信号自增；
// 不可刷新组件（普通便签）→ 刷新入口不显示，仅有禁用的「刷新暂不可用」。

const uniq = () => `rfr_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function openOwnBoard(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "R", lastName: "F", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (
    await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Refresh" } })).json()
  ).board;
  await page.goto(`/boards/${board.id}`);
  return board;
}

const items = (page: import("@playwright/test").Page) =>
  page.getByTestId("items-layer").locator('[data-testid^="item-"]');

test("可刷新组件：点击 wm-refresh → 内容重新加载，重载计数自增，保持选中", async ({ page }) => {
  await openOwnBoard(page);
  // 创建一个可刷新的嵌入组件（新建即选中）。
  await page.getByTestId("add-embed").click();
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");

  const item = items(page).first();
  await expect(item).toHaveAttribute("data-reloadable", "true");
  await expect(item).toHaveAttribute("data-reload-count", "0");

  // Widget Menu 显示刷新入口（可刷新分支）。
  await expect(page.getByTestId("wm-refresh")).toBeVisible();
  await expect(page.getByTestId("wm-refresh-unavailable")).toHaveCount(0);

  // 点击刷新 → 重载信号自增，原组件保持在画布中。
  await page.getByTestId("wm-refresh").click();
  await expect(item).toHaveAttribute("data-reload-count", "1");
  await expect(item).not.toHaveAttribute("data-refreshed-at", "");
  await expect(items(page)).toHaveCount(1); // 原组件保持

  // 可见徽标同步更新。
  const badge = page.locator('[data-testid^="widget-reloaded-"]').first();
  await expect(badge).toHaveText(/1/);

  // 再次刷新 → 计数继续自增；刷新后仍保持选中。
  await page.getByTestId("wm-refresh").click();
  await expect(item).toHaveAttribute("data-reload-count", "2");
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
});

test("不可刷新组件：普通便签不显示刷新入口，仅展示禁用的「刷新暂不可用」", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");

  const item = items(page).first();
  await expect(item).toHaveAttribute("data-reloadable", "false");

  // 类型不支持 → 无 wm-refresh，仅有禁用的 wm-refresh-unavailable。
  await expect(page.getByTestId("wm-refresh")).toHaveCount(0);
  const unavailable = page.getByTestId("wm-refresh-unavailable");
  await expect(unavailable).toBeVisible();
  await expect(unavailable).toBeDisabled();
});

test("混选：可刷新 + 不可刷新一起选 → 隐藏刷新入口（退化为不可用）", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("add-embed").click(); // 可刷新
  await page.getByTestId("add-note").click(); // 不可刷新（新建即单选）
  await expect(items(page)).toHaveCount(2);

  // Shift+点击可刷新组件，追加到当前选择 → 两个组件都选中。
  await items(page).first().click({ modifiers: ["Shift"] });
  await expect(page.getByTestId("selection-count")).toHaveText("已选 2");

  // 存在不可刷新对象 → 刷新入口不显示，仅禁用占位。
  await expect(page.getByTestId("wm-refresh")).toHaveCount(0);
  await expect(page.getByTestId("wm-refresh-unavailable")).toBeVisible();
});
