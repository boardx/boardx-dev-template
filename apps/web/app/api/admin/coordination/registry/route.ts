// coordination dashboard — GET /api/admin/coordination/registry
// 直接读 .harness/agents/registry.yaml（本地文件，免费，见 docs/proposals/agent-lifecycle-management-proposal.md
// §3「三个 API 路由」）。按 kind 分组返回，供 Coordinators 卡片使用。60s 内存缓存——
// 这是本地文件读取，不是外部调用，缓存纯粹是避免每次轮询都重新解析 YAML。
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { requireSysAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RegistryAgent {
  id: string;
  kind: string;
  model?: string;
  areas?: string[];
  reports_to?: string;
  max_concurrent?: number;
  active?: boolean;
  agent?: string;
  required_for?: string[];
  emits?: string;
}

interface RegistryDoc {
  agents: RegistryAgent[];
}

const REGISTRY_PATH = path.join(process.cwd(), "..", "..", ".harness", "agents", "registry.yaml");
const CACHE_TTL_MS = 60_000;

let cache: { agents: RegistryAgent[]; expiresAt: number } | null = null;

async function loadRegistry(): Promise<RegistryAgent[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.agents;
  const raw = await readFile(REGISTRY_PATH, "utf8");
  const doc = parse(raw) as RegistryDoc;
  const agents = doc.agents.map((a) => ({ ...a, active: a.active ?? true }));
  cache = { agents, expiresAt: Date.now() + CACHE_TTL_MS };
  return agents;
}

export async function GET() {
  const gate = await requireSysAdmin();
  if (!gate.ok) {
    const status = gate.reason === "unauthenticated" ? 401 : 403;
    return NextResponse.json({ error: gate.reason === "unauthenticated" ? "未登录" : "无权限" }, { status });
  }

  try {
    const agents = await loadRegistry();
    const grouped: Record<string, RegistryAgent[]> = {};
    for (const agent of agents) {
      const bucket = grouped[agent.kind] ?? [];
      bucket.push(agent);
      grouped[agent.kind] = bucket;
    }
    return NextResponse.json({ agents, grouped });
  } catch (err) {
    console.error("[admin/coordination/registry] failed to read registry.yaml", err);
    return NextResponse.json({ error: "registry_unavailable" }, { status: 500 });
  }
}
