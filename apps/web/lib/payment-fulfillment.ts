// apps/web/lib/payment-fulfillment.ts — 支付成功后的「发放」钩子（CAP-PAYMENT / F05 地基）
// F05 范围：只落地这个钩子接口 + 幂等调用点；F02（本文件 fulfillCreditPurchase 的真实实现）
// 把 credits 写进 credit_wallets，F04 把用户计划改成 pro 留给对应 feature 实现替换 TODO。
// webhook 回调路由（app/api/payment/webhook/route.ts）在订单从 pending→paid 首次成功时
// 调用一次本模块的 fulfillOrder；重复回调不会重复调用（由 markPaymentOrderPaid 的
// alreadyFulfilled 短路保证，DB 层 `WHERE status='pending'` 去重）。
import {
  findTransactionByLabel,
  getOrCreatePersonalWallet,
  getOrCreateTeamWallet,
  recordTransaction,
  type PaymentOrder,
} from "@repo/data";

export interface FulfillmentResult {
  ok: boolean;
  kind: PaymentOrder["fulfillment_kind"];
  detail: string;
}

/**
 * F02 uc-credits-002：支付成功后把 credits 记入订单归属的钱包（team_id 有值走团队钱包，
 * 否则走下单用户的个人钱包——与下单时"团队管理角色在 Team Credits 页购买"/"普通用户个人购买"
 * 的入口保持一致）。
 *
 * 幂等防双花（呼应 admin #173 的教训）：本函数是 markPaymentOrderPaid 幂等短路之后的第二层
 * 防线——即使调用方逻辑将来被改坏导致同一订单的 fulfillOrder 被调用两次，这里仍然用
 * `findTransactionByLabel` 以 orderId 编码的幂等 key 查重，命中则直接返回、不再入账。
 * label 复用 P15 F03 review 加固时定下的 "<描述> · idem:<key>" 约定。
 */
async function fulfillCreditPurchase(order: PaymentOrder): Promise<FulfillmentResult> {
  const credits = Number(order.fulfillment_payload?.credits ?? 0);
  const idemLabel = `Buy credits · idem:${order.id}`;

  const wallet = order.team_id != null
    ? await getOrCreateTeamWallet(order.team_id)
    : await getOrCreatePersonalWallet(order.user_id);

  const existing = await findTransactionByLabel(wallet.id, idemLabel);
  if (existing) {
    return { ok: true, kind: "credit_purchase", detail: `duplicate: already granted ${credits} credits (order ${order.id})` };
  }

  await recordTransaction(wallet.id, {
    kind: "purchase",
    amount: credits,
    label: idemLabel,
    description: `Credit pack purchase · order ${order.id}`,
  });

  return { ok: true, kind: "credit_purchase", detail: `granted ${credits} credits` };
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
