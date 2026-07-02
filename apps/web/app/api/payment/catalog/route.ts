import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { listCatalog } from "@/lib/payment-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-credits-002-purchase-credits —— Buy Credits 弹窗的套餐列表来源。
// GET /api/payment/catalog?kind=credit_purchase：只返回 credit_purchase 类目（过滤掉
// F04 的 plan_upgrade 目录项，本 feature 不展示订阅计划）。价格/发放数量只读，来自
// 服务端固定表（apps/web/lib/payment-catalog.ts）；下单时仍然只认 sku，不接受这里
// 回显的字段被客户端篡改后原样传回。

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");

  const entries = listCatalog().filter((e) => (kind ? e.kind === kind : true));
  const packs = entries
    .filter((e): e is Extract<typeof e, { kind: "credit_purchase" }> => e.kind === "credit_purchase")
    .map((e) => ({ sku: e.sku, amountCents: e.amountCents, credits: e.credits, label: e.label }));

  return NextResponse.json({ packs });
}
