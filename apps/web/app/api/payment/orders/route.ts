import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { currentUser } from "@/lib/session";
import { renderQrDataUri } from "@/lib/qr";
import { createPaymentOrder, type FulfillmentKind } from "@repo/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-billing-002-scan-payment — CAP-PAYMENT 下单。
// POST /api/payment/orders：创建一个待支付订单（pending）+ 生成扫码支付用的二维码。
// 被 F02（credit_purchase）、F04（plan_upgrade）共用；本 feature 只建地基，
// 不做真实支付网关对接（stub 网关，webhook 见 app/api/payment/webhook/route.ts）。

interface CreateOrderBody {
  fulfillmentKind?: FulfillmentKind;
  amountCents?: number;
  currency?: string;
  teamId?: number | null;
  // 发放所需参数（如 { credits: 5000 } 或 { planId: "pro" }）
  fulfillmentPayload?: Record<string, unknown>;
}

const VALID_KINDS: FulfillmentKind[] = ["credit_purchase", "plan_upgrade"];

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let body: CreateOrderBody;
  try {
    body = (await req.json()) as CreateOrderBody;
  } catch {
    body = {};
  }

  const fulfillmentKind = body.fulfillmentKind;
  if (!fulfillmentKind || !VALID_KINDS.includes(fulfillmentKind)) {
    return NextResponse.json(
      { error: `fulfillmentKind 必须是 ${VALID_KINDS.join(" | ")} 之一` },
      { status: 400 }
    );
  }

  const amountCents = Number(body.amountCents);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: "amountCents 必须是正整数" }, { status: 400 });
  }

  const id = `pay_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  // 二维码内容：stub 支付网关约定的扫码串（真实网关会返回其自身的 code_url，这里自包含订单号即可）。
  const qrPayload = `boardx-pay://order/${id}?amount=${amountCents}&currency=${body.currency ?? "USD"}`;

  const order = await createPaymentOrder({
    id,
    userId: user.id,
    teamId: body.teamId ?? null,
    fulfillmentKind,
    fulfillmentPayload: body.fulfillmentPayload ?? {},
    amountCents,
    currency: body.currency ?? "USD",
    qrPayload,
  });

  return NextResponse.json(
    {
      order,
      qrDataUri: renderQrDataUri(qrPayload),
    },
    { status: 201 }
  );
}
