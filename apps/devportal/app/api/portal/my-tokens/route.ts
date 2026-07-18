// my-tokens — 自助 token 领取/轮换的门户侧 broker（ADR-011 P2，#594 同族）。
// 人类拍板（2026-07-14）：申请获批后开发者在 devportal 直接领 token，不再人工发放。
//
// 信任链的第 2 段（第 1 段=registry PR review，第 3 段=gateway 只认 admin 面）：
//   GET  → Access 身份 → registry owner 匹配 → 列出"属于我的可自助身份"
//   POST → 同样校验归属 → 用 COORD_GATEWAY_ADMIN_TOKEN（Pages secret，永不到浏览器）
//          代调 coord-gateway 按仓 mint → 明文 token 透传给浏览器【仅此一次】，不落任何存储
// 2026-07-18 割接（p29-F10 stage-2，ADR-017）：旧 coord-service broker 通道
// （COORD_BROKER_TOKEN + /agents/:id/mint-token）已随 coord-service 退役删除；
// 按仓 scoped token（F08）是唯一发放通道。
// coordinator/token-broker 身份不出现在列表也不可 mint（共享设施钥匙走人类运维流程）。
import { NextResponse } from "next/server";
import { parse } from "yaml";
import { accessUser, ownerMatches } from "@/lib/access";
import { readRepoFile } from "@/lib/repo-files";

export const runtime = "edge";
export const dynamic = "force-dynamic";

// UX 前置过滤：不把不可自助的身份列为可领取。真正的拒绝以服务端 mint 端点为
// 权威门（COORDINATOR_KINDS 全集）。安全审查 #629：此处曾漏
// module-/architecture-coordinator，与服务端同缺 → 端到端洞开，两处必须一致。
const NOT_SELF_SERVICEABLE = new Set([
  "coordinator",
  "module-coordinator",
  "architecture-coordinator",
  "token-broker",
]);

interface RegistryAgent {
  id: string;
  kind: string;
  owner?: string;
  active?: boolean;
}

async function myAgents(email: string): Promise<RegistryAgent[] | null> {
  const raw = await readRepoFile(".harness/agents/registry.yaml");
  if (!raw) return null;
  const doc = parse(raw) as { agents?: RegistryAgent[] };
  return (doc.agents ?? []).filter(
    (a) => ownerMatches(a.owner, email) && a.active !== false && !NOT_SELF_SERVICEABLE.has(a.kind)
  );
}

/** GET — 我的可自助身份清单（含是否具备 mint 条件的服务端配置状态）。 */
export async function GET(req: Request) {
  const user = await accessUser(req.headers);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const agents = await myAgents(user.email);
  if (!agents) return NextResponse.json({ error: "registry_unavailable" }, { status: 502 });
  // broker_configured（旧 coord-service broker）已随 ADR-017 割接退役；
  // gateway_configured 是唯一发放通道的接通状态（F08 按仓 scoped token）。
  return NextResponse.json({
    gateway_configured: Boolean(process.env["COORD_GATEWAY_ADMIN_TOKEN"] && process.env["COORD_GATEWAY_URL"]),
    agents: agents.map((a) => ({ id: a.id, kind: a.kind })),
  });
}

/** POST {agent_id} — 领取/轮换该身份的按仓 scoped token（明文只返回这一次）。
 *  经 COORD_GATEWAY_ADMIN_TOKEN（服务端 secret，永不下发浏览器）调 gateway 的
 *  按仓 mint 路由，owner 绑定当前 Access 登录身份——token 权威在该仓的 RepoHub DO。
 *  旧 target="coord-service" 通道已随 ADR-017 割接删除，未知 target 一律按 gateway 处理。 */
export async function POST(req: Request) {
  const user = await accessUser(req.headers);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { agent_id?: unknown };
  const agentId = typeof body.agent_id === "string" ? body.agent_id : "";
  if (!agentId) return NextResponse.json({ error: "missing_agent_id" }, { status: 400 });
  const target = "coord-gateway";

  const agents = await myAgents(user.email);
  if (!agents) return NextResponse.json({ error: "registry_unavailable" }, { status: 502 });
  if (!agents.some((a) => a.id === agentId)) {
    // registry 归属是唯一授权依据：不属于你（或不可自助）的身份一律 403，不区分存在性
    return NextResponse.json({ error: "not_your_agent" }, { status: 403 });
  }

  const adminToken = process.env["COORD_GATEWAY_ADMIN_TOKEN"];
  const gatewayUrl = process.env["COORD_GATEWAY_URL"];
  const repo = process.env["GITHUB_REPO"];
  if (!adminToken || !gatewayUrl || !repo)
    return NextResponse.json({ error: "gateway_broker_not_configured" }, { status: 503 });
  const res = await fetch(`${gatewayUrl}/api/coord/repos/${repo}/tokens/mint`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ agent_id: agentId, owner: user.email }),
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json({ error: "mint_failed", upstream_status: res.status }, { status: 502 });
  }
  const minted = (await res.json()) as { agent_id: string; token: string; created_at: string };
  // 明文只经过这一跳：gateway → 本路由 → 浏览器。不写日志、不进缓存。
  return NextResponse.json(
    { agent_id: minted.agent_id, token: minted.token, target, repo },
    { headers: { "Cache-Control": "no-store" } },
  );
}
