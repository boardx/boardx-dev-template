// coord-gateway.ts — 门户服务端读协调面的唯一入口（p29-F10 stage-2，ADR-017）。
//
// 2026-07-18 割接：coord-service（D1）退役，租约/事件权威 = coord-gateway 背后的
// 按仓 RepoHub DO。旧 coord-service 有公开无鉴权的 GET /status；gateway 的读端点
// 一律要 bearer——用 F09 已就位的 Pages secret COORD_API_TOKEN（永不下发浏览器）
// 在服务端代读。多个路由（coordination/agents/my-home/pulse）复用本模块，
// 避免 loadLeases 四处复制漂移。
//
// 诚实降级：未配置 → configured:false（合法部署中间态，不是故障）；
// 已配置但问不到 → configured:true + error（问不到 ≠ 空闲，ADR-006 三态纪律）。

const UPSTREAM_TIMEOUT_MS = 5_000;

export interface CoordLease {
  lease_id: string;
  resource_id: string;
  agent_id: string;
  claimed_at: string;
  last_heartbeat_at: string;
  ttl_seconds: number;
}

export interface CoordEvent {
  event_id: string;
  type: string;
  resource_id: string;
  agent_id: string;
  at: string;
  payload: unknown;
}

function gatewayBase(): { base: string; token: string } | null {
  const url = process.env["COORD_GATEWAY_URL"];
  const token = process.env["COORD_API_TOKEN"];
  const repo = process.env["GITHUB_REPO"];
  if (!url || !token || !repo) return null;
  return { base: `${url.replace(/\/+$/, "")}/api/coord/repos/${repo}`, token };
}

/** 缓存 key 的配置指纹（配置变了缓存必须失效）。 */
export function coordConfigKey(): string {
  return [
    process.env["COORD_GATEWAY_URL"] ?? "",
    process.env["COORD_API_TOKEN"] ? "t" : "",
    process.env["GITHUB_REPO"] ?? "",
  ].join("|");
}

export type ActiveClaimsResult =
  | { configured: false }
  | { configured: true; claims: CoordLease[] }
  | { configured: true; error: string };

/** GET /claims — 本仓全部活跃租约。 */
export async function fetchActiveClaims(): Promise<ActiveClaimsResult> {
  const gw = gatewayBase();
  if (!gw) return { configured: false };
  try {
    const res = await fetch(`${gw.base}/claims`, {
      headers: { Authorization: `Bearer ${gw.token}` },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return { configured: true, error: `upstream_${res.status}` };
    const body = (await res.json()) as { leases?: CoordLease[] };
    return { configured: true, claims: body.leases ?? [] };
  } catch {
    return { configured: true, error: "unreachable" };
  }
}

export type RecentEventsResult =
  | { configured: false }
  | { configured: true; events: CoordEvent[] }
  | { configured: true; error: string };

/** GET /events — 近 N 条协调事件（新的在前）。事件按 event_id（ULID，时间序）升序
 *  存储，这里取尾部再反转。 */
export async function fetchRecentEvents(limit = 50): Promise<RecentEventsResult> {
  const gw = gatewayBase();
  if (!gw) return { configured: false };
  try {
    const res = await fetch(`${gw.base}/events?limit=500`, {
      headers: { Authorization: `Bearer ${gw.token}` },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return { configured: true, error: `upstream_${res.status}` };
    const body = (await res.json()) as { events?: CoordEvent[] };
    return { configured: true, events: (body.events ?? []).slice(-limit).reverse() };
  } catch {
    return { configured: true, error: "unreachable" };
  }
}
