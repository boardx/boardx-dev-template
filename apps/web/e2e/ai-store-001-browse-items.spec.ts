import { test, expect } from "@playwright/test";

const uniq = () => `as_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

test("未登录访问 /ai-store 重定向到 /login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/ai-store");
  await expect(page).toHaveURL(/\/login/);
});

test("登录后浏览：submenu 分类 + 内容网格", async ({ page }) => {
  await register(page);
  await page.goto("/ai-store");

  // 左侧 AI 商店菜单：Browsing(Explore/Subscribe) + Creation(Create/Authorized/Shared)
  await expect(page.getByTestId("store-submenu")).toBeVisible();
  await expect(page.getByTestId("nav-explore")).toBeVisible();
  await expect(page.getByTestId("nav-subscribe")).toBeVisible();
  await expect(page.getByTestId("nav-authorized")).toBeVisible();

  // 右侧内容网格（默认 Explore）
  await expect(page.getByTestId("item-grid")).toBeVisible();
  await expect(page.getByTestId("type-tabs")).toBeVisible();
  // 样本含 Research Agent
  await expect(page.getByTestId("item-grid")).toContainText("Research Agent");
});

test("类型筛选只显示该类型，并在页面上下文生效", async ({ page }) => {
  await register(page);
  await page.goto("/ai-store");
  await expect(page.getByTestId("item-grid")).toBeVisible();

  await page.getByTestId("type-template").click();
  await expect(page.getByTestId("type-template")).toHaveAttribute("aria-pressed", "true");
  const grid = page.getByTestId("item-grid");
  await expect(grid).toContainText("Retro Template");
  // Agent 类型项不应再出现
  await expect(grid).not.toContainText("Research Agent");
});

test("搜索按名称/描述收窄列表", async ({ page }) => {
  await register(page);
  await page.goto("/ai-store");
  await expect(page.getByTestId("item-grid")).toBeVisible();

  await page.getByTestId("store-search").fill("Translate");
  await page.getByTestId("store-search").press("Enter");
  const grid = page.getByTestId("item-grid");
  await expect(grid).toContainText("Translate");
  await expect(grid).not.toContainText("Research Agent");
});

test("无匹配结果显示空状态 + 清空筛选入口", async ({ page }) => {
  await register(page);
  await page.goto("/ai-store");
  await expect(page.getByTestId("item-grid")).toBeVisible();

  await page.getByTestId("store-search").fill("zzzz-no-match-xyz");
  await page.getByTestId("store-search").press("Enter");
  await expect(page.getByTestId("empty")).toBeVisible();
  await expect(page.getByTestId("empty-clear")).toBeVisible();

  // 清空后恢复列表
  await page.getByTestId("empty-clear").click();
  await expect(page.getByTestId("item-grid")).toBeVisible();
});

test("标签筛选高亮并显示 filters active，Clear all 复位", async ({ page }) => {
  await register(page);
  await page.goto("/ai-store");
  await expect(page.getByTestId("item-grid")).toBeVisible();

  await page.getByTestId("tag-writing").click();
  await expect(page.getByTestId("tag-writing")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("filters-active")).toBeVisible();
  await expect(page.getByTestId("item-grid")).toContainText("Summarize");

  await page.getByTestId("clear-filters").click();
  await expect(page.getByTestId("tag-writing")).toHaveAttribute("aria-pressed", "false");
});
