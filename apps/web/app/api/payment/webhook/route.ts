import { NextResponse } from "next/server";
import { markPaymentOrderFailed, markPaymentOrderPaid } from "@repo/data";
import { fulfillOrder } from "@/lib/payment-fulfillment";
import { WEBHOOK_SECRET_HEADER, verifyWebhookSecret } from "@/lib/webhook-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-billing-002-scan-payment — 支付网关回调（webhook）。
// STUB 网关：真实网关接入前，用共享密钥（WEBHOOK_SECRET，见 lib/webhook-auth.ts）代替
// 真实签名校验，fail-closed——未配置密钥或密钥不匹配一律 401，不允许任何人靠猜/枚举
// orderId 伪造"支付成功"回调（security review on PR #147 的阻塞项）。
// 测试/演示环境下用本端点模拟"用户扫码付款成功"事件（`e2e/billing-002-scan-payment.spec.ts`
// 直接 POST 到本端点、带上合法密钥模拟回调，这是本仓库既定约定——同 AI/LLM 类 feature 用
// stub provider 的方式，只是这里额外加了密钥门槛）。
// 真实网关接入时把 verifyWebhookSecret 换成网关自己的 HMAC 签名校验即可。
//
// 幂等：markPaymentOrderPaid 用 `WHERE status='pending'` 做数据库层去重；
// 重复回调（同一 orderId 收到多次 webhook）只会有一次真正触发 fulfillOrder。
//
// 契约说明（fulfillOrder 失败时的回滚边界）：当前 fulfillOrder 是 stub，不会抛错。
// 真实网关接入、fulfillOrder 换成真实发放逻辑后，若其在订单已标记 paid 之后抛错，
// 本路由目前不会把订单状态回滚回 pending——即"标记已付款"与"发放"不是一个原子事务。
// 这是有意的产品选择（钱已经真实到账，不应该因为发放侧的临时故障就退回"未付款"），
// 但发放失败必须能重试/告警，接入真实发放逻辑时请显式处理（如记录发放失败状态、
// 走异步重试队列），不要依赖"状态自动回滚"。

interface WebhookBody {
  orderId?: string;
  event?: "payment.succeeded" | "payment.failed";
}

export async function POST(req: Request) {
  if (!verifyWebhookSecret(req.headers.get(WEBHOOK_SECRET_HEADER))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = (await req.json()) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const { orderId, event } = body;
  if (!orderId || !event) {
    return NextResponse.json({ error: "orderId 和 event 必填" }, { status: 400 });
  }

  if (event === "payment.failed") {
    const order = await markPaymentOrderFailed(orderId);
    if (!order) return NextResponse.json({ error: "not found or not pending" }, { status: 404 });
    return NextResponse.json({ order, fulfillment: null });
  }

  if (event !== "payment.succeeded") {
    return NextResponse.json({ error: "unsupported event" }, { status: 400 });
  }

  const { order, alreadyFulfilled } = await markPaymentOrderPaid(orderId);
  if (!order) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (alreadyFulfilled) {
    // 重复回调：订单已是 paid（或非 pending 状态），不重复发放，直接确认收到。
    return NextResponse.json({ order, fulfillment: null, duplicate: true });
  }

  const fulfillment = await fulfillOrder(order);
  return NextResponse.json({ order, fulfillment, duplicate: false });
}
