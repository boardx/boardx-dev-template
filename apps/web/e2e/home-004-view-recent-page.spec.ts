import { test, expect } from "@playwright/test";

// uc-home-004：Recent 页展示最近访问/编辑的资源（白板）列表，可点击回到工作内容。
// 覆盖：登录后有最近资源（列表+点击跳转）、登录后空状态、未登录跳登录。

const uniq = () => `r4_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

test("登录后 Recent 展示最近白板列表并可点击回到内容", async ({ page }) => {
  await register(page);
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (
    await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Recent Doc" } })).json()
  ).board;
  // 打开一次以记录访问
  await page.request.get(`/api/boards/${board.id}`);

  await page.goto("/recent");
  await expect(page.getByTestId("recent-title")).toHaveText("Recent Activity");
  await expect(page.getByTestId("recent-list")).toContainText("Recent Doc");

  await page.getByTestId(`recent-item-${board.id}`).click();
  await expect(page).toHaveURL(new RegExp(`/boards/${board.id}`));
  await expect(page.getByTestId("board-title")).toHaveText("Recent Doc");
});

test("登录后无最近资源时显示空状态 + 进入房间入口", async ({ page }) => {
  await register(page);

  await page.goto("/recent");
  await expect(page.getByTestId("recent-title")).toHaveText("Recent Activity");
  await expect(page.getByTestId("recent-empty")).toBeVisible();

  await page.getByTestId("recent-goto-rooms").click();
  await expect(page).toHaveURL(/\/rooms/);
});

test("未登录访问 /recent → 跳登录", async ({ page }) => {
  await page.goto("/recent");
  await expect(page).toHaveURL(/\/login/);
});
