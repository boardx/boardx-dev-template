// GET /api/coord/oauth/github/callback?code=…&state=… — GitHub OAuth 回调。
// 该 URL 已在 GitHub App（4328933）侧注册；state 双向核对（query ↔ HMAC cookie）
// 防 CSRF/授权码注入；成功 → 签发 session cookie 并 302 回 return_to（白名单化）。
import {
  clearStateCookieHeader,
  exchangeCodeForUser,
  STATE_COOKIE,
  verifyState,
} from "@/lib/oauth";
import { sessionCookieHeader, signSession } from "@/lib/session";

export const runtime = "edge";

function cookieValue(headers: Headers, name: string): string | null {
  const raw = headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

function deny(reason: string): Response {
  // 失败不落半信状态：清 state cookie，401 + 人可读原因（不回显任何外部输入）。
  return new Response(JSON.stringify({ error: "oauth_failed", reason }), {
    status: 401,
    headers: { "content-type": "application/json", "set-cookie": clearStateCookieHeader() },
  });
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  if (!code || !stateParam) return deny("missing_code_or_state");

  const stateCookie = cookieValue(request.headers, STATE_COOKIE);
  if (!stateCookie) return deny("missing_state_cookie");
  const state = await verifyState(stateCookie);
  if (!state || state.nonce !== stateParam) return deny("state_mismatch");

  const user = await exchangeCodeForUser(code);
  if (!user) return deny("code_exchange_failed");

  const session = await signSession({
    login: user.login,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
  });
  if (!session) return deny("session_secret_missing");

  const headers = new Headers({ location: new URL(state.returnTo, url.origin).toString() });
  headers.append("set-cookie", sessionCookieHeader(session));
  headers.append("set-cookie", clearStateCookieHeader());
  return new Response(null, { status: 302, headers });
}
