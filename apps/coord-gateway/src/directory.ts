// 平台目录面（p30/F01）：/api/coord/directory/* → PlatformDirectory 单例 DO。
// 独立成文件是刻意的——index.ts 只加一行路由，降低与并行改动的冲突面。
//
// 面隔离（写入面收窄，三条铁律）：
//   读面（GET，allowlist）→ ops 万能钥匙（COORD_API_TOKEN）或按仓 scoped token
//     （对 PROJECTION_REPOS 里的仓逐个 verify——scoped token 天然存在其所属仓的
//      RepoHub DO，查到即放行；目录是平台级读物，任何在册 agent 都可读）。
//   写面（POST，全部是身份/授权/审批类）→ COORD_ADMIN_TOKEN 管理面（requireAdmin，
//     fail-closed）。普通 token 触达写路径一律 401。
//   allowlist 之外的子路径一律 404（不暴露 DO 内部面）。
import type { Env } from "./index";
import { requireAdmin, timingSafeEqualStr, verifyScopedAcrossRepos } from "./auth";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function directoryStub(env: Env): DurableObjectStub {
  // 平台单例（与 RepoHub 的按仓 idFromName(owner/repo) 分片相对）
  return env.DIRECTORY.get(env.DIRECTORY.idFromName("platform"));
}

// 读面 allowlist：目录是「人人可读」的平台视图（读 scoped/ops 可达）；
// events 是只增审计读面。写路径与未知子路径都不在此列。
const READ_SUBPATHS =
  /^\/(projects|engineers|memberships|enrollments|events|agents(\/agt_[0-9A-Z]+)?|memberships\/mem_[0-9A-Z]+\/sla)$/;

// 写面 allowlist（admin 面）：仅身份/授权/审批类动作，逐条枚举——不整段透传，
// 未来 DO 新增内部端点不会被动暴露。心跳走独立分支（下方 authorizeHeartbeat），
// 支持 agent 用自己的 scoped token 自证，故未在此重复列出（不影响 allowlist 语义：
// 心跳仍是唯一写路径，只是鉴权门比其余写路径宽一档）。
const WRITE_SUBPATHS =
  /^\/(projects|engineers|memberships|agents|enrollments|memberships\/mem_[0-9A-Z]+\/transition|agents\/agt_[0-9A-Z]+\/(rename|lifecycle)|enrollments\/enr_[0-9A-Z]+\/revoke)$/;

const HEARTBEAT_RE = /^\/agents\/(agt_[0-9A-Z]+)\/heartbeat$/;

/** 目录读面鉴权：ops token 直通；否则按 scoped token 对已接入仓逐个 verify。 */
async function authorizeDirectoryRead(req: Request, env: Env): Promise<Response | null> {
  if (!env.COORD_API_TOKEN) return json(503, { error: "api_token_not_configured" }); // fail-closed
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ") || auth.length <= "Bearer ".length)
    return json(401, { error: "unauthorized" });
  const bearer = auth.slice("Bearer ".length);
  if (timingSafeEqualStr(bearer, env.COORD_API_TOKEN)) return null; // ops 万能钥匙

  // scoped token：明文不出网关，只发 hash 给各仓 RepoHub verify（吊销即时生效）。
  const scoped = await verifyScopedAcrossRepos(bearer, env);
  return scoped ? null : json(401, { error: "unauthorized" }); // 查无/已吊销一律 401，fail-closed
}

/** 心跳写路径鉴权（p30/F07）：admin 特权 OR agent 自己的 scoped token（自证——
 *  verify 回传的 agent_id 必须等于 URL 里要打心跳的那个 agent，防止 A 的 token
 *  冒充给 B 打心跳）。这是「等首个心跳」真实点亮的信任根：enroll 时发给这个
 *  agent 的 token 就是它自己唯一能用来打心跳的凭据。 */
async function authorizeHeartbeat(req: Request, env: Env, agentId: string): Promise<Response | null> {
  const adminDenied = requireAdmin(req, env);
  if (!adminDenied) return null; // admin bearer 放行（保留运维/dispatcher 直打通道）
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  if (!bearer) return adminDenied; // 原样透传 401/503
  const scoped = await verifyScopedAcrossRepos(bearer, env);
  if (!scoped) return json(401, { error: "unauthorized" });
  if (scoped.agentId !== agentId) return json(403, { error: "token_agent_mismatch" });
  return null;
}

/** 心跳成功后把同一枚事件转发进本仓 RepoHub 的事件流（真实 WS 广播，非
 *  mock 定时器；见 repohub.ts 的 /relay/event，coord-repohub 侧测试覆盖）。
 *  最佳努力：转发失败不影响心跳本身已经落库成功的事实。 */
async function relayHeartbeat(env: Env, agentId: string, directoryRes: Response): Promise<void> {
  let at = new Date().toISOString();
  try {
    const body = (await directoryRes.clone().json()) as { agent?: { last_heartbeat_at?: string } };
    if (body.agent?.last_heartbeat_at) at = body.agent.last_heartbeat_at;
  } catch {
    /* 解析失败不影响转发，用当前时间兜底 */
  }
  const repos = (env.PROJECTION_REPOS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  await Promise.all(
    repos.map((repo) =>
      env.REPOHUB.get(env.REPOHUB.idFromName(repo))
        .fetch("https://repohub/relay/event", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            type: "directory.agent.heartbeat",
            resource_id: `agent:${agentId}`,
            agent_id: agentId,
            payload: { agent_id: agentId, at },
          }),
        })
        .catch(() => null),
    ),
  );
}

export async function handleDirectory(req: Request, env: Env, url: URL): Promise<Response> {
  const sub = url.pathname.slice("/api/coord/directory".length);
  if (req.method === "GET" && READ_SUBPATHS.test(sub)) {
    const denied = await authorizeDirectoryRead(req, env);
    if (denied) return denied;
    return directoryStub(env).fetch(new Request(`https://directory/directory${sub}${url.search}`, req));
  }
  const hb = sub.match(HEARTBEAT_RE);
  if (req.method === "POST" && hb) {
    const agentId = hb[1]!;
    const denied = await authorizeHeartbeat(req, env, agentId);
    if (denied) return denied;
    const res = await directoryStub(env).fetch(new Request(`https://directory/directory${sub}`, req));
    if (res.status === 200) await relayHeartbeat(env, agentId, res);
    return res;
  }
  if (req.method === "POST" && WRITE_SUBPATHS.test(sub)) {
    const denied = requireAdmin(req, env); // 写面 = 管理特权，fail-closed
    if (denied) return denied;
    return directoryStub(env).fetch(new Request(`https://directory/directory${sub}`, req));
  }
  return json(404, { error: "not_found" });
}
