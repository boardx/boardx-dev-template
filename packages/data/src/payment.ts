// packages/data/src/payment.ts — CAP-PAYMENT 支付订单仓储（F05）
// payment_orders：下单 → 二维码展示 → 轮询 → webhook 回调确认 → 幂等发放。
// 被 F02（购买 Credit）、F04（升级 Pro）共用；本层只管订单生命周期 + 幂等标记，
// 具体发放逻辑（加 Credit / 升级计划）由调用方通过 fulfillIfNeeded 的回调函数注入。
import { query } from "./index";

export type FulfillmentKind = "credit_purchase" | "plan_upgrade";
export type PaymentOrderStatus = "pending" | "paid" | "failed" | "expired";

export interface PaymentOrder {
  id: string;
  user_id: number;
  team_id: number | null;
  fulfillment_kind: FulfillmentKind;
  fulfillment_payload: Record<string, unknown>;
  amount_cents: number;
  currency: string;
  status: PaymentOrderStatus;
  qr_payload: string;
  fulfilled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentOrderInput {
  id: string;
  userId: number;
  teamId?: number | null;
  fulfillmentKind: FulfillmentKind;
  fulfillmentPayload: Record<string, unknown>;
  amountCents: number;
  currency?: string;
  qrPayload: string;
}

export async function createPaymentOrder(input: CreatePaymentOrderInput): Promise<PaymentOrder> {
  const rows = await query<PaymentOrder>(
    `INSERT INTO payment_orders
       (id, user_id, team_id, fulfillment_kind, fulfillment_payload, amount_cents, currency, qr_payload)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
     RETURNING id, user_id, team_id, fulfillment_kind, fulfillment_payload, amount_cents, currency,
               status, qr_payload, fulfilled_at, created_at, updated_at`,
    [
      input.id,
      input.userId,
      input.teamId ?? null,
      input.fulfillmentKind,
      JSON.stringify(input.fulfillmentPayload ?? {}),
      input.amountCents,
      input.currency ?? "USD",
      input.qrPayload,
    ]
  );
  return rows[0]!;
}

export async function getPaymentOrder(id: string): Promise<PaymentOrder | undefined> {
  const rows = await query<PaymentOrder>(
    `SELECT id, user_id, team_id, fulfillment_kind, fulfillment_payload, amount_cents, currency,
            status, qr_payload, fulfilled_at, created_at, updated_at
     FROM payment_orders WHERE id = $1`,
    [id]
  );
  return rows[0];
}

/**
 * 标记订单为已支付（webhook 回调入口）。幂等：
 * - 已是 paid（fulfilled_at 非空）→ 直接返回当前行，不重复更新，调用方据此跳过发放。
 * - pending → paid，返回更新后的行，调用方据此触发一次发放。
 * 用 `status = 'pending'` 作为 WHERE 条件保证并发回调只有一次成功写入（数据库层去重）。
 */
export async function markPaymentOrderPaid(id: string): Promise<{
  order: PaymentOrder | undefined;
  alreadyFulfilled: boolean;
}> {
  const updated = await query<PaymentOrder>(
    `UPDATE payment_orders
     SET status = 'paid', fulfilled_at = now(), updated_at = now()
     WHERE id = $1 AND status = 'pending'
     RETURNING id, user_id, team_id, fulfillment_kind, fulfillment_payload, amount_cents, currency,
               status, qr_payload, fulfilled_at, created_at, updated_at`,
    [id]
  );
  if (updated[0]) {
    return { order: updated[0], alreadyFulfilled: false };
  }
  // 未更新到行：要么订单不存在，要么已是 paid/failed/expired。查出来告知调用方“已处理过”。
  const existing = await getPaymentOrder(id);
  return { order: existing, alreadyFulfilled: true };
}

export async function markPaymentOrderFailed(id: string): Promise<PaymentOrder | undefined> {
  const rows = await query<PaymentOrder>(
    `UPDATE payment_orders
     SET status = 'failed', updated_at = now()
     WHERE id = $1 AND status = 'pending'
     RETURNING id, user_id, team_id, fulfillment_kind, fulfillment_payload, amount_cents, currency,
               status, qr_payload, fulfilled_at, created_at, updated_at`,
    [id]
  );
  return rows[0];
}
