// portal 数据接入层 — GET /api/portal/coordination（p23/F05 的 Cloudflare 版，#523 Track A）
// 2026-07-18 割接（p29-F10 stage-2，ADR-017）：数据源从退役的 coord-service 公开
// GET /status 切到 coord-gateway（RepoHub DO）的 /claims + /events，服务端持
// COORD_API_TOKEN 代读（lib/coord-gateway.ts）；对前端契约不变：
// { configured, active_claims, recent_events, generated_at }。门禁走 Cloudflare Access。
import { NextResponse } from "next/server";
import { accessUser } from "@/lib/access";
import { fetchActiveClaims, fetchRecentEvents } from "@/lib/coord-gateway";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await accessUser(req.headers);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const [claims, events] = await Promise.all([fetchActiveClaims(), fetchRecentEvents(50)]);
  if (!claims.configured) {
    return NextResponse.json({ configured: false });
  }
  if ("error" in claims) {
    return NextResponse.json({ error: "coord_gateway_unavailable" }, { status: 502 });
  }
  return NextResponse.json({
    configured: true,
    active_claims: claims.claims,
    recent_events: events.configured && "events" in events ? events.events : [],
    generated_at: new Date().toISOString(),
  });
}
