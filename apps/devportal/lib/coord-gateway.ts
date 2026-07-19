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

// ---------- 工作区分片数据（p30/F04）：需求流水线 / sprint 面板 / talk 对话流 ----------
// 迁移映射（旧来源 → 新权威，按项目 DO 分片）：
//   需求流水线条目：此前无独立存储（phases/*/requirements/*.md 仓库文件 + F18 mock 未建）
//     → GET  {gateway}/repos/{repo}/requirements
//   sprint 面板数据：此前由 pulse 路由从 phases/*/feature_list.json（Contents API，单仓）派生
//     → GET  {gateway}/repos/{repo}/sprint-items
//   talk 对话流：此前 /api/portal/discussions 聚合 GitHub issue 评论
//     （PORTAL_NARRATIVE_ISSUES × 单一 GITHUB_REPO env，未分片）
//     → GET  {gateway}/repos/{repo}/talk
// 消费方（F18 五节点流水线 UI 等）优先走这三个 fetcher；mock/旧聚合仅作
// configured:false 的空态回退（真实端点优先）。三态纪律同上（ADR-006）。

export interface CoordRequirement {
  id: string;
  title: string;
  body: string;
  status: "submitted" | "analyzing" | "in_review" | "dispatched" | "rejected";
  submitted_by: string;
  analysis: string | null;
  review_note: string | null;
  reviewed_by: string | null;
  issue: number | null;
  created_at: string;
  updated_at: string;
}

export interface CoordSprintItem {
  sprint: string;
  item_id: string;
  title: string;
  status: string;
  assignee: string | null;
  data: unknown;
  updated_at: string;
}

export interface CoordTalkMessage {
  message_id: string;
  author: string;
  body: string;
  needs_human: boolean;
  at: string;
}

export type WorkspaceResult<K extends string, T> =
  | { configured: false }
  | ({ configured: true } & { [key in K]: T[] })
  | { configured: true; error: string };

async function fetchWorkspaceList<K extends string, T>(
  path: string,
  key: K,
): Promise<WorkspaceResult<K, T>> {
  const gw = gatewayBase();
  if (!gw) return { configured: false };
  try {
    const res = await fetch(`${gw.base}${path}`, {
      headers: { Authorization: `Bearer ${gw.token}` },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return { configured: true, error: `upstream_${res.status}` };
    const body = (await res.json()) as Record<string, T[] | undefined>;
    return { configured: true, [key]: body[key] ?? [] } as WorkspaceResult<K, T>;
  } catch {
    return { configured: true, error: "unreachable" };
  }
}

/** GET /requirements — 本项目需求流水线条目（五态，新的在前）。 */
export function fetchRequirements(
  status?: CoordRequirement["status"],
): Promise<WorkspaceResult<"requirements", CoordRequirement>> {
  const qs = status ? `?status=${status}` : "";
  return fetchWorkspaceList(`/requirements${qs}`, "requirements");
}

/** GET /sprint-items — 本项目 sprint 面板条目（可按 sprint 过滤）。 */
export function fetchSprintItems(
  sprint?: string,
): Promise<WorkspaceResult<"items", CoordSprintItem>> {
  const qs = sprint ? `?sprint=${encodeURIComponent(sprint)}` : "";
  return fetchWorkspaceList(`/sprint-items${qs}`, "items");
}

/** GET /talk — 本项目对话流（ULID 时间序升序；since 续传同 /events）。 */
export function fetchTalkMessages(
  opts: { since?: string; limit?: number } = {},
): Promise<WorkspaceResult<"messages", CoordTalkMessage>> {
  const params = new URLSearchParams();
  if (opts.since) params.set("since", opts.since);
  if (opts.limit) params.set("limit", String(opts.limit));
  const qs = params.size > 0 ? `?${params.toString()}` : "";
  return fetchWorkspaceList(`/talk${qs}`, "messages");
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
