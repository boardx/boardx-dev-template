import { test, expect } from "@playwright/test";
import { WEBHOOK_SECRET_HEADER } from "../lib/webhook-auth";
import { E2E_WEBHOOK_SECRET } from "../playwright.config";

// uc-billing-002-scan-payment —— 完成契约（TDD）。
// 覆盖：下单生成二维码 + 轮询展示 pending → 外部支付网关 webhook 回调（stub 模拟扫码付款，
// 带合法共享密钥）→ 订单变 paid + 触发发放钩子；重复回调幂等；未登录 401；失败回调不触发发放；
// webhook 缺密钥/密钥错 → 401；下单金额/发放数量由服务端目录（sku）决定，客户端传自定义
// amountCents/fulfillmentPayload 不会被采纳（security review on PR #147 的两个阻塞项）。

const uniq = () => `pay_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Grace", lastName: "Hopper", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

function webhookHeaders(secret: string = E2E_WEBHOOK_SECRET) {
  return { [WEBHOOK_SECRET_HEADER]: secret };
}

test("下单：POST /api/payment/orders 按 sku 创建 pending 订单 + 返回二维码", async ({ page }) => {
  await register(page);

  const res = await page.request.post("/api/payment/orders", {
    data: { sku: "credits_5000" },
  });
  expect(res.status()).toBe(201);
  const data = await res.json();
  expect(data.order.status).toBe("pending");
  expect(data.order.fulfillment_kind).toBe("credit_purchase");
  // 金额/发放数量来自服务端目录（credits_5000 = 899 分 / 5000 credits），不是客户端传的。
  expect(data.order.amount_cents).toBe(899);
  expect(data.order.fulfillment_payload).toEqual({ credits: 5000 });
  expect(typeof data.order.id).toBe("string");
  expect(data.qrDataUri).toContain("data:image/svg+xml;base64,");
});

test("安全：客户端自定义 amountCents/fulfillmentPayload 不会被采纳，只认服务端目录", async ({ page }) => {
  await register(page);

  const res = await page.request.post("/api/payment/orders", {
    data: {
      sku: "credits_1000",
      amountCents: 1, // 想花 1 分钱……
      fulfillmentPayload: { credits: 9_999_999 }, // ……换 999 万 credits
    },
  });
  expect(res.status()).toBe(201);
  const data = await res.json();
  // 目录里 credits_1000 = 199 分 / 1000 credits，客户端的伪造字段被完全忽略。
  expect(data.order.amount_cents).toBe(199);
  expect(data.order.fulfillment_payload).toEqual({ credits: 1000 });
});

test("安全：未知/缺失 sku → 400，不创建订单", async ({ page }) => {
  await register(page);

  const res = await page.request.post("/api/payment/orders", {
    data: { sku: "does-not-exist" },
  });
  expect(res.status()).toBe(400);
});

test("轮询：GET /api/payment/orders/:id 返回当前状态", async ({ page }) => {
  await register(page);

  const createRes = await page.request.post("/api/payment/orders", {
    data: { sku: "plan_pro_monthly" },
  });
  const { order } = await createRes.json();

  const pollRes = await page.request.get(`/api/payment/orders/${order.id}`);
  expect(pollRes.status()).toBe(200);
  const pollData = await pollRes.json();
  expect(pollData.order.id).toBe(order.id);
  expect(pollData.order.status).toBe("pending");
});

test("回调成功：webhook payment.succeeded（带合法密钥）让订单变 paid 并触发发放", async ({ page }) => {
  await register(page);

  const createRes = await page.request.post("/api/payment/orders", {
    data: { sku: "credits_5000" },
  });
  const { order } = await createRes.json();

  const webhookRes = await page.request.post("/api/payment/webhook", {
    headers: webhookHeaders(),
    data: { orderId: order.id, event: "payment.succeeded" },
  });
  expect(webhookRes.status()).toBe(200);
  const webhookData = await webhookRes.json();
  expect(webhookData.order.status).toBe("paid");
  expect(webhookData.duplicate).toBe(false);
  expect(webhookData.fulfillment.ok).toBe(true);
  expect(webhookData.fulfillment.kind).toBe("credit_purchase");

  // 轮询端点也应反映为 paid（前端轮询会据此停止）
  const pollRes = await page.request.get(`/api/payment/orders/${order.id}`);
  const pollData = await pollRes.json();
  expect(pollData.order.status).toBe("paid");
});

test("回调幂等：重复 webhook 不重复触发发放", async ({ page }) => {
  await register(page);

  const createRes = await page.request.post("/api/payment/orders", {
    data: { sku: "credits_1000" },
  });
  const { order } = await createRes.json();

  const first = await page.request.post("/api/payment/webhook", {
    headers: webhookHeaders(),
    data: { orderId: order.id, event: "payment.succeeded" },
  });
  expect((await first.json()).duplicate).toBe(false);

  const second = await page.request.post("/api/payment/webhook", {
    headers: webhookHeaders(),
    data: { orderId: order.id, event: "payment.succeeded" },
  });
  const secondData = await second.json();
  expect(second.status()).toBe(200);
  expect(secondData.duplicate).toBe(true);
  expect(secondData.fulfillment).toBeNull();
  expect(secondData.order.status).toBe("paid");
});

test("回调失败：webhook payment.failed（带合法密钥）让订单变 failed，不触发发放", async ({ page }) => {
  await register(page);

  const createRes = await page.request.post("/api/payment/orders", {
    data: { sku: "plan_pro_monthly" },
  });
  const { order } = await createRes.json();

  const webhookRes = await page.request.post("/api/payment/webhook", {
    headers: webhookHeaders(),
    data: { orderId: order.id, event: "payment.failed" },
  });
  expect(webhookRes.status()).toBe(200);
  const webhookData = await webhookRes.json();
  expect(webhookData.order.status).toBe("failed");
  expect(webhookData.fulfillment).toBeNull();
});

test("安全：webhook 缺密钥 → 401，订单不变 pending", async ({ page }) => {
  await register(page);

  const createRes = await page.request.post("/api/payment/orders", {
    data: { sku: "credits_1000" },
  });
  const { order } = await createRes.json();

  const res = await page.request.post("/api/payment/webhook", {
    data: { orderId: order.id, event: "payment.succeeded" }, // 没带 x-webhook-secret
  });
  expect(res.status()).toBe(401);

  const pollRes = await page.request.get(`/api/payment/orders/${order.id}`);
  expect((await pollRes.json()).order.status).toBe("pending");
});

test("安全：webhook 密钥错误 → 401，订单不变 pending，不触发发放", async ({ page }) => {
  await register(page);

  const createRes = await page.request.post("/api/payment/orders", {
    data: { sku: "credits_1000" },
  });
  const { order } = await createRes.json();

  const res = await page.request.post("/api/payment/webhook", {
    headers: webhookHeaders("this-is-not-the-secret"),
    data: { orderId: order.id, event: "payment.succeeded" },
  });
  expect(res.status()).toBe(401);

  const pollRes = await page.request.get(`/api/payment/orders/${order.id}`);
  expect((await pollRes.json()).order.status).toBe("pending");
});

test("未登录 POST /api/payment/orders → 401", async ({ page }) => {
  const res = await page.request.post("/api/payment/orders", {
    data: { sku: "credits_1000" },
  });
  expect(res.status()).toBe(401);
});

test("UI：/payment-test 下单后展示二维码，webhook 回调后轮询显示成功", async ({ page }) => {
  await register(page);
  await page.goto("/payment-test");

  await expect(page.getByTestId("payment-test-title")).toBeVisible();
  await page.getByTestId("create-order").click();

  await expect(page.getByTestId("order-panel")).toBeVisible();
  await expect(page.getByTestId("order-status")).toContainText("pending");
  await expect(page.getByTestId("payment-qr")).toBeVisible();

  const orderIdText = await page.getByTestId("order-id").innerText();
  const orderId = orderIdText.replace("Order:", "").trim();

  // 模拟外部支付网关 webhook 回调（stub，非真实网关；带合法共享密钥）
  await page.request.post("/api/payment/webhook", {
    headers: webhookHeaders(),
    data: { orderId, event: "payment.succeeded" },
  });

  await expect(page.getByTestId("payment-success")).toBeVisible({ timeout: 15_000 });
});

test("未登录访问 /payment-test → 跳登录", async ({ page }) => {
  await page.goto("/payment-test");
  await expect(page).toHaveURL(/\/login/);
});
