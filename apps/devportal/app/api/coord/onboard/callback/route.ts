// GET /api/coord/onboard/callback?installation_id=&setup_action=&state=
// — GitHub App 安装流回调（p30-F05，UC-01）。该 URL 需在 GitHub App（4328933）的
// 「Setup URL」侧注册（同 F02 OAuth callback 的手工登记方式）。
//
// 不是 OAuth code exchange（没有 code）——只需核对 query.state 与安装前签发的
// cookie nonce 一致（防止安装结果跨会话被顶替/重放），随后把 installation_id 转交
// 页面（/onboard），不下发任何凭据到浏览器。
import { clearInstallStateCookieHeader, INSTALL_STATE_COOKIE, verifyInstallState } from "@/lib/onboard";

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
  return new Response(JSON.stringify({ error: "install_callback_failed", reason }), {
    status: 401,
    headers: { "content-type": "application/json", "set-cookie": clearInstallStateCookieHeader() },
  });
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const installationId = url.searchParams.get("installation_id");
  const setupAction = url.searchParams.get("setup_action");
  const stateParam = url.searchParams.get("state");
  if (!installationId || !stateParam) return deny("missing_installation_id_or_state");
  // 用户在安装页选择「取消」时 GitHub 仍可能回调且带 installation_id——setup_action
  // 非 install/update 一律视为未完成安装，不往下走（诚实态：不假装安装成功）。
  if (setupAction && !["install", "update"].includes(setupAction)) return deny(`unexpected_setup_action:${setupAction}`);

  const stateCookie = cookieValue(request.headers, INSTALL_STATE_COOKIE);
  const verified = await verifyInstallState(stateCookie, stateParam);
  if (!verified) return deny("state_mismatch");

  const dest = new URL(verified.returnTo, url.origin);
  dest.searchParams.set("installation_id", installationId);
  const headers = new Headers({ location: dest.toString() });
  headers.append("set-cookie", clearInstallStateCookieHeader());
  return new Response(null, { status: 302, headers });
}
