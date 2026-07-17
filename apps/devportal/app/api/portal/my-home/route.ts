// my-home — p23-F10 登录后「我」视角首页的聚合端点（ADR-011 P2 由 #629 解锁）。
// 人类拍板 2026-07-15：登录后 10 秒内知道"我现在该干什么"。四象限，全部按当前
// Access 身份（github_login，经 registry owner 匹配）过滤，各源互不拖垮：
//   1. 我的 agent 队伍：registry owner=我 的 agent + D1 租约新鲜度（coord /status）
//   2. 我卡住的 PR：GitHub 上我开的、open 且超 1 个周期（3h）没动的 PR
//   3. 我的 flow-time：我近 20 个已合并 PR 的开→合中位时长
//   4. @我的待拍板：discussions 里点名我的 needs_human 条目数（复用 discussions 契约）
// 门禁 Cloudflare Access；未登录 401。GitHub/coord 未配置 → 对应象限 configured:false。
import { NextResponse } from "next/server";
import { parse } from "yaml";
import { accessUser, ownerMatches } from "@/lib/access";
import { readRepoFile } from "@/lib/repo-files";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const UPSTREAM_TIMEOUT_MS = 6_000;
const CACHE_TTL_MS = 30_000;
const STALE_MS = 3 * 3600_000; // 1 个工作周期

interface MyAgent {
  id: string;
  kind: string;
  role: string | null;
  lease: string | null; // 当前占用的 resource_id；无租约 = null
  heartbeat_age_min: number | null;
  fresh: boolean; // 租约是否新鲜（心跳 < ttl）
}

interface MyPr {
  number: number;
  title: string;
  url: string;
  age_hours: number;
  stale: boolean;
}

type Section<T> = { configured: true; items: T } | { configured: false };

interface MyHomePayload {
  login: string | null;
  agents: MyAgent[]; // registry 是本地源，永远可用（空数组=未登记 agent）
  coord_configured: boolean;
  prs: Section<MyPr[]>;
  flow_hours_median: number | null;
  flow_configured: boolean;
  decide_count: number | null; // @我的待拍板；null=discussions 未配置
  generated_at: string;
}

let cache: { key: string; payload: MyHomePayload; expiresAt: number } | null = null;

interface RegistryAgent {
  id: string;
  kind: string;
  role?: string;
  owner?: string;
  active?: boolean;
}

async function loadMyAgents(email: string): Promise<RegistryAgent[]> {
  const raw = await readRepoFile(".harness/agents/registry.yaml");
  if (!raw) return [];
  const doc = parse(raw) as { agents?: RegistryAgent[] };
  return (doc.agents ?? []).filter((a) => ownerMatches(a.owner, email) && a.active !== false);
}

/** coord /status → agent_id 到 {resource_id, heartbeat, ttl} 的租约映射。不可达→null。 */
async function loadLeases(): Promise<{
  configured: boolean;
  byAgent: Map<string, { resource_id: string; last_heartbeat_at: string; ttl_seconds: number }>;
}> {
  const baseUrl = process.env["COORD_SERVICE_URL"];
  if (!baseUrl) return { configured: false, byAgent: new Map() };
  try {
    const res = await fetch(`${baseUrl}/status`, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS), cache: "no-store" });
    if (!res.ok) return { configured: true, byAgent: new Map() };
    const body = (await res.json()) as {
      active_claims?: Array<{ resource_id?: string; agent_id?: string; last_heartbeat_at?: string; ttl_seconds?: number }>;
    };
    const byAgent = new Map<string, { resource_id: string; last_heartbeat_at: string; ttl_seconds: number }>();
    for (const c of body.active_claims ?? []) {
      if (c.agent_id && c.resource_id && c.last_heartbeat_at) {
        byAgent.set(c.agent_id, {
          resource_id: c.resource_id,
          last_heartbeat_at: c.last_heartbeat_at,
          ttl_seconds: c.ttl_seconds ?? 10800,
        });
      }
    }
    return { configured: true, byAgent };
  } catch {
    return { configured: true, byAgent: new Map() };
  }
}

