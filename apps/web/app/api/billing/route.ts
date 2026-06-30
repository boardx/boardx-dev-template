import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-billing-001-upgrade-plan — 计划/订阅（subscription 计费模式）。
// STUB: 不接入真实支付。当前计划默认 free（in-memory，无持久化）；
// 升级/管理订阅仅返回占位的外部支付链接，由前端在当前窗口打开。
// 支付未完成前不得提前升级计划（业务规则 3）—— 故本接口永不改写计划。

export type PlanId = "free" | "pro";

export interface Plan {
  id: PlanId;
  name: string;
  price: string;
  description: string;
  features: string[];
  /** 升级到该计划的 CTA 文案；当前计划无 CTA。 */
  cta?: string;
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
  },
];

// 当前用户计划：无支付系统，统一视为 free（占位）。
const CURRENT_PLAN_ID: PlanId = "free";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  // STUB 占位外部支付/管理链接：拼接用户邮箱与 ID，仅作演示，不跳转真实支付。
  const params = new URLSearchParams({ email: user.email, uid: String(user.id) });
  const checkoutUrl = `/api/billing/checkout?${params.toString()}`; // 占位：实际应为外部支付地址
  const manageUrl = `/api/billing/manage?${params.toString()}`; // 占位：实际应为订阅管理地址

  return NextResponse.json({
    currentPlanId: CURRENT_PLAN_ID,
    plans: PLANS,
    checkoutUrl,
    manageUrl,
    // note：本接口为 stub，不接入第三方支付/发票/税务；支付完成前不升级计划。
    note: "stub: no real payment; current plan is read-only until checkout completes",
  });
}
