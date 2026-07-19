// p30-F02 会话层单测：HMAC session 签发/验证、双栈回退、state/return_to 安全面。
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SECRET = "test-session-secret-at-least-32-bytes!!";

beforeEach(() => {
  process.env["SESSION_SECRET"] = SECRET;
});
afterEach(() => {
  delete process.env["SESSION_SECRET"];
});

async function libs() {
  const session = await import("../lib/session");
  const oauth = await import("../lib/oauth");
  return { ...session, ...oauth };
}

describe("session 签发与验证", () => {
  it("签发 → 验证 roundtrip 保留身份字段，via=oauth", async () => {
    const { signSession, verifySession } = await libs();
    const token = await signSession({ login: "usamshen", email: "u@x.com", name: "U", avatarUrl: "https://a/b.png" });
    expect(token).toBeTruthy();
    const user = await verifySession(token as string);
    expect(user).toMatchObject({ login: "usamshen", email: "u@x.com", via: "oauth" });
  });

  it("篡改 token → null（绝不半信）", async () => {
    const { signSession, verifySession } = await libs();
    const token = (await signSession({ login: "usamshen" })) as string;
    const tampered = `${token.slice(0, -4)}AAAA`;
    expect(await verifySession(tampered)).toBeNull();
  });

  it("SESSION_SECRET 未配置 → 签发 null、验证 null（fail-closed）", async () => {
    const { signSession, verifySession } = await libs();
    const token = (await signSession({ login: "usamshen" })) as string;
    delete process.env["SESSION_SECRET"];
    expect(await signSession({ login: "x" })).toBeNull();
    expect(await verifySession(token)).toBeNull();
  });

  it("getSessionUser：合法 cookie → oauth 身份；无 cookie 无 Access → null", async () => {
    const { signSession, getSessionUser, SESSION_COOKIE } = await libs();
    const token = (await signSession({ login: "usamshen" })) as string;
    const withCookie = new Headers({ cookie: `${SESSION_COOKIE}=${token}` });
    expect((await getSessionUser(withCookie))?.via).toBe("oauth");
    expect(await getSessionUser(new Headers())).toBeNull();
  });

  it("SESSION_COOKIE 带 __Host- 前缀（要求 Secure+Path=/+无 Domain，均已满足）", async () => {
    const { SESSION_COOKIE } = await libs();
    expect(SESSION_COOKIE.startsWith("__Host-")).toBe(true);
  });

  it("SESSION_TTL_SECONDS 收紧到 24h", async () => {
    const { SESSION_TTL_SECONDS } = await libs();
    expect(SESSION_TTL_SECONDS).toBe(24 * 60 * 60);
  });
});

describe("resolveSession 静默续期", () => {
  it("剩余寿命 > 半程 TTL → 不续期，renewedCookie 为 null", async () => {
    const { signSession, resolveSession, SESSION_COOKIE } = await libs();
    const token = (await signSession({ login: "usamshen" })) as string;
    const headers = new Headers({ cookie: `${SESSION_COOKIE}=${token}` });
    const result = await resolveSession(headers);
    expect(result?.user.via).toBe("oauth");
    expect(result?.renewedCookie).toBeNull();
  });

  it("剩余寿命 < 半程 TTL → 续期，renewedCookie 是新的 __Host- Set-Cookie 串", async () => {
    const { resolveSession, SESSION_COOKIE, verifySession } = await libs();
    // 直接构造一个「快过半」的 token：签发时把 exp 收窄到 TTL 的 10%，模拟临期会话。
    const { SignJWT } = await import("jose");
    const key = new TextEncoder().encode(SECRET);
    const nearExpiry = await new SignJWT({ email: null, name: null, avatarUrl: null })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("usamshen")
      .setIssuer("devportal")
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + 60) // 60s 剩余 << 半程 TTL
      .sign(key);
    const headers = new Headers({ cookie: `${SESSION_COOKIE}=${nearExpiry}` });
    const result = await resolveSession(headers);
    expect(result?.user.login).toBe("usamshen");
    expect(result?.renewedCookie).toBeTruthy();
    expect(result?.renewedCookie).toContain(SESSION_COOKIE);
    // 续期签发的新 token 本身应能通过验证。
    const [cookiePair] = (result?.renewedCookie as string).split(";");
    const fresh = cookiePair?.split("=").slice(1).join("=") ?? "";
    expect((await verifySession(fresh))?.login).toBe("usamshen");
  });
});

describe("OAuth state 与 return_to 安全面", () => {
  it("state roundtrip；nonce 不符 → 调用方视为 mismatch", async () => {
    const { signState, verifyState } = await libs();
    const token = (await signState("nonce-1", "/p/boardx/coord")) as string;
    const state = await verifyState(token);
    expect(state).toEqual({ nonce: "nonce-1", returnTo: "/p/boardx/coord" });
  });

  it("state 篡改 → null", async () => {
    const { signState, verifyState } = await libs();
    const token = (await signState("nonce-1", "/me")) as string;
    expect(await verifyState(`${token.slice(0, -4)}AAAA`)).toBeNull();
  });

  it("return_to 白名单化：站内相对路径放行，其余落 /me（防 open redirect）", async () => {
    const { sanitizeReturnTo } = await libs();
    expect(sanitizeReturnTo("/p/boardx/work?tab=1")).toBe("/p/boardx/work?tab=1");
    expect(sanitizeReturnTo("https://evil.example")).toBe("/me");
    expect(sanitizeReturnTo("//evil.example")).toBe("/me");
    expect(sanitizeReturnTo("/\\evil.example")).toBe("/me");
    expect(sanitizeReturnTo("/a\nb")).toBe("/me");
    expect(sanitizeReturnTo(null)).toBe("/me");
  });

  it("cookie 属性面：HttpOnly + Secure + SameSite=Lax（session 与 state 一致）", async () => {
    const { sessionCookieHeader, stateCookieHeader } = await libs();
    for (const header of [sessionCookieHeader("t"), stateCookieHeader("t")]) {
      expect(header).toContain("HttpOnly");
      expect(header).toContain("Secure");
      expect(header).toContain("SameSite=Lax");
    }
  });
});