/** 我开的 open PR（stale 标记）+ 我近期已合并 PR 的 flow-time 中位。login 缺失时空。 */
async function loadMyGithub(login: string | null): Promise<{
  prs: Section<MyPr[]>;
  flowMedian: number | null;
  flowConfigured: boolean;
}> {
  const token = process.env["GITHUB_TOKEN"];
  const repo = process.env["GITHUB_REPO"];
  if (!token || !repo) return { prs: { configured: false }, flowMedian: null, flowConfigured: false };
  if (!login) return { prs: { configured: true, items: [] }, flowMedian: null, flowConfigured: true };

  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "boardx-devportal" };
  const now = Date.now();

  // 我卡住的 PR：author:me is:open
  let prs: Section<MyPr[]> = { configured: true, items: [] };
  try {
    const res = await fetch(
      `https://api.github.com/search/issues?q=repo:${repo}+is:pr+is:open+author:${login}&per_page=50`,
      { headers, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS), cache: "no-store" }
    );
    if (res.ok) {
      const body = (await res.json()) as { items?: Array<{ number: number; title: string; html_url: string; created_at: string; updated_at: string; draft?: boolean }> };
      const items = (body.items ?? [])
        .filter((p) => !p.draft)
        .map((p) => ({
          number: p.number,
          title: p.title,
          url: p.html_url,
          age_hours: Math.max(0, (now - new Date(p.created_at).getTime()) / 3600_000),
          stale: now - new Date(p.updated_at).getTime() > STALE_MS,
        }));
      prs = { configured: true, items };
    }
  } catch {
    /* 保持空 items，互不拖垮 */
  }

  // 我的 flow-time：author:me is:merged 近 20，开→合中位
  let flowMedian: number | null = null;
  try {
    const res = await fetch(
      `https://api.github.com/search/issues?q=repo:${repo}+is:pr+is:merged+author:${login}&sort=updated&order=desc&per_page=20`,
      { headers, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS), cache: "no-store" }
    );
    if (res.ok) {
      const body = (await res.json()) as { items?: Array<{ created_at: string; pull_request?: { merged_at?: string | null } }> };
      const flows = (body.items ?? [])
        .filter((i) => i.pull_request?.merged_at)
        .map((i) => (new Date(i.pull_request!.merged_at!).getTime() - new Date(i.created_at).getTime()) / 3600_000)
        .sort((a, b) => a - b);
      if (flows.length) flowMedian = Math.round(flows[Math.floor(flows.length / 2)]! * 10) / 10;
    }
  } catch {
    /* flowMedian 保持 null */
  }

  return { prs, flowMedian, flowConfigured: true };
}

/** @我的待拍板：discussions 里作者=我 或 正文点名我的 needs_human。未配置→null。 */
async function loadMyDecisions(login: string | null): Promise<number | null> {
  if (!process.env["GITHUB_TOKEN"] || !login) return null;
  // 复用 discussions 端点的聚合结果（同源，避免重复抓取逻辑漂移）
  return null; // 由前端从 /api/portal/discussions 取 needs_human_count 承担；此处占位保持契约位
}

export async function GET(req: Request) {
  const user = await accessUser(req.headers);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const key = `${user.email}|${process.env["COORD_SERVICE_URL"] ?? ""}|${process.env["GITHUB_TOKEN"] ? "t" : ""}`;
  if (cache && cache.key === key && cache.expiresAt > Date.now()) return NextResponse.json(cache.payload);

  const mine = await loadMyAgents(user.email);
  const login = mine[0]?.owner ?? null;

  const [leases, github, decideCount] = await Promise.all([loadLeases(), loadMyGithub(login), loadMyDecisions(login)]);
  const now = Date.now();

  const agents: MyAgent[] = mine.map((a) => {
    const lease = leases.byAgent.get(a.id);
    const ageMin = lease ? (now - new Date(lease.last_heartbeat_at).getTime()) / 60000 : null;
    return {
      id: a.id,
      kind: a.kind,
      role: a.role ?? null,
      lease: lease?.resource_id ?? null,
      heartbeat_age_min: ageMin === null ? null : Math.round(ageMin * 10) / 10,
      fresh: lease ? now - new Date(lease.last_heartbeat_at).getTime() < lease.ttl_seconds * 1000 : false,
    };
  });

  const payload: MyHomePayload = {
    login,
    agents,
    coord_configured: leases.configured,
    prs: github.prs,
    flow_hours_median: github.flowMedian,
    flow_configured: github.flowConfigured,
    decide_count: decideCount,
    generated_at: new Date().toISOString(),
  };
  cache = { key, payload, expiresAt: Date.now() + CACHE_TTL_MS };
  return NextResponse.json(payload);
}
