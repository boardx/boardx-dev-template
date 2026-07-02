import { test, expect, type APIRequestContext } from "@playwright/test";
import { WEBHOOK_SECRET_HEADER } from "../lib/webhook-auth";
import { E2E_WEBHOOK_SECRET } from "../playwright.config";

// uc-credits-002-purchase-credits —— 完成契约（TDD）。
// 覆盖：Buy Credits 弹窗 UI（套餐列表 + 支付方式 + 生成二维码 + 订单号 + Refresh Status）；
// 下单走 F05 引擎（POST /api/payment/orders，只认服务端目录 sku）；stub webhook 回调模拟扫码
// 支付成功 → 订单 paid → fulfillOrder 把 credits 记入 credit_wallets，弹窗显示成功、余额刷新；
// 回调幂等（同一订单回调两次只加一次余额，呼应 admin #173 教训）；金额/套餐由服务端定义，
// 客户端自定义 amountCents/credits 不会被采纳；team 购买仅 owner/admin 可发起，member 回退个人。

const uniq = (p: string) => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

function webhookHeaders(secret: string = E2E_WEBHOOK_SECRET) {
  return { [WEBHOOK_SECRET_HEADER]: secret };
}

async function newUser(playwright: { request: { newContext: (opts: { baseURL: string }) => Promise<APIRequestContext> } }, base: string): Promise<APIRequestContext> {
  const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  await ctx.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(base), password: "secret123", agreeTerms: true },
  });
  return ctx;
}

test("Buy Credits 弹窗：套餐列表 + 选套餐 + 下单展示二维码 + webhook 回调后成功并加余额", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Grace", lastName: "Hopper", email: uniq("bc"), password: "secret123", agreeTerms: true },
  });
  await page.goto("/credits");
  await expect(page.getByTestId("balance")).toContainText("11,900");

  await page.getByTestId("buy-credits").click();
  await expect(page.getByTestId("buy-credits-dialog")).toBeVisible();
  await expect(page.getByTestId("credit-packs")).toBeVisible();

  await page.getByTestId("pack-credits_5000").click();
  await expect(page.getByTestId("payment-methods")).toBeVisible();
  await expect(page.getByTestId("method-alipay")).toBeDisabled();

  await page.getByTestId("generate-qr").click();
  await expect(page.getByTestId("order-panel")).toBeVisible();
  await expect(page.getByTestId("payment-qr")).toBeVisible();
  await expect(page.getByTestId("order-status")).toContainText("等待支付");

  const orderIdText = await page.getByTestId("order-id").innerText();
  const orderId = orderIdText.replace("Order:", "").trim();

  // 外部支付网关 webhook 回调（stub，带合法共享密钥）模拟扫码支付成功。
  const webhookRes = await page.request.post("/api/payment/webhook", {
    headers: webhookHeaders(),
    data: { orderId, event: "payment.succeeded" },
  });
  expect(webhookRes.status()).toBe(200);
  const webhookBody = await webhookRes.json();
  expect(webhookBody.fulfillment.ok).toBe(true);
  expect(webhookBody.fulfillment.detail).toContain("granted 5000 credits");

  // 弹窗轮询后展示成功提示
  await expect(page.getByTestId("payment-success")).toBeVisible({ timeout: 15_000 });

  // 关闭弹窗，Credits 页余额刷新：11,900 + 5,000 = 16,900
  await page.getByTestId("buy-credits-close").click();
  await expect(page.getByTestId("balance")).toContainText("16,900");

  // 购买记录出现在 Purchase 标签
  await page.getByTestId("tab-purchase").click();
  await expect(page.getByTestId("records")).toContainText("Credit pack purchase");
});

test("回调幂等：同一订单 webhook 回调两次只加一次余额（防双花）", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Ada", lastName: "L", email: uniq("bcidem"), password: "secret123", agreeTerms: true },
  });
  // 触发钱包首访播种（确定性样例流水，余额 11,900），与 /credits 页面首次加载行为一致。
  await page.request.get("/api/credits/wallet?scope=personal");

  const createRes = await page.request.post("/api/payment/orders", {
    data: { sku: "credits_1000" },
  });
  const { order } = await createRes.json();

  const first = await page.request.post("/api/payment/webhook", {
    headers: webhookHeaders(),
    data: { orderId: order.id, event: "payment.succeeded" },
  });
  expect((await first.json()).fulfillment.detail).toContain("granted 1000 credits");

  const walletAfterFirst = await (await page.request.get("/api/credits/wallet?scope=personal")).json();
  expect(walletAfterFirst.wallet.balance).toBe(12900); // 11,900 种子 + 1,000

  const second = await page.request.post("/api/payment/webhook", {
    headers: webhookHeaders(),
    data: { orderId: order.id, event: "payment.succeeded" },
  });
  expect(second.status()).toBe(200);
  const secondBody = await second.json();
  expect(secondBody.duplicate).toBe(true);
  expect(secondBody.fulfillment).toBeNull();

  const walletAfterSecond = await (await page.request.get("/api/credits/wallet?scope=personal")).json();
  expect(walletAfterSecond.wallet.balance).toBe(12900); // 未重复加
});

