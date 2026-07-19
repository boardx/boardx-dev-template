// GitHub OAuth code flow 辅助（p30-F02）。GitHub App（App 4328933）的 OAuth 凭据：
//   GITHUB_OAUTH_CLIENT_ID      非敏感，wrangler.toml [vars]
//   GITHUB_OAUTH_CLIENT_SECRET  Pages 加密 secret（env 原子纪律：先 put 再合并）
// callback URL 已在 GitHub App 侧注册为
//   https://develop.boardx.us/api/coord/oauth/github/callback
// CSRF 防护：authorize 前签发一次性 state（随机 nonce + return_to，HMAC JWT 入
// HttpOnly cookie），callback 双向核对 query.state === cookie.nonce，10 分钟过期。
import { jwtVerify, SignJWT } from "jose";

export const STATE_COOKIE = "devportal_oauth_state";
const STATE_TTL_SECONDS = 600;
const STATE_ISSUER = "devportal-oauth";

export const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
export const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
export const GITHUB_USER_URL = "https://api.github.com/user";

function secretKey(): Uint8Array | null {
  const raw = process.env["SESSION_SECRET"];
  if (!raw || raw.length < 16) return null;
  return new TextEncoder().encode(raw);
}

/** return_to 白名单化：仅接受站内相对路径（防 open redirect / 防协议走私）。 */
export function sanitizeReturnTo(raw: string | null | undefined): string {
  const fallback = "/me";
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback; // 绝对 URL / 相对片段一律拒绝
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback; // 协议相对 URL
  // 控制字符 / 空白 / 反斜杠：拒绝（header 注入与路径混淆面）
  if (raw.includes("\\") || /[\u0000-\u0020\u007f]/.test(raw)) return fallback;
  return raw;
}

export function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signState(nonce: string, returnTo: string): Promise<string | null> {
  const key = secretKey();
  if (!key) return null;
  return new SignJWT({ nonce, return_to: sanitizeReturnTo(returnTo) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(STATE_ISSUER)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS)
    .sign(key);
}

export async function verifyState(
  token: string,
): Promise<{ nonce: string; returnTo: string } | null> {
  const key = secretKey();
  if (!key) return null;
  try {
    const { payload } = await jwtVerify(token, key, {
      issuer: STATE_ISSUER,
      algorithms: ["HS256"],
    });
    if (typeof payload["nonce"] !== "string" || !payload["nonce"]) return null;
    const returnTo =
      typeof payload["return_to"] === "string" ? sanitizeReturnTo(payload["return_to"]) : "/me";
    return { nonce: payload["nonce"], returnTo };
  } catch {
    return null;
  }
}

export function stateCookieHeader(token: string): string {
  return `${STATE_COOKIE}=${token}; Path=/api/coord/oauth; Max-Age=${STATE_TTL_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearStateCookieHeader(): string {
  return `${STATE_COOKIE}=; Path=/api/coord/oauth; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export interface GitHubOAuthUser {
  login: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}

/** code → access token → GitHub 用户。任一步失败 → null（调用方按 401 处理）。 */
export async function exchangeCodeForUser(code: string): Promise<GitHubOAuthUser | null> {
  const clientId = process.env["GITHUB_OAUTH_CLIENT_ID"];
  const clientSecret = process.env["GITHUB_OAUTH_CLIENT_SECRET"];
  if (!clientId || !clientSecret) return null;
  try {
    const tokenRes = await fetch(GITHUB_TOKEN_URL, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    if (!tokenRes.ok) return null;
    const tokenBody = (await tokenRes.json()) as { access_token?: string };
    if (!tokenBody.access_token) return null;
    const userRes = await fetch(GITHUB_USER_URL, {
      headers: {
        authorization: `Bearer ${tokenBody.access_token}`,
        accept: "application/vnd.github+json",
        "user-agent": "boardx-devportal",
      },
    });
    if (!userRes.ok) return null;
    const u = (await userRes.json()) as {
      login?: string;
      name?: string | null;
      email?: string | null;
      avatar_url?: string | null;
    };
    if (!u.login) return null;
    return {
      login: u.login,
      name: u.name ?? null,
      email: u.email ?? null,
      avatarUrl: u.avatar_url ?? null,
    };
  } catch {
    return null;
  }
}
