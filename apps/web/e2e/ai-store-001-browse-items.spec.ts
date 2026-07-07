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

test("输入后立即按 Enter 使用当前搜索词刷新网格", async ({ page }) => {
  await register(page);
  await page.goto("/ai-store");
  const grid = page.getByTestId("item-grid");
  await expect(grid).toBeVisible();
  await expect(grid).toContainText("Research Agent");

  // 用 pressSequentially 逐字符派发真实键盘事件，紧接着按 Enter——不给 React 一个
  // 独立的 Playwright action 边界去把最后一个字符的 setQ 落到下一次渲染。这是在真实
  // 复现"打完最后一个字立刻按 Enter"的窗口；用 fill() + 独立 press("Enter") 的写法
  // 两次调用之间总有足够 tick 让 state 冲刷，测不出 onKeyDown 闭包读到旧 q 的 bug。
  const search = page.getByTestId("store-search");
  await search.click();
  await search.pressSequentially(`no-match-${Date.now()}`, { delay: 0 });
  await search.press("Enter");
  await expect(page.getByTestId("empty")).toBeVisible();
  await expect(grid).toHaveCount(0);

  await search.fill("");
  await search.pressSequentially("Translate", { delay: 0 });
  await search.press("Enter");
  await expect(grid).toBeVisible();
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

test("未登录调用 GET /api/ai-store/items 返回未授权", async ({ page, request }) => {
  await page.context().clearCookies();
  const res = await request.get("/api/ai-store/items");
  expect(res.status()).toBe(401);
});

test("分页：种子数据超过一页时显示分页控件，翻页后内容更新", async ({ page }) => {
  await register(page);
  await page.goto("/ai-store");
  await expect(page.getByTestId("item-grid")).toBeVisible();

  // 12 条种子数据、默认 pageSize=9 → 应有 2 页。
  await expect(page.getByTestId("result-count")).toContainText("12");
  await expect(page.getByTestId("pagination")).toBeVisible();
  await expect(page.getByTestId("page-indicator")).toContainText("Page 1 / 2");
  await expect(page.getByTestId("page-prev")).toBeDisabled();

  const firstPageText = await page.getByTestId("item-grid").textContent();

  await page.getByTestId("page-next").click();
  await expect(page.getByTestId("page-indicator")).toContainText("Page 2 / 2");
  await expect(page.getByTestId("page-next")).toBeDisabled();
  const secondPageText = await page.getByTestId("item-grid").textContent();
  expect(secondPageText).not.toBe(firstPageText);

  await page.getByTestId("page-prev").click();
  await expect(page.getByTestId("page-indicator")).toContainText("Page 1 / 2");
});

test("点卡片打开详情弹窗：展示描述/示例/统计/订阅入口，可关闭", async ({ page }) => {
  await register(page);
  await page.goto("/ai-store");
  await expect(page.getByTestId("item-grid")).toBeVisible();

  const card = page.getByTestId("item-grid").locator('article:has-text("Research Agent")');
  await card.click();

  const modal = page.getByTestId("item-detail-modal");
  await expect(modal).toBeVisible();
  await expect(modal.getByTestId("detail-name")).toContainText("Research Agent");
  await expect(modal.getByTestId("detail-description")).toBeVisible();
  await expect(modal.getByTestId("detail-examples")).toBeVisible();
  await expect(modal.getByTestId("detail-stats")).toBeVisible();
  // 订阅入口（P11 F03）：已发布的 platform 项目可订阅，按钮可用。
  await expect(modal.getByTestId("detail-subscribe")).toBeVisible();
  await expect(modal.getByTestId("detail-subscribe")).toBeEnabled();

  await modal.getByTestId("close-detail").click();
  await expect(modal).not.toBeVisible();
});
