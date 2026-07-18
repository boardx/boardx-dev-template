// portal 数据接入层 — GET /api/portal/agents（p23/F08 的 Cloudflare 版，#523 Track A）
// 与产品面同一聚合契约（registry 分组树 + 租约标注）；差异：registry.yaml 经 GitHub
// Contents API 读取（ADR-011 P1 后切 D1 快照）、门禁走 Cloudflare Access、is_me 匹配
// 用 ownerMatches（owner=GitHub login vs Access email 的过渡映射）。
import { NextResponse } from "next/server";
import { parse } from "yaml";
import { accessUser, ownerMatches } from "@/lib/access";
import { readRepoFile } from "@/lib/repo-files";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const UPSTREAM_TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 30_000;

interface RegistryAgent {
  id: string;
  kind: string;
  parent?: string;
  role?: string;
  owner?: string;
  active?: boolean;
}

interface AgentNode {
  id: string;
  kind: string;
  role: string | null;
  active: boolean;
  parent: string | null;
  lease: string | null;
  sub_agents: AgentNode[];
}

interface DeveloperGroup {
  owner: string | null;
  is_me: boolean;
  agent_count: number;
  agents: AgentNode[];
}

interface AgentsPayload {
  coord_configured: boolean;
  developers: DeveloperGroup[];
  generated_at: string;
}

let cache: { key: string; payload: AgentsPayload; expiresAt: number } | null = null;

async function loadRegistry(): Promise<RegistryAgent[] | null> {
  const raw = await readRepoFile(".harness/agents/registry.yaml");
  if (!raw) return null;
  const doc = parse(raw) as { agents?: RegistryAgent[] };
  return (doc.agents ?? []).map((a) => ({ ...a, active: a.active ?? true }));
}

async function loadLeases(): Promise<{ configured: boolean; byAgent: Map<string, string> }> {
  const baseUrl = process.env["COORD_SERVICE_URL"];
  if (!baseUrl) return { configured: false, byAgent: new Map() };
  try {
    const res = await fetch(`${baseUrl}/status`, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS), cache: "no-store" });
    if (!res.ok) return { configured: true, byAgent: new Map() };
    const body = (await res.json()) as { active_claims?: Array<{ resource_id?: string; agent_id?: string }> };
    const byAgent = new Map<string, string>();
    for (const c of body.active_claims ?? []) {
      if (c.agent_id && c.resource_id) byAgent.set(c.agent_id, c.resource_id);
    }
    return { configured: true, byAgent };
  } catch {
    return { configured: true, byAgent: new Map() };
  }
}

function buildGroups(agents: RegistryAgent[], leases: Map<string, string>, viewerEmail: string): DeveloperGroup[] {
  const toNode = (a: RegistryAgent): AgentNode => ({
    id: a.id,
    kind: a.kind,
    role: a.role ?? null,
    active: a.active ?? true,
    parent: a.parent ?? null,
    lease: leases.get(a.id) ?? null,
    sub_agents: [],
  });

  const topById = new Map<string, { node: AgentNode; owner: string | null }>();
  const orphans: Array<{ node: AgentNode; owner: string | null }> = [];
  for (const a of agents) {
    if (a.kind === "sub-agent") continue;
    topById.set(a.id, { node: toNode(a), owner: a.owner ?? null });
  }
  for (const a of agents) {
    if (a.kind !== "sub-agent") continue;
    const node = toNode(a);
    const parent = a.parent ? topById.get(a.parent) : undefined;
    if (parent) parent.node.sub_agents.push(node);
    else orphans.push({ node, owner: a.owner ?? null });
  }

  const groups = new Map<string | null, DeveloperGroup>();
  const groupFor = (owner: string | null): DeveloperGroup => {
    let g = groups.get(owner);
    if (!g) {
      g = { owner, is_me: ownerMatches(owner, viewerEmail), agent_count: 0, agents: [] };
      groups.set(owner, g);
    }
    return g;
  };
  for (const { node, owner } of [...topById.values(), ...orphans]) {
    const g = groupFor(owner);
    g.agents.push(node);
    g.agent_count += 1 + node.sub_agents.length;
  }

  return [...groups.values()].sort((a, b) => {
    if (a.is_me !== b.is_me) return a.is_me ? -1 : 1;
    if (a.owner === null) return 1;
    if (b.owner === null) return -1;
    return a.owner.localeCompare(b.owner);
  });
}

function cacheKey(viewerEmail: string): string {
  return [process.env["COORD_SERVICE_URL"] ?? "", process.env["GITHUB_REPO"] ?? "", viewerEmail].join("|");
}

export async function GET(req: Request) {
  const user = await accessUser(req.headers);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const key = cacheKey(user.email);
  if (cache && cache.key === key && cache.expiresAt > Date.now()) return NextResponse.json(cache.payload);

  const [agents, leases] = await Promise.all([loadRegistry(), loadLeases()]);
  if (!agents) {
    return NextResponse.json({ error: "registry_unavailable" }, { status: 500 });
  }
  const payload: AgentsPayload = {
    coord_configured: leases.configured,
    developers: buildGroups(agents, leases.byAgent, user.email),
    generated_at: new Date().toISOString(),
  };
  cache = { key, payload, expiresAt: Date.now() + CACHE_TTL_MS };
  return NextResponse.json(payload);
}
