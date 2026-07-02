import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { canManageTeam, CURRENT_TEAM_COOKIE } from "@repo/auth";
import { getMembership } from "@repo/data";
import { currentUser } from "@/lib/session";
import { renderQrDataUri } from "@/lib/qr";
import { findCatalogEntry } from "@/lib/payment-catalog";
import { createPaymentOrder } from "@repo/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-billing-002-scan-payment — CAP-PAYMENT 下单。
// POST /api/payment/orders：创建一个待支付订单（pending）+ 生成扫码支付用的二维码。
// 被 F02（credit_purchase）、F04（plan_upgrade）共用；本 feature 只建地基，
// 不做真实支付网关对接（stub 网关，webhook 见 app/api/payment/webhook/route.ts）。
//
// 安全修复（security review on PR #147）：客户端只能传一个目录 sku，绝不能自己指定
// amountCents 或 fulfillmentPayload（如 credits 数量 / planId）——否则可以拼一个
// "付 1 分钱、领 999,999 credits" 的请求。金额与发放数量一律从 payment-catalog.ts
// 的固定表按 sku 查出来，两者绑定读出，不接受客户端覆盖。
//
// F02 补充的安全修复：teamId 绝不能由客户端直接传数字 id 决定——否则任何登录用户都能
// 把别的团队 id 塞进请求体，把自己的购买记入一个自己无权限管理的团队钱包。改为客户端只能
// 传一个布尔意图 `scope: "team"`，服务端据此从当前团队 cookie（与 /api/credits/wallet 相同
// 的解析方式）+ getMembership 查真实角色；不是 owner/admin 一律回退到个人钱包（对应
// uc-credits-002 权限与可见性第 3 条 + notes 里"无权限购买团队 Credit 时回退个人范围"）。

interface CreateOrderBody {
  sku?: string;
  scope?: "personal" | "team";
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let body: CreateOrderBody;
  try {
    body = (await req.json()) as CreateOrderBody;
  } catch {
    body = {};
  }

  const sku = typeof body.sku === "string" ? body.sku : "";
  const entry = sku ? findCatalogEntry(sku) : undefined;
  if (!entry) {
    return NextResponse.json({ error: "sku 无效或不存在" }, { status: 400 });
  }

  // 金额与发放参数完全来自服务端目录，不采纳客户端传入的任何同名字段。
  const fulfillmentKind = entry.kind;
  const amountCents = entry.amountCents;
  const fulfillmentPayload =
    entry.kind === "credit_purchase" ? { credits: entry.credits } : { planId: entry.planId };
  const currency = "USD"; // 目录当前只报 USD；多币种留给后续按需扩展目录本身，而非客户端指定。

  // teamId 由服务端解析：只有当前团队 cookie 指向的团队、且该用户在其中是 owner/admin 时，
  // 才允许把订单记到团队名下；否则一律回退 teamId=null（个人订单）。
  let teamId: number | null = null;
  if (body.scope === "team") {
    const cookieTeamId = cookies().get(CURRENT_TEAM_COOKIE)?.value;
    if (cookieTeamId) {
      const role = await getMembership(Number(cookieTeamId), user.id);
      if (canManageTeam(role)) {
        teamId = Number(cookieTeamId);
      }
    }
  }

  const id = `pay_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  // 二维码内容：stub 支付网关约定的扫码串（真实网关会返回其自身的 code_url，这里自包含订单号即可）。
  const qrPayload = `boardx-pay://order/${id}?amount=${amountCents}&currency=${currency}`;

  const order = await createPaymentOrder({
    id,
    userId: user.id,
    teamId,
    fulfillmentKind,
    fulfillmentPayload,
    amountCents,
    currency,
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
