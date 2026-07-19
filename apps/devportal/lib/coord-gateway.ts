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

/** onboard 面（p30-F05）：平台级端点，不挂在某个仓下——独立 base（无 GITHUB_REPO 依赖）。 */
function onboardBase(): { base: string; token: string } | null {
  const url = process.env["COORD_GATEWAY_URL"];
  const token = process.env["COORD_API_TOKEN"];
  if (!url || !token) return null;
  return { base: `${url.replace(/\/+$/, "")}/api/coord/onboard`, token };
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

// ---------- CoordBrain 影子决策（R1，p30-F10）----------
// 只读展示：CoordBrain 只观察不执行，本函数同样只读——不存在"确认/驳回"之类的写操作。

export interface ShadowDecision {
  event_id: string;
  tick_id: string;
  rule: string;
  subject_id: string;
  decision: boolean;
  reason: string;
  detail: Record<string, unknown> | null;
  at: string;
}

export type ShadowDecisionsResult =
  | { configured: false }
  | { configured: true; decisions: ShadowDecision[] }
  | { configured: true; error: string };

/** GET /shadow-decisions — 本仓 CoordBrain 影子决策（新的在前）。 */
export async function fetchShadowDecisions(limit = 200): Promise<ShadowDecisionsResult> {
  const gw = gatewayBase();
  if (!gw) return { configured: false };
  try {
    const res = await fetch(`${gw.base}/shadow-decisions?limit=${limit}`, {
      headers: { Authorization: `Bearer ${gw.token}` },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return { configured: true, error: `upstream_${res.status}` };
    const body = (await res.json()) as { decisions?: ShadowDecision[] };
    return { configured: true, decisions: body.decisions ?? [] };
  } catch {
    return { configured: true, error: "unreachable" };
  }
}

// ---------------- p30-F05：/onboard 接真代理（installation 视角） ----------------

export interface OnboardRepo {
  full_name: string;
  owner: string;
  name: string;
  slug: string;
  description: string | null;
  language: string | null;
  private: boolean;
  default_branch: string;
  is_admin: boolean;
}

export interface OnboardInstallation {
  installation_id: number;
  account: { login: string; type: string } | null;
  permissions: string[];
  repos: OnboardRepo[];
}

export type OnboardInstallationResult =
  | { configured: false }
  | { configured: true; installation: OnboardInstallation }
  | { configured: true; error: string };

/** GET installation 回执 + 真实仓库列表——login 必须是**请求发起者**的真实 GitHub
 *  身份（服务端从 session 取，绝不接受客户端自报，IDOR 修复 #776 review）：
 *  gateway 只返回该 login 有真实 collaborator 关系的仓库，零关系仓库整条不下发；
 *  过滤后为空（请求者与该 installation 完全无归属关系）时 gateway 直接 403，
 *  不下发 account/permissions（同族 IDOR 收口，#776 复审——之前这两个字段无条件
 *  返回，任意登录用户遍历 installation_id 仍能侦察"谁装了 App、授权了什么权限"）。 */
export async function fetchOnboardInstallation(installationId: number, login: string): Promise<OnboardInstallationResult> {
  const gw = onboardBase();
  if (!gw) return { configured: false };
  try {
    const res = await fetch(`${gw.base}/installations/${installationId}?login=${encodeURIComponent(login)}`, {
      headers: { Authorization: `Bearer ${gw.token}` },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    });
    if (res.status === 403) return { configured: true, error: "not_a_member" };
    if (!res.ok) return { configured: true, error: `upstream_${res.status}` };
    return { configured: true, installation: (await res.json()) as OnboardInstallation };
  } catch {
    return { configured: true, error: "unreachable" };
  }
}

export interface OnboardCheckupItem {
  id: string;
  label: string;
  result: "ok" | "warn";
  detail: string;
  remedy?: string;
}

export type OnboardCheckupResult =
  | { configured: false }
  | { configured: true; items: OnboardCheckupItem[] }
  | { configured: true; error: string };

/** GET 四项真实体检（webhook / 镜像种子 / CODEOWNERS·CONTRIBUTING / 分支保护）。
 *  login 必须是请求发起者的真实身份（服务端从 session 取）——gateway 会先核实该
 *  login 对 owner/repo 是否有 admin 权限，非 admin 一律 403（IDOR 修复 #776 review：
 *  此前任意登录用户可对任意仓触发体检，借平台 App token 侦察目标仓配置）。 */
export async function fetchOnboardCheckup(params: {
  installationId: number;
  owner: string;
  repo: string;
  defaultBranch: string;
  login: string;
}): Promise<OnboardCheckupResult> {
  const gw = onboardBase();
  if (!gw) return { configured: false };
  try {
    const qs = new URLSearchParams({
      installation_id: String(params.installationId),
      owner: params.owner,
      repo: params.repo,
      default_branch: params.defaultBranch,
      login: params.login,
    });
    const res = await fetch(`${gw.base}/checkup?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${gw.token}` },
      signal: AbortSignal.timeout(15_000), // GitHub Contents/branch-protection 多次往返，放宽超时
      cache: "no-store",
    });
    if (res.status === 403) return { configured: true, error: "not_admin" };
    if (!res.ok) return { configured: true, error: `upstream_${res.status}` };
    const body = (await res.json()) as { items?: OnboardCheckupItem[] };
    return { configured: true, items: body.items ?? [] };
  } catch {
    return { configured: true, error: "unreachable" };
  }
}

export type OnboardFinalizeResult =
  | { configured: false }
  | { configured: true; slug: string }
  | { configured: true; error: string };

/** POST finalize——幂等注册为目录项目（webhook 亦会异步做同样的事；本调用保证
 *  用户完成体检时立刻拿到 slug，不必等 webhook 到达）。login 必须是请求发起者的
 *  真实身份（服务端从 session 取）——gateway 会先核实该 login 对 full_name 是否有
 *  admin 权限，非 admin 一律 403（IDOR 修复 #776 review：此前 admin 校验只在前端，
 *  任意登录用户可直接注册任意仓造成 slug 抢注/目录污染）。 */
export async function postOnboardFinalize(params: {
  fullName: string;
  private: boolean;
  installationId: number;
  login: string;
}): Promise<OnboardFinalizeResult> {
  const gw = onboardBase();
  if (!gw) return { configured: false };
  try {
    const res = await fetch(`${gw.base}/finalize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${gw.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        full_name: params.fullName,
        private: params.private,
        installation_id: params.installationId,
        login: params.login,
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    });
    if (res.status === 403) return { configured: true, error: "not_admin" };
    if (!res.ok) return { configured: true, error: `upstream_${res.status}` };
    const body = (await res.json()) as { project?: { slug?: string } };
    if (!body.project?.slug) return { configured: true, error: "missing_slug" };
    return { configured: true, slug: body.project.slug };
  } catch {
    return { configured: true, error: "unreachable" };
  }
}
