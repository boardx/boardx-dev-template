// 鉴权辅助（F08）：REST 与 MCP 共用的「scoped token 优先」bearer 鉴权。
// 独立成文件是刻意的——index.ts 只做「辅助函数替换 + import」，降低与并行改动的冲突面。
//
// 鉴权矩阵（fail-closed 纪律，ADR-017 处决过静默 fail-open）：
//   缺 COORD_API_TOKEN 配置        → 503（fail-closed）
//   无 Authorization / 非 Bearer   → 401
//   bearer == COORD_API_TOKEN      → 放行（ops 万能钥匙，常数时间比较）
//   否则 sha256(bearer) → 该仓 DO /tokens/verify（每请求实时查，吊销即时生效）：
//     200（本仓在册且未吊销）→ 放行
//     401（已吊销）          → 401
//     404（本仓查无 = 跨仓/伪造）→ 403（按仓 scope 由 DO 存储位置天然保证）
import type { Env } from "./index";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const enc = new TextEncoder();

// 常数时间比较：防 secret 逐字节 timing 侧信道。长度不同直接 false（长度可泄露，业界共识可接受）。
// workers 运行时提供非标准 crypto.subtle.timingSafeEqual（workers-types 已声明）。
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.byteLength !== bb.byteLength) return false;
  return crypto.subtle.timingSafeEqual(ab, bb);
}

export async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bearerOf(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const t = auth.slice("Bearer ".length);
  return t.length > 0 ? t : null;
}

/** 管理特权门（F06 andon 模式）：独立 COORD_ADMIN_TOKEN，mint/revoke/andon 等
 *  maintainer 动作专用。通过返回 null，否则返回应答的错误 Response。 */
export function requireAdmin(req: Request, env: Env): Response | null {
  if (!env.COORD_ADMIN_TOKEN) return json(503, { error: "admin_token_not_configured" });
  const bearer = bearerOf(req);
  if (!bearer || !timingSafeEqualStr(bearer, env.COORD_ADMIN_TOKEN))
    return json(401, { error: "unauthorized" });
  return null;
}

/** bearer 是否为 admin token（F10-pre：GET /tasks 双面复用的路由判定——
 *  admin bearer（devportal broker，可 assignee=*）直通管理面，其余落 REST scoped 面）。 */
export function isAdminBearer(req: Request, env: Env): boolean {
  const bearer = bearerOf(req);
  return Boolean(env.COORD_ADMIN_TOKEN && bearer && timingSafeEqualStr(bearer, env.COORD_ADMIN_TOKEN));
}

/** 鉴权通过后的主体：ops = COORD_API_TOKEN 万能钥匙（保留自证 agent_id 的运维语义）；
 *  scoped = 按仓 token，携带 DO 在册的 agent_id/owner——下游必须强绑定，禁止自证。 */
export type RepoPrincipal =
  | { kind: "ops" }
  | { kind: "scoped"; agentId: string; owner: string };

export type RepoAccess =
  | { granted: true; principal: RepoPrincipal }
  | { granted: false; response: Response };

/** 仓级访问鉴权（REST /api/coord/repos/:o/:r/* 与 MCP 共用）。
 *  通过返回 principal（供 agent_id 强绑定）；拒绝返回错误 Response（矩阵见文件头）。 */
export async function authorizeRepoAccess(
  req: Request,
  env: Env,
  repo: string,
): Promise<RepoAccess> {
  const deny = (r: Response): RepoAccess => ({ granted: false, response: r });
  if (!env.COORD_API_TOKEN) return deny(json(503, { error: "api_token_not_configured" }));
  const bearer = bearerOf(req);
  if (!bearer) return deny(json(401, { error: "unauthorized" }));
  if (timingSafeEqualStr(bearer, env.COORD_API_TOKEN))
    return { granted: true, principal: { kind: "ops" } }; // ops 万能钥匙

  // scoped token 路径：只发 hash 给 DO，明文不出本函数
  const hash = await sha256Hex(bearer);
  const stub = env.REPOHUB.get(env.REPOHUB.idFromName(repo));
  const res = await stub.fetch("https://repohub/tokens/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token_hash: hash }),
  });
  if (res.status === 200) {
    const v = (await res.json()) as { agent_id: string; owner: string };
    return { granted: true, principal: { kind: "scoped", agentId: v.agent_id, owner: v.owner } };
  }
  if (res.status === 401) return deny(json(401, { error: "token_revoked" }));
  if (res.status === 404) return deny(json(403, { error: "token_not_valid_for_repo" })); // 跨仓/伪造
  // DO 侧异常（422 等）不放行——fail-closed
  return deny(json(403, { error: "token_verification_failed", upstream_status: res.status }));
}