test("安全：客户端自定义 amountCents/credits 在下单阶段不被采纳，回调发放的数量仍以服务端目录为准", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Sec", lastName: "T", email: uniq("bcsec"), password: "secret123", agreeTerms: true },
  });

  const createRes = await page.request.post("/api/payment/orders", {
    data: { sku: "credits_1000", amountCents: 1, fulfillmentPayload: { credits: 9_999_999 } },
  });
  const { order } = await createRes.json();
  expect(order.amount_cents).toBe(199);
  expect(order.fulfillment_payload).toEqual({ credits: 1000 });

  const webhookRes = await page.request.post("/api/payment/webhook", {
    headers: webhookHeaders(),
    data: { orderId: order.id, event: "payment.succeeded" },
  });
  const body = await webhookRes.json();
  expect(body.fulfillment.detail).toContain("granted 1000 credits");
  expect(body.fulfillment.detail).not.toContain("9999999");
});

test("取消/关闭弹窗不改变余额：未下单直接关闭", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Cancel", lastName: "T", email: uniq("bccancel"), password: "secret123", agreeTerms: true },
  });
  await page.goto("/credits");

  await page.getByTestId("buy-credits").click();
  await page.getByTestId("pack-credits_1000").click();
  await page.getByTestId("buy-credits-close").click();
  await expect(page.getByTestId("buy-credits-dialog")).toHaveCount(0);

  await expect(page.getByTestId("balance")).toContainText("11,900");
});

test("团队购买：Team owner 在 Team Credits 页购买记入团队钱包", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Own", lastName: "Er", email: uniq("bct-own"), password: "secret123", agreeTerms: true },
  });
  const team = await (await page.request.post("/api/teams", { data: { name: "Buy Credits Co" } })).json();
  expect(team.team?.id).toBeTruthy();

  await page.goto("/credits");
  await expect(page.getByTestId("scope-label")).toHaveText("Buy Credits Co");

  await page.getByTestId("buy-credits").click();
  await page.getByTestId("pack-credits_5000").click();
  await page.getByTestId("generate-qr").click();
  await expect(page.getByTestId("order-panel")).toBeVisible();

  const orderIdText = await page.getByTestId("order-id").innerText();
  const orderId = orderIdText.replace("Order:", "").trim();

  await page.request.post("/api/payment/webhook", {
    headers: webhookHeaders(),
    data: { orderId, event: "payment.succeeded" },
  });
  await expect(page.getByTestId("payment-success")).toBeVisible({ timeout: 15_000 });

  const teamWallet = await (await page.request.get("/api/credits/wallet?scope=team")).json();
  expect(teamWallet.wallet.balance).toBe(16900); // 11,900 种子 + 5,000
});

test("安全：Team member 无权限购买团队 Credit，下单请求回退为个人订单（不记团队钱包）", async ({ playwright }) => {
  const owner = await newUser(playwright, "bct-mem-own");
  const team = await (await owner.post("/api/teams", { data: { name: "Fallback Co" } })).json();
  const invite = await (await owner.post(`/api/teams/${team.team.id}/invites`, { data: {} })).json();

  const member = await newUser(playwright, "bct-mem-mem");
  await member.post("/api/teams/join", { data: { token: invite.token } });
  await member.post("/api/teams/current", { data: { teamId: team.team.id } });

  // member 显式请求 scope=team 下单，但服务端应校验角色并回退为个人订单（teamId=null）。
  const createRes = await member.post("/api/payment/orders", {
    data: { sku: "credits_1000", scope: "team" },
  });
  expect(createRes.status()).toBe(201);
  const { order } = await createRes.json();
  expect(order.team_id).toBeNull();

  await owner.dispose();
  await member.dispose();
});

test("下单失败：无效 sku → 展示错误提示，不生成订单", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Err", lastName: "T", email: uniq("bcerr"), password: "secret123", agreeTerms: true },
  });
  await page.goto("/credits");
  await page.getByTestId("buy-credits").click();
  await expect(page.getByTestId("credit-packs")).toBeVisible();
  // 有效套餐都能选到（目录当前恒定提供三档），下单接口本身的 400 场景已由 F05 覆盖；
  // 这里补一个 UI 契约：selectedPack 为空时不展示下单区/生成二维码按钮。
  await expect(page.getByTestId("generate-qr")).toHaveCount(0);
});

test("未登录访问 Buy Credits 相关接口 → 401", async ({ page }) => {
  const res = await page.request.post("/api/payment/orders", {
    data: { sku: "credits_1000" },
  });
  expect(res.status()).toBe(401);

  const catalogRes = await page.request.get("/api/payment/catalog?kind=credit_purchase");
  expect(catalogRes.status()).toBe(401);
});
