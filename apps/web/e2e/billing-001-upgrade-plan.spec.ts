import { test, expect } from "@playwright/test";
import { WEBHOOK_SECRET_HEADER } from "../lib/webhook-auth";
import { E2E_WEBHOOK_SECRET } from "../playwright.config";

const uniq = () => `bl_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  const res = await page.request.post("/api/auth/register", {
    data: { firstName: "Ada", lastName: "Lovelace", email: uniq(), password: "secret123", agreeTerms: true },
  });
  expect(res.status()).toBe(201);
}

function webhookHeaders() {
  return { [WEBHOOK_SECRET_HEADER]: E2E_WEBHOOK_SECRET };
}

test("已登录访问 /billing：展示当前计划 + 可升级计划 + 升级 CTA", async ({ page }) => {
  await register(page);

  await page.goto("/billing");

  // 当前计划区可见（默认 free）
  await expect(page.getByTestId("current-plan")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("current-plan")).toContainText("Free");

  // 计划列表 + 升级 CTA 可见
  await expect(page.getByTestId("plan-list")).toBeVisible();
  await expect(page.getByTestId("plan-pro")).toBeVisible();
  await expect(page.getByTestId("upgrade-pro")).toBeVisible();
  await expect(page.getByTestId("upgrade-pro")).toContainText("Upgrade");
});

test("升级 Pro：创建 plan_upgrade 订单，支付成功后账号计划更新", async ({ page }) => {
  await register(page);
  await page.goto("/billing");

  await page.getByTestId("upgrade-pro").click({ timeout: 30_000 });
  await expect(page.getByTestId("billing-upgrade-order")).toBeVisible();
  await expect(page.getByTestId("billing-upgrade-qr")).toBeVisible();

  const orderIdText = await page.getByTestId("billing-upgrade-order-id").innerText();
  const orderId = orderIdText.replace("Order:", "").trim();
  await page.request.post("/api/payment/webhook", {
    headers: webhookHeaders(),
    data: { orderId, event: "payment.succeeded" },
  });

  await expect(page.getByTestId("billing-upgrade-paid")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("current-plan")).toContainText("Pro");

  const billing = await page.request.get("/api/billing");
  expect((await billing.json()).currentPlanId).toBe("pro");
});

test("用户菜单可打开计划弹窗；credits 模式进入购买 Credit 流程", async ({ page }) => {
  await register(page);
  await page.goto("/");

  await page.getByRole("button", { name: "账号菜单" }).click();
  await page.getByTestId("user-menu-billing").click();

  await expect(page.getByTestId("billing-plan-dialog")).toBeVisible();
  await expect(page.getByTestId("billing-dialog-current-plan")).toContainText("Free", { timeout: 30_000 });
  await expect(page.getByTestId("billing-dialog-upgrade-pro")).toBeVisible();

  await page.getByTestId("billing-mode-credits").click();
  await expect(page.getByTestId("buy-credits-dialog")).toBeVisible();
  await expect(page.getByTestId("credit-packs")).toBeVisible();
  await page.getByTestId("pack-credits_5000").click();
  await page.getByTestId("generate-qr").click();
  await expect(page.getByTestId("payment-qr")).toBeVisible();
});

test("AVA 常驻额度提示横幅：点击 Upgrade 按钮可打开计划弹窗（横幅为静态常驻展示，非额度不足触发）", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  // 横幅是无条件常驻渲染的静态 UI，与账号真实额度余额无关，这里不模拟/断言任何额度不足状态
  await expect(page.getByTestId("ai-low-credits-prompt")).toBeVisible();
  await page.getByTestId("ai-low-credits-open-billing").click();
  await expect(page.getByTestId("billing-plan-dialog")).toBeVisible();
});

test("关闭计划弹窗不改变计划", async ({ page }) => {
  await register(page);
  await page.goto("/");
  await page.getByRole("button", { name: "账号菜单" }).click();
  await page.getByTestId("user-menu-billing").click();
  await expect(page.getByTestId("billing-plan-dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close Plans & Billing" }).click();

  const billing = await page.request.get("/api/billing");
  expect(billing.status()).toBe(200);
  expect((await billing.json()).currentPlanId).toBe("free");
});

test("未登录访问 /billing → 跳转登录", async ({ page }) => {
  await page.goto("/billing");
  await expect(page).toHaveURL(/\/login/);
});

test("API：未登录 GET /api/billing 返回 401", async ({ page }) => {
  const res = await page.request.get("/api/billing");
  expect(res.status()).toBe(401);
});
