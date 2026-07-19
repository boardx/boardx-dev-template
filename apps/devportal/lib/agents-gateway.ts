// coord-gateway 侧「我的车队」编排层（p30/F07：enroll 真实现）。
//
// 信任链同 my-tokens/route.ts（ADR-011 P2）：devportal 服务端持有
// COORD_GATEWAY_ADMIN_TOKEN（Pages 加密 secret，永不下发浏览器），代表已登录的
// 人类工程师去调 coord-gateway 的目录写面（身份/生命周期）与 RepoHub 按仓 token
// 面（mint-on-reveal，F08）。COORD_API_TOKEN 只用于只读面（ops 万能钥匙）。
//
// 有意的范围收窄（p30/F07 的已知边界，写进 PR body）：Directory 的 Enrollment
// （agent×project 授权登记）依赖一个真实存在的 Project 行；F05（GitHub App
// 多仓安装/项目注册）尚未落地，生产目录里目前通常还没有 Project——本文件不
// 强行伪造一个 Project 来凑齐 Enrollment，只登记 Agent 身份 + 发真实 scoped
// token（RepoHub 才是「这把 token 到底有没有效」的唯一权威，Enrollment 只是
// 授权注册表的加分项，不影响 token 本身的真实鉴权语义）。等 F05 落地后，
// createEnrollment 可以在这里补上而不影响已交付的行为。
const TIMEOUT_MS = 8_000;

export interface GatewayEnv {
  base: string;
  repo: string;
  apiToken: string;
  adminToken: string;
}

/** 三个 secret/var 任一缺失 → null（诚实降级：调用方按 503 处理，不是故障）。 */
export function gatewayEnv(): GatewayEnv | null {
  const url = process.env["COORD_GATEWAY_URL"];
  const apiToken = process.env["COORD_API_TOKEN"];
  const adminToken = process.env["COORD_GATEWAY_ADMIN_TOKEN"];
  const repo = process.env["GITHUB_REPO"];
  if (!url || !apiToken || !adminToken || !repo) return null;
  return { base: url.replace(/\/+$/, ""), repo, apiToken, adminToken };
}

export interface DirectoryAgent {
  agent_id: string;
  name: string;
  identifier: string;
  owner: { engineer_id: string; handle: string } | null;
  parent: { agent_id: string; name: string } | null;
  projects: string[];
  capabilities: string[];
  lifecycle?: "active" | "paused" | "retired";
  last_heartbeat_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RepoToken {
  token_hash_prefix: string;
  agent_id: string;
  owner: string;
  created_at: string;
  revoked_at: string | null;
}

function adminHeaders(gw: GatewayEnv): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${gw.adminToken}` };
}

function apiHeaders(gw: GatewayEnv): HeadersInit {
  return { Authorization: `Bearer ${gw.apiToken}` };
}

export async function listMyDirectoryAgents(gw: GatewayEnv): Promise<DirectoryAgent[] | null> {
  const res = await fetch(`${gw.base}/api/coord/directory/agents`, {
    headers: apiHeaders(gw),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { agents: DirectoryAgent[] };
  return body.agents;
}

export async function getDirectoryAgent(gw: GatewayEnv, agentId: string): Promise<DirectoryAgent | null> {
  const res = await fetch(`${gw.base}/api/coord/directory/agents/${agentId}`, {
    headers: adminHeaders(gw),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { agent: DirectoryAgent };
  return body.agent;
}

export async function listRepoTokens(gw: GatewayEnv): Promise<RepoToken[]> {
  const res = await fetch(`${gw.base}/api/coord/repos/${gw.repo}/tokens`, {
    headers: adminHeaders(gw),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { tokens: RepoToken[] };
  return body.tokens;
}

export async function mintRepoToken(
  gw: GatewayEnv,
  agentId: string,
  owner: string,
): Promise<{ token: string } | { error: string; upstreamStatus: number }> {
  const res = await fetch(`${gw.base}/api/coord/repos/${gw.repo}/tokens/mint`, {
    method: "POST",
    headers: adminHeaders(gw),
    body: JSON.stringify({ agent_id: agentId, owner }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return { error: "mint_failed", upstreamStatus: res.status };
  return (await res.json()) as { token: string };
}

/** 吊销该 agent 名下全部在役（未吊销）token（即时 401，F08 语义）。 */
export async function revokeAllActiveTokens(gw: GatewayEnv, agentId: string): Promise<number> {
  const tokens = await listRepoTokens(gw);
  const active = tokens.filter((t) => t.agent_id === agentId && !t.revoked_at);
  await Promise.all(
    active.map((t) =>
      fetch(`${gw.base}/api/coord/repos/${gw.repo}/tokens/revoke`, {
        method: "POST",
        headers: adminHeaders(gw),
        body: JSON.stringify({ token_hash_prefix: t.token_hash_prefix }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }).catch(() => null),
    ),
  );
  return active.length;
}

export async function upsertEngineer(gw: GatewayEnv, login: string, displayName: string | null): Promise<void> {
  await fetch(`${gw.base}/api/coord/directory/engineers`, {
    method: "POST",
    headers: adminHeaders(gw),
    body: JSON.stringify({ handle: login, github_login: login, display_name: displayName ?? login }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null);
}

export type LifecycleAction = "pause" | "resume" | "retire";

export async function setAgentLifecycle(
  gw: GatewayEnv,
  agentId: string,
  action: LifecycleAction,
): Promise<Response> {
  return fetch(`${gw.base}/api/coord/directory/agents/${agentId}/lifecycle`, {
    method: "POST",
    headers: adminHeaders(gw),
    body: JSON.stringify({ action }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/** 心跳分桶（车队管理台 UI 语义，与 UI 先行原型的三档一致：<5min 新鲜/<30min 渐旧/其余陈旧）。 */
export function heartbeatBucket(lastHeartbeatAt: string | null): {
  heartbeat: "fresh" | "aging" | "stale" | "none";
  minutes: number | null;
} {
  if (!lastHeartbeatAt) return { heartbeat: "none", minutes: null };
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(lastHeartbeatAt)) / 60_000));
  if (minutes < 5) return { heartbeat: "fresh", minutes };
  if (minutes < 30) return { heartbeat: "aging", minutes };
  return { heartbeat: "stale", minutes };
}
