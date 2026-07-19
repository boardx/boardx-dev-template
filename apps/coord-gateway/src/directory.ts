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
import { requireAdmin, sha256Hex, timingSafeEqualStr } from "./auth";

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
// 未来 DO 新增内部端点不会被动暴露。
const WRITE_SUBPATHS =
  /^\/(projects|engineers|memberships|agents|enrollments|memberships\/mem_[0-9A-Z]+\/transition|agents\/agt_[0-9A-Z]+\/(heartbeat|rename)|enrollments\/enr_[0-9A-Z]+\/revoke)$/;

/** 目录读面鉴权：ops token 直通；否则按 scoped token 对已接入仓逐个 verify。 */
async function authorizeDirectoryRead(req: Request, env: Env): Promise<Response | null> {
  if (!env.COORD_API_TOKEN) return json(503, { error: "api_token_not_configured" }); // fail-closed
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ") || auth.length <= "Bearer ".length)
    return json(401, { error: "unauthorized" });
  const bearer = auth.slice("Bearer ".length);
  if (timingSafeEqualStr(bearer, env.COORD_API_TOKEN)) return null; // ops 万能钥匙

  // scoped token：明文不出网关，只发 hash 给各仓 RepoHub verify（吊销即时生效）。
  // PROJECTION_REPOS 是已接入仓的权威清单（当前 1 个，上限可控）。
  const repos = (env.PROJECTION_REPOS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const hash = await sha256Hex(bearer);
  for (const repo of repos) {
    const res = await env.REPOHUB.get(env.REPOHUB.idFromName(repo)).fetch("https://repohub/tokens/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token_hash: hash }),
    });
    if (res.status === 200) return null; // 任一仓在册且未吊销 → 放行
  }
  return json(401, { error: "unauthorized" }); // 查无/已吊销一律 401，fail-closed
}

export async function handleDirectory(req: Request, env: Env, url: URL): Promise<Response> {
  const sub = url.pathname.slice("/api/coord/directory".length);
  if (req.method === "GET" && READ_SUBPATHS.test(sub)) {
    const denied = await authorizeDirectoryRead(req, env);
    if (denied) return denied;
    return directoryStub(env).fetch(new Request(`https://directory/directory${sub}${url.search}`, req));
  }
  if (req.method === "POST" && WRITE_SUBPATHS.test(sub)) {
    const denied = requireAdmin(req, env); // 写面 = 管理特权，fail-closed
    if (denied) return denied;
    return directoryStub(env).fetch(new Request(`https://directory/directory${sub}`, req));
  }
  return json(404, { error: "not_found" });
}