// ---------- agent_id 强绑定（F08 返工，#721）----------
// scoped token 的 agent 身份以 DO 在册记录为准，请求侧自证一律不信：
// body/工具参数里的 agent_id 与 token 身份不一致 → 403 token_agent_mismatch；
// 缺省 → 注入 token 身份。ops 万能钥匙路径维持自证（运维语义）。

/** MCP 工具参数版：返回错误 Response 或（可能注入了 agent_id 的）参数对象。 */
export function bindScopedAgentArgs(
  principal: RepoPrincipal,
  args: Record<string, unknown>,
): Response | Record<string, unknown> {
  if (principal.kind !== "scoped") return args;
  const claimed = args["agent_id"];
  if (claimed !== undefined && claimed !== principal.agentId)
    return json(403, { error: "token_agent_mismatch", token_agent_id: principal.agentId });
  return { ...args, agent_id: principal.agentId };
}

/** REST 版：对 scoped 主体的 POST JSON body 做同样的强绑定，返回可转发的 Request
 *  （body 可能被改写）或错误 Response。非 JSON/非对象 body 原样放行（DO 会 400/422）。 */
export async function bindScopedAgentRequest(
  req: Request,
  principal: RepoPrincipal,
): Promise<Request | Response> {
  if (principal.kind !== "scoped" || req.method !== "POST") return req;
  const text = await req.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* 交给 DO 报 invalid_json */
  }
  let body = text;
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const bound = bindScopedAgentArgs(principal, parsed as Record<string, unknown>);
    if (bound instanceof Response) return bound;
    body = JSON.stringify(bound);
  }
  return new Request(req.url, { method: req.method, headers: req.headers, body });
}

/** GET /tasks 的收件箱可见性绑定（F10-pre，语义等价 coord-service inbox_is_private）：
 *  scoped token 只能查自己的收件箱——assignee 缺省注入 token 身份；指定他人或 `*`
 *  一律 403。ops 万能钥匙与 admin 面不受限（协调层可查任何人/列全队，#706）。 */
export function bindScopedInboxQuery(
  search: URLSearchParams,
  principal: RepoPrincipal,
): URLSearchParams | Response {
  if (principal.kind !== "scoped") return search;
  const assignee = search.get("assignee");
  if (assignee !== null && assignee !== principal.agentId)
    return json(403, { error: "inbox_is_private", token_agent_id: principal.agentId });
  const bound = new URLSearchParams(search);
  bound.set("assignee", principal.agentId);
  return bound;
}

// ---------- REST 可达面 allowlist（F08 返工）----------
// scoped/API token 只能触达协调读写端点；/mirror/upsert（挂 admin 面）、/webhook/ingest、
// /projector/*、/tokens* 是内部/管理端点，普通透传一律 404。
// F06 投影 cron 与 Queues 消费者持 DO stub 直调（repoStub().fetch），不经 handleRest，不受影响。
// /stream 预留给 F09 实时化读端点（GET）。
export function isAllowedRestSubpath(method: string, sub: string): boolean {
  if (sub === "/claims") return true; // GET 列表 / POST 认领
  // tasks 收件箱（F10-pre）：GET 轮询 + ack/complete 归 scoped 面；
  // POST /tasks（派工）、/tasks/:id/recall（撤回）、/tasks/import（割接导入）
  // 是 COORD_ADMIN_TOKEN 管理面（index.ts 先行路由），普通透传一律 404
  if (sub === "/tasks") return method === "GET";
  if (/^\/tasks\/\d+\/(ack|complete)$/.test(sub)) return method === "POST";
  if (/^\/claims\/[^/]+\/(heartbeat|release)$/.test(sub)) return method === "POST";
  if (sub === "/events") return method === "GET";
  if (sub === "/evidence") return true; // GET 查询 / POST 提交声明
  if (sub === "/andon") return method === "GET"; // raise/clear 走 COORD_ADMIN_TOKEN 管理面
  if (sub === "/stream" || sub.startsWith("/stream/")) return method === "GET";
  if (sub.startsWith("/realtime/")) return method === "GET";
  return false;
}
