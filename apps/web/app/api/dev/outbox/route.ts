// apps/web/app/api/dev/outbox/route.ts — 仅 dev/测试：查询出站邮件本地 sink（p18 F08）
// 与 /api/dev/reset-token 同一口径：e2e 用它断言"真实发信请求已发出且内容正确"。
// 生产环境一律 404——绝不暴露邮件内容。
import { NextResponse } from "next/server";
import { getLatestOutboundEmail } from "@repo/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const url = new URL(req.url);
  const to = url.searchParams.get("to") ?? "";
  const kind = url.searchParams.get("kind") ?? "ava_share_link";
  const mail = await getLatestOutboundEmail(to, kind);
  if (!mail) return NextResponse.json({ mail: null }, { status: 404 });
  return NextResponse.json({ mail });
}
