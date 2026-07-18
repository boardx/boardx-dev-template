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

/** 仓级访问鉴权（REST /api/coord/repos/:o/:r/* 与 MCP 共用）。
 *  通过返回 null；拒绝返回错误 Response（矩阵见文件头）。 */
export async function authorizeRepoAccess(
  req: Request,
  env: Env,
  repo: string,
): Promise<Response | null> {
  if (!env.COORD_API_TOKEN) return json(503, { error: "api_token_not_configured" });
  const bearer = bearerOf(req);
  if (!bearer) return json(401, { error: "unauthorized" });
  if (timingSafeEqualStr(bearer, env.COORD_API_TOKEN)) return null; // ops 万能钥匙

  // scoped token 路径：只发 hash 给 DO，明文不出本函数
  const hash = await sha256Hex(bearer);
  const stub = env.REPOHUB.get(env.REPOHUB.idFromName(repo));
  const res = await stub.fetch("https://repohub/tokens/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token_hash: hash }),
  });
  if (res.status === 200) return null;
  if (res.status === 401) return json(401, { error: "token_revoked" });
  if (res.status === 404) return json(403, { error: "token_not_valid_for_repo" }); // 跨仓/伪造
  // DO 侧异常（422 等）不放行——fail-closed
  return json(403, { error: "token_verification_failed", upstream_status: res.status });
}
