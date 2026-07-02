// apps/web/lib/payment-fulfillment.ts — 支付成功后的「发放」钩子（CAP-PAYMENT / F05 地基）
// F05 范围：只落地这个钩子接口 + 幂等调用点，真正把 credits 写进 credit_wallets（F02）
// 或把用户计划改成 pro（F04）留给对应 feature 实现替换 fulfillCredit* 里面的 TODO。
// webhook 回调路由（app/api/payment/webhook/route.ts）在订单从 pending→paid 首次成功时
// 调用一次本模块的 fulfillOrder；重复回调不会重复调用（由 markPaymentOrderPaid 的
// alreadyFulfilled 短路保证）。
import type { PaymentOrder } from "@repo/data";

export interface FulfillmentResult {
  ok: boolean;
  kind: PaymentOrder["fulfillment_kind"];
  detail: string;
}

/** F02 将在此接入：调用 credit_wallets 仓储把 credits 加到订单归属用户/团队。 */
async function fulfillCreditPurchase(order: PaymentOrder): Promise<FulfillmentResult> {
  const credits = Number(order.fulfillment_payload?.credits ?? 0);
  // TODO(F02): await addCreditsToWallet({ userId: order.user_id, teamId: order.team_id, amount: credits, orderId: order.id })
  return { ok: true, kind: "credit_purchase", detail: `stub: would grant ${credits} credits` };
}

/** F04 将在此接入：调用用户/计划仓储把账号计划升级为 order.fulfillment_payload.planId。 */
async function fulfillPlanUpgrade(order: PaymentOrder): Promise<FulfillmentResult> {
  const planId = String(order.fulfillment_payload?.planId ?? "pro");
  // TODO(F04): await upgradeUserPlan({ userId: order.user_id, planId })
  return { ok: true, kind: "plan_upgrade", detail: `stub: would upgrade user ${order.user_id} to ${planId}` };
}

/** 按订单的 fulfillment_kind 分发到对应发放逻辑。调用方需自行保证幂等（只在首次 paid 时调用）。 */
export async function fulfillOrder(order: PaymentOrder): Promise<FulfillmentResult> {
  switch (order.fulfillment_kind) {
    case "credit_purchase":
      return fulfillCreditPurchase(order);
    case "plan_upgrade":
      return fulfillPlanUpgrade(order);
    default:
      return { ok: false, kind: order.fulfillment_kind, detail: "unknown fulfillment_kind" };
  }
}
