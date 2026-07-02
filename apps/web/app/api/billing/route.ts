import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { listCatalog } from "@/lib/payment-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-billing-001-upgrade-plan — 计划/订阅（subscription 计费模式）。
export type PlanId = "free" | "pro";

export interface Plan {
  id: PlanId;
  name: string;
  price: string;
  description: string;
  features: string[];
  /** 升级到该计划的 CTA 文案；当前计划无 CTA。 */
  cta?: string;
  sku?: string;
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    description: "适合个人体验 BoardX 的基础能力。",
    features: ["3 个房间", "基础 AI 额度", "社区支持"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$12/mo",
    description: "面向高频协作的个人专业版。",
    features: ["无限房间", "更高 AI 额度", "优先支持", "导出与版本历史"],
    cta: "Upgrade to Pro",
    sku: "plan_pro_monthly",
  },
];

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const currentPlanId: PlanId = user.plan_id === "pro" ? "pro" : "free";
  const creditPacks = listCatalog()
    .filter((entry) => entry.kind === "credit_purchase")
    .map((entry) => ({
      sku: entry.sku,
      label: entry.label,
      amountCents: entry.amountCents,
      credits: entry.credits,
    }));

  return NextResponse.json({
    billingMode: "subscription",
    currentPlanId,
    plans: PLANS,
    checkoutSku: "plan_pro_monthly",
    manageUrl: "/billing?manage=subscription",
    creditPacks,
  });
}
