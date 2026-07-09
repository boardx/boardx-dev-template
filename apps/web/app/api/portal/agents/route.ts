// portal 数据接入层 — GET /api/portal/agents（p23/F08）
// 数据源 1（权威身份）：本仓 .harness/agents/registry.yaml（本地文件，永远可用；读法参考
// app/api/admin/coordination/registry/route.ts，但门禁降为 currentUser——门户面向全体开发者）。
// 数据源 2（租约增强）：coord-service 公开 GET /status 的 active_claims，把"当前租约"标注到
// agent 行上；COORD_SERVICE_URL 未配置 → coord_configured:false，租约信息整体省略（诚实降级）。
// 返回形状：按 owner（开发者=人类，ADR-011 配对关系）分组的 agents 树——owner 是人类归属、
// parent 是 agent 派生树，两条关系并存：sub-agent 挂在 parent agent 之下（不平铺进开发者组）。
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REGISTRY_PATH = path.join(process.cwd(), "..", "..", ".harness", "agents", "registry.yaml");
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
  /** 当前租约（coord-service active_claims 的 resource_id）；coord 未配置/无租约 → null */
  lease: string | null;
  sub_agents: AgentNode[];
}

interface DeveloperGroup {
  /** 开发者（人类）标识 = registry 的 owner 邮箱；registry 未登记 owner 的 agent 归入 null 组 */
  owner: string | null;
  is_me: boolean;
  /** 合计 agent 数（含挂在 parent 下的 sub-agent） */
  agent_count: number;
  agents: AgentNode[];
}

interface AgentsPayload {
  coord_configured: boolean;
  developers: DeveloperGroup[];
  generated_at: string;
}

let cache: { key: string; payload: AgentsPayload; expiresAt: number } | null = null;

async function loadRegistry(): Promise<RegistryAgent[]> {
  const raw = await readFile(REGISTRY_PATH, "utf8");
  const doc = parse(raw) as { agents?: RegistryAgent[] };
  return (doc.agents ?? []).map((a) => ({ ...a, active: a.active ?? true }));
}

/** coord-service /status 的 active_claims → agent_id 到 resource_id 的租约映射；不可达时空映射（不 5xx）。 */
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

  // 两遍：先建非 sub-agent 顶层节点，再把 sub-agent 挂到 parent 下（派生树）；
  // parent 缺失/未登记的 sub-agent 退化为其 owner 组的顶层行（不丢数据）。
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
      g = { owner, is_me: owner !== null && owner === viewerEmail, agent_count: 0, agents: [] };
      groups.set(owner, g);
    }
    return g;
  };
  for (const { node, owner } of [...topById.values(), ...orphans]) {
    const g = groupFor(owner);
    g.agents.push(node);
    g.agent_count += 1 + node.sub_agents.length;
  }

  // 我的分组排最前，其余按 owner 字典序，未登记归属（null）殿后
  return [...groups.values()].sort((a, b) => {
    if (a.is_me !== b.is_me) return a.is_me ? -1 : 1;
    if (a.owner === null) return 1;
    if (b.owner === null) return -1;
    return a.owner.localeCompare(b.owner);
  });
}

/** 缓存键含配置指纹 + 观察者：环境变量变化即失效；is_me 随登录者不同，缓存按邮箱区分。 */
function cacheKey(viewerEmail: string): string {
  return [process.env["COORD_SERVICE_URL"] ?? "", viewerEmail].join("|");
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const key = cacheKey(user.email);
  if (cache && cache.key === key && cache.expiresAt > Date.now()) return NextResponse.json(cache.payload);

  try {
    const [agents, leases] = await Promise.all([loadRegistry(), loadLeases()]);
    const payload: AgentsPayload = {
      coord_configured: leases.configured,
      developers: buildGroups(agents, leases.byAgent, user.email),
      generated_at: new Date().toISOString(),
    };
    cache = { key, payload, expiresAt: Date.now() + CACHE_TTL_MS };
    return NextResponse.json(payload);
  } catch (err) {
    console.warn("[portal/agents] failed to read registry.yaml", err);
    return NextResponse.json({ error: "registry_unavailable" }, { status: 500 });
  }
}
