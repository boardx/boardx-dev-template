// apps/web/lib/payment-catalog.ts — CAP-PAYMENT 服务端价目表（F05 安全修复）
// 安全动机（security review on PR #147）：下单金额与发放数量绝不能由客户端自行传入——
// 否则客户端可以自己拼一个 { amountCents: 1, fulfillmentPayload: { credits: 9999999 } }，
// 花一分钱换任意数量的 credit / 任意计划。客户端只允许传一个目录 sku/planId，
// 具体的价格与发放数量一律由服务端按本文件的固定表查出来，两者绑定、不可拆开传。
//
// F02/F04 要上新套餐/新计划时，改这张表就行，不用碰下单/webhook 的路由逻辑。

export interface CreditPackSku {
  kind: "credit_purchase";
  sku: string;
  amountCents: number;
  credits: number;
  label: string;
}

export interface PlanSku {
  kind: "plan_upgrade";
  sku: string;
  amountCents: number;
  planId: string;
  label: string;
}

export type CatalogEntry = CreditPackSku | PlanSku;

const CATALOG: readonly CatalogEntry[] = [
  { kind: "credit_purchase", sku: "credits_1000", amountCents: 199, credits: 1000, label: "1,000 credits" },
  { kind: "credit_purchase", sku: "credits_5000", amountCents: 899, credits: 5000, label: "5,000 credits" },
  { kind: "credit_purchase", sku: "credits_12000", amountCents: 1999, credits: 12000, label: "12,000 credits" },
  { kind: "plan_upgrade", sku: "plan_pro_monthly", amountCents: 1200, planId: "pro", label: "Pro（月付）" },
] as const;

/** 按 sku 查目录项；找不到返回 undefined（调用方应 400）。 */
export function findCatalogEntry(sku: string): CatalogEntry | undefined {
  return CATALOG.find((e) => e.sku === sku);
}

/** 供前端渲染套餐列表用（只读，不暴露内部结构以外的字段）。 */
export function listCatalog(): readonly CatalogEntry[] {
  return CATALOG;
}
