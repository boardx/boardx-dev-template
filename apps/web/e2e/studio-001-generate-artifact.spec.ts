import { test, expect } from "@playwright/test";

const uniq = () => `st_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Stu", lastName: "Dio", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

test("已登录 /studio：显示类型 tabs + 配置表单，生成 → 生成中 → 结果", async ({ page }) => {
  await register(page);
  await page.goto("/studio");

  // 类型 tabs 与配置表单可见
  await expect(page.getByTestId("type-tabs")).toBeVisible();
  await expect(page.getByTestId("type-audio")).toBeVisible();
  await expect(page.getByTestId("type-slides")).toBeVisible();
  await expect(page.getByTestId("type-infographic")).toBeVisible();
  await expect(page.getByTestId("studio-form")).toBeVisible();

  // 初始空态
  await expect(page.getByTestId("empty")).toBeVisible();

  // 切到演示文稿，出现 slides 配置
  await page.getByTestId("type-slides").click();
  await expect(page.getByTestId("cfg-format")).toBeVisible();
  await expect(page.getByTestId("cfg-length")).toBeVisible();
  await page.getByTestId("cfg-length").selectOption("20");

  await page.getByTestId("prompt").fill("聚焦 Q3 增长");
  await page.getByTestId("generate").click();

  // 成功出口：结果写入列表，可在页面查看
  await expect(page.getByTestId("result-list")).toBeVisible();
  await expect(page.getByTestId("result-list")).toContainText("演示文稿");
  await expect(page.getByTestId("result-list")).toContainText("聚焦 Q3 增长");
});

test("信息图配置：切换类型后显示方向/详细程度并生成", async ({ page }) => {
  await register(page);
  await page.goto("/studio");
  await page.getByTestId("type-infographic").click();
  await expect(page.getByTestId("cfg-orientation")).toBeVisible();
  await expect(page.getByTestId("cfg-detail")).toBeVisible();
  await page.getByTestId("generate").click();
  await expect(page.getByTestId("result-list")).toContainText("信息图");
});

test("生成历史持久于会话：重新加载后仍可见", async ({ page }) => {
  await register(page);
  await page.goto("/studio");
  await page.getByTestId("generate").click();
  await expect(page.getByTestId("result-list")).toContainText("音频概览");
  await page.reload();
  await expect(page.getByTestId("result-list")).toContainText("音频概览");
});

test("未登录访问 /studio → 跳转登录", async ({ page }) => {
  await page.goto("/studio");
  await expect(page).toHaveURL(/\/login/);
});

test("权限分支：未登录 POST /api/studio → 401", async ({ page }) => {
  const res = await page.request.post("/api/studio", { data: { type: "audio" } });
  expect(res.status()).toBe(401);
});

test("失败分支：缺少类型 → 400 错误", async ({ page }) => {
  await register(page);
  const res = await page.request.post("/api/studio", { data: { type: "bogus" } });
  expect(res.status()).toBe(400);
});
