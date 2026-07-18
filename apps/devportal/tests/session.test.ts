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
