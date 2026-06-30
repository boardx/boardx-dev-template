import { test, expect } from "@playwright/test";

// uc-credits-001-view-wallet —— 完成契约（TDD）。
// 覆盖：登录后 /credits 展示钱包余额 + 积分记录列表；空状态；未登录跳 /login。

const uniq = () => `cr_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

test("登录后 /credits 展示钱包余额 + 标题 + Buy credits", async ({ page }) => {
  await register(page);
  await page.goto("/credits");

  await expect(page.getByTestId("credits-title")).toHaveText("Credits");
  await expect(page.getByTestId("buy-credits")).toBeVisible();

  // 摘要卡片 + 当前余额（样例钱包余额 12,400）。
  await expect(page.getByTestId("wallet-summary")).toBeVisible();
  await expect(page.getByTestId("balance")).toContainText("12,400");
  await expect(page.getByTestId("wallet-summary")).toContainText("Current balance");
});

test("登录后 /credits 默认 Usage 标签展示消耗记录列表", async ({ page }) => {
  await register(page);
  await page.goto("/credits");

  // 默认 Usage：有记录列表，且不显示空状态。
  await expect(page.getByTestId("records")).toBeVisible();
  await expect(page.getByTestId("empty")).toHaveCount(0);

  // 切到 Purchase 标签后仍展示记录（购买/授予流水）。
  await page.getByTestId("tab-purchase").click();
  await expect(page.getByTestId("records")).toBeVisible();
});

test("无记录时 /credits?state=empty 展示空状态", async ({ page }) => {
  await register(page);
  await page.goto("/credits?state=empty");

  // 余额为 0，记录列表为空 → 展示空状态。
  await expect(page.getByTestId("balance")).toContainText("Current balance");
  await expect(page.getByTestId("empty")).toBeVisible();
  await expect(page.getByTestId("records")).toHaveCount(0);
});

test("未登录访问 /credits → 跳登录", async ({ page }) => {
  await page.goto("/credits");
  await expect(page).toHaveURL(/\/login/);
});

test("未登录调用 /api/credits → 401", async ({ page }) => {
  const res = await page.request.get("/api/credits");
  expect(res.status()).toBe(401);
});
