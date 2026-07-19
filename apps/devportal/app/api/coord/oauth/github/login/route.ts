// GET /api/coord/oauth/github/login?return_to=/p/xxx — 发起 GitHub OAuth code flow。
// 签发一次性 state（HMAC cookie，含白名单化 return_to）后 302 到 GitHub authorize。
// 凭据未配置 → 503 诚实降级（env 原子纪律：secret 先 put 再合并，正常不触发）。
import {
  GITHUB_AUTHORIZE_URL,
  randomNonce,
  sanitizeReturnTo,
  signState,
  stateCookieHeader,
} from "@/lib/oauth";
import { readLastStop } from "@/lib/last-stop";

export const runtime = "edge";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const clientId = process.env["GITHUB_OAUTH_CLIENT_ID"];
  if (!clientId) {
    return Response.json(
      { error: "oauth_not_configured", detail: "GITHUB_OAUTH_CLIENT_ID 未配置" },
      { status: 503 },
    );
  }
  // D4「记住上次停留」：仅在没有显式 return_to 时才用上次停留兜底——中间件带着
  // 具体目标重定向登录（例如从 /p/xxx 被拦）的场景永远优先具体目标，不被此覆盖。
  const explicitReturnTo = url.searchParams.get("return_to");
  const lastStop = explicitReturnTo ? null : readLastStop(request.headers);
  const returnTo = sanitizeReturnTo(explicitReturnTo ?? lastStop);
  const nonce = randomNonce();
  const state = await signState(nonce, returnTo);
  if (!state) {
    return Response.json(
      { error: "oauth_not_configured", detail: "SESSION_SECRET 未配置" },
      { status: 503 },
    );
  }
  const authorize = new URL(GITHUB_AUTHORIZE_URL);
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("state", nonce);
  // redirect_uri 不下发：GitHub App 侧已注册唯一 callback URL，由 GitHub 强校验，
  // 少一个可被参数污染的输入面。
  return new Response(null, {
    status: 302,
    headers: { location: authorize.toString(), "set-cookie": stateCookieHeader(state) },
  });
}
