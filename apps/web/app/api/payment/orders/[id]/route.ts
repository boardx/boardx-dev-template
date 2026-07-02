import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { getPaymentOrder } from "@repo/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-billing-002-scan-payment — 前端轮询订单状态。
// GET /api/payment/orders/:id：返回订单当前状态（pending|paid|failed|expired）。
// 只允许订单归属用户查询，防止越权探测他人订单状态。

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const order = await getPaymentOrder(params.id);
  if (!order) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (order.user_id !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ order });
}
