// coordination dashboard — GET /api/admin/coordination/status
// 2026-07-18 割接（p29-F10 stage-2，ADR-017）：上游从退役的 coord-service 公开
// GET /status 切到 coord-gateway（按仓 RepoHub DO）的 /claims + /events。gateway
// 读端点要 bearer——COORD_API_TOKEN 留在服务端环境变量（不暴露给客户端 bundle），
// 服务端聚合成既有 { configured, active_claims, recent_events, generated_at } 契约，
// SysAdmin 门禁与本 dashboard 其余路由保持同一暴露面。
//
// ADR-009/ADR-017 后这是人类看协调实时状态的主要窗口——GitHub 上不再有协调评论可看。
// COORD_GATEWAY_URL/COORD_API_TOKEN/COORD_REPO 未配置时返回 configured:false（200），
// 让 UI 展示"未接线"状态而不是笼统报错——未配置是合法的部署中间态，不是故障。
import { NextResponse } from "next/server";
import { requireSysAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM_TIMEOUT_MS = 5_000;
const RECENT_EVENTS = 50;

export async function GET() {
  const gate = await requireSysAdmin();
  if (!gate.ok) {
    const status = gate.reason === "unauthenticated" ? 401 : 403;
    return NextResponse.json({ error: gate.reason === "unauthenticated" ? "未登录" : "无权限" }, { status });
  }

  const gatewayUrl = process.env["COORD_GATEWAY_URL"];
  const token = process.env["COORD_API_TOKEN"];
  const repo = process.env["COORD_REPO"];
  if (!gatewayUrl || !token || !repo) {
    return NextResponse.json({ configured: false });
  }
  const base = `${gatewayUrl.replace(/\/+$/, "")}/api/coord/repos/${repo}`;
  const init = {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    cache: "no-store" as const,
  };

  try {
    const [claimsRes, eventsRes] = await Promise.all([
      fetch(`${base}/claims`, init),
      fetch(`${base}/events?limit=500`, init),
    ]);
    if (!claimsRes.ok || !eventsRes.ok) {
      return NextResponse.json(
        { error: "coord_gateway_unavailable", upstream_status: claimsRes.ok ? eventsRes.status : claimsRes.status },
        { status: 502 }
      );
    }
    const claims = (await claimsRes.json()) as { leases?: unknown[] };
    const events = (await eventsRes.json()) as { events?: unknown[] };
    return NextResponse.json({
      configured: true,
      active_claims: claims.leases ?? [],
      // 事件按 event_id（ULID，时间序）升序——取尾部、新的在前
      recent_events: (events.events ?? []).slice(-RECENT_EVENTS).reverse(),
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[admin/coordination/status] coord-gateway fetch failed", err);
    return NextResponse.json({ error: "coord_gateway_unavailable" }, { status: 502 });
  }
}
