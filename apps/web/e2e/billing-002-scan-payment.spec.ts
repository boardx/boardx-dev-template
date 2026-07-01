import { test, expect } from "@playwright/test";

// uc-billing-002-scan-payment —— 完成契约（TDD）。
// 覆盖：下单生成二维码 + 轮询展示 pending → 外部支付网关 webhook 回调（stub 模拟扫码付款）
// → 订单变 paid + 触发发放钩子；重复回调幂等；未登录 401；失败回调不触发发放。

const uniq = () => `pay_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Grace", lastName: "Hopper", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

test("下单：POST /api/payment/orders 创建 pending 订单 + 返回二维码", async ({ page }) => {
  await register(page);

  const res = await page.request.post("/api/payment/orders", {
    data: {
      fulfillmentKind: "credit_purchase",
      amountCents: 999,
      currency: "USD",
      fulfillmentPayload: { credits: 5000 },
    },
  });
  expect(res.status()).toBe(201);
  const data = await res.json();
  expect(data.order.status).toBe("pending");
  expect(data.order.fulfillment_kind).toBe("credit_purchase");
  expect(typeof data.order.id).toBe("string");
  expect(data.qrDataUri).toContain("data:image/svg+xml;base64,");
});

test("轮询：GET /api/payment/orders/:id 返回当前状态", async ({ page }) => {
  await register(page);

  const createRes = await page.request.post("/api/payment/orders", {
    data: { fulfillmentKind: "plan_upgrade", amountCents: 1200, fulfillmentPayload: { planId: "pro" } },
  });
  const { order } = await createRes.json();

  const pollRes = await page.request.get(`/api/payment/orders/${order.id}`);
  expect(pollRes.status()).toBe(200);
  const pollData = await pollRes.json();
  expect(pollData.order.id).toBe(order.id);
  expect(pollData.order.status).toBe("pending");
});

test("回调成功：webhook payment.succeeded 让订单变 paid 并触发发放", async ({ page }) => {
  await register(page);

  const createRes = await page.request.post("/api/payment/orders", {
    data: { fulfillmentKind: "credit_purchase", amountCents: 500, fulfillmentPayload: { credits: 2000 } },
  });
  const { order } = await createRes.json();

  const webhookRes = await page.request.post("/api/payment/webhook", {
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
    data: { fulfillmentKind: "credit_purchase", amountCents: 500, fulfillmentPayload: { credits: 1000 } },
  });
  const { order } = await createRes.json();

  const first = await page.request.post("/api/payment/webhook", {
    data: { orderId: order.id, event: "payment.succeeded" },
  });
  expect((await first.json()).duplicate).toBe(false);

  const second = await page.request.post("/api/payment/webhook", {
    data: { orderId: order.id, event: "payment.succeeded" },
  });
  const secondData = await second.json();
  expect(second.status()).toBe(200);
  expect(secondData.duplicate).toBe(true);
  expect(secondData.fulfillment).toBeNull();
  expect(secondData.order.status).toBe("paid");
});

test("回调失败：webhook payment.failed 让订单变 failed，不触发发放", async ({ page }) => {
  await register(page);

  const createRes = await page.request.post("/api/payment/orders", {
    data: { fulfillmentKind: "plan_upgrade", amountCents: 1200, fulfillmentPayload: { planId: "pro" } },
  });
  const { order } = await createRes.json();

  const webhookRes = await page.request.post("/api/payment/webhook", {
    data: { orderId: order.id, event: "payment.failed" },
  });
  expect(webhookRes.status()).toBe(200);
  const webhookData = await webhookRes.json();
  expect(webhookData.order.status).toBe("failed");
  expect(webhookData.fulfillment).toBeNull();
});

test("未登录 POST /api/payment/orders → 401", async ({ page }) => {
  const res = await page.request.post("/api/payment/orders", {
    data: { fulfillmentKind: "credit_purchase", amountCents: 500 },
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

  // 模拟外部支付网关 webhook 回调（stub，非真实网关）
  await page.request.post("/api/payment/webhook", {
    data: { orderId, event: "payment.succeeded" },
  });

  await expect(page.getByTestId("payment-success")).toBeVisible({ timeout: 15_000 });
});

test("未登录访问 /payment-test → 跳登录", async ({ page }) => {
  await page.goto("/payment-test");
  await expect(page).toHaveURL(/\/login/);
});
