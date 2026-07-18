// GitHub OAuth 会话层（p30-F02，D3 阶段 2 灰度）。
// 灰度期双栈：getSessionUser 先认 OAuth session cookie（HMAC 签名，本应用签发），
// 无 / 无效时回退 Cloudflare Access JWT（lib/access.ts）——Access 收缩到治理面之前
// 两条身份通道并存，任何一条可用即视为已登录（先加后删的「加」侧）。
//
// 密钥：SESSION_SECRET（Pages 加密 secret，≥32 字节随机串）。env 原子纪律：
// 先 `wrangler pages secret put SESSION_SECRET --project-name devportal` 再合入
// 引用它的代码。未配置时 session 层 fail-closed（签发 503 / 验证一律 null），
// Access 回退不受影响——灰度期不因缺 secret 断供。
import { jwtVerify, SignJWT } from "jose";
import { accessUser } from "./access";

export const SESSION_COOKIE = "devportal_session";
const ISSUER = "devportal";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7d

export interface SessionUser {
  /** GitHub login（OAuth 通道）或 Access 邮箱 local-part 推导（回退通道）。 */
  login: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  /** 身份来源：灰度期可观测双栈占比；Access 摘除（阶段 3）时据此清理。 */
  via: "oauth" | "access";
}

function secretKey(): Uint8Array | null {
  const raw = process.env["SESSION_SECRET"];
  if (!raw || raw.length < 16) return null;
  return new TextEncoder().encode(raw);
}

/** 签发 session JWT（HS256）。SESSION_SECRET 未配置 → null（调用方按 503 处理）。 */
export async function signSession(user: {
  login: string;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
}): Promise<string | null> {
  const key = secretKey();
  if (!key) return null;
  return new SignJWT({
    email: user.email ?? null,
    name: user.name ?? null,
    avatarUrl: user.avatarUrl ?? null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.login)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS)
    .sign(key);
}

/** 验证 session JWT；签名/过期/发行者任一不符 → null（绝不半信）。 */
export async function verifySession(token: string): Promise<SessionUser | null> {
  const key = secretKey();
  if (!key) return null;
  try {
    const { payload } = await jwtVerify(token, key, { issuer: ISSUER, algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    return {
      login: payload.sub,
      email: typeof payload["email"] === "string" ? payload["email"] : null,
      name: typeof payload["name"] === "string" ? payload["name"] : null,
      avatarUrl: typeof payload["avatarUrl"] === "string" ? payload["avatarUrl"] : null,
      via: "oauth",
    };
  } catch {
    return null;
  }
}

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

/** Set-Cookie 串（签发/清除共用属性面：HttpOnly + Secure + SameSite=Lax + Path=/）。 */
export function sessionCookieHeader(token: string, maxAgeSeconds = SESSION_TTL_SECONDS): string {
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

/** 请求 → 登录者。OAuth session 优先，Access JWT 兼容回退（灰度期双栈）。 */
export async function getSessionUser(headers: Headers): Promise<SessionUser | null> {
  const token = cookieValue(headers, SESSION_COOKIE);
  if (token) {
    const user = await verifySession(token);
    if (user) return user;
  }
  const access = await accessUser(headers);
  if (access) {
    const local = access.email.split("@")[0] ?? access.email;
    return {
      login: local.replace(/\./g, "").toLowerCase(),
      email: access.email,
      name: null,
      avatarUrl: null,
      via: "access",
    };
  }
  return null;
}
