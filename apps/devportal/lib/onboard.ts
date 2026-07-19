// GitHub App 安装授权流辅助（p30-F05，UC-01）。复用 lib/oauth.ts 的 state 签发/校验
// 机制（HMAC(HS256) nonce + 白名单化 return_to）——安装流与 OAuth 登录流是同构的
// CSRF 防护需求：都是「跳到 GitHub → 跳回本站」，都需要防止跨会话的授权结果被顶替。
//
// 安装流与 OAuth 流的关键差异：GitHub App 安装的「Setup URL」回调只带
// installation_id/setup_action/state 三个 query 参数，不带 code（不是 OAuth code
// exchange）；state 由本站生成、随安装链接一起交给 GitHub、原样带回——只需核对
// query.state === cookie 里签的 nonce，同 OAuth state 核对逻辑，故直接复用 verifyState。
//
// GITHUB_APP_SLUG（非敏感 var，wrangler.toml [vars]）：App 的公开 slug（不是数字 ID
// 4328933，也不是 OAuth client id）——安装链接格式 https://github.com/apps/<slug>/installations/new。
import { randomNonce, sanitizeReturnTo, signState, verifyState } from "./oauth";

export const INSTALL_STATE_COOKIE = "devportal_install_state";
const INSTALL_STATE_TTL_SECONDS = 600;

export function installStateCookieHeader(token: string): string {
  return `${INSTALL_STATE_COOKIE}=${token}; Path=/api/coord/onboard; Max-Age=${INSTALL_STATE_TTL_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearInstallStateCookieHeader(): string {
  return `${INSTALL_STATE_COOKIE}=; Path=/api/coord/onboard; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export interface InstallUrlResult {
  url: string;
  cookieHeader: string;
}

/** 构造真实「跳转 GitHub 安装」链接：随机 nonce 签入 HttpOnly cookie，同一 nonce 附在
 *  安装链接的 state 参数上——GitHub 安装完成后原样带回，回调侧核对两者一致。
 *  appSlug 未配置 / SESSION_SECRET 未配置 → null（调用方按 503 处理，诚实降级）。 */
export async function buildInstallUrl(appSlug: string | undefined, returnTo: string): Promise<InstallUrlResult | null> {
  if (!appSlug) return null;
  const nonce = randomNonce();
  const state = await signState(nonce, sanitizeReturnTo(returnTo));
  if (!state) return null;
  const install = new URL(`https://github.com/apps/${appSlug}/installations/new`);
  install.searchParams.set("state", nonce);
  return { url: install.toString(), cookieHeader: installStateCookieHeader(state) };
}

export interface VerifiedInstall {
  returnTo: string;
}

/** 回调核对：query.state 必须等于 cookie 里签的 nonce（防止安装结果被跨会话顶替/重放）。 */
export async function verifyInstallState(stateCookie: string | null, stateParam: string | null): Promise<VerifiedInstall | null> {
  if (!stateCookie || !stateParam) return null;
  const verified = await verifyState(stateCookie);
  if (!verified || verified.nonce !== stateParam) return null;
  return { returnTo: verified.returnTo };
}
