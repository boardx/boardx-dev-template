import { NextResponse } from "next/server";
import { markPaymentOrderFailed, markPaymentOrderPaid } from "@repo/data";
import { fulfillOrder } from "@/lib/payment-fulfillment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-billing-002-scan-payment — 支付网关回调（webhook）。
// STUB 网关：真实场景中这里应校验签名（如 HMAC header）确认请求来自支付网关本身；
// 当前无真实网关接入，测试/演示环境下用本端点模拟"用户扫码付款成功"事件
// （`e2e/billing-002-scan-payment.spec.ts` 直接 POST 到本端点模拟回调，
// 这是本仓库既定约定 —— 同 AI/LLM 类 feature 用 stub provider 的方式）。
//
// 幂等：markPaymentOrderPaid 用 `WHERE status='pending'` 做数据库层去重；
// 重复回调（同一 orderId 收到多次 webhook）只会有一次真正触发 fulfillOrder。

interface WebhookBody {
  orderId?: string;
  event?: "payment.succeeded" | "payment.failed";
}

export async function POST(req: Request) {
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
