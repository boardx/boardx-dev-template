// p30-F05 GitHub App 安装授权流单测：state 签发/核对（同构 OAuth CSRF 防护）、
// 未配置态诚实降级、cookie 属性面。
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SECRET = "test-session-secret-at-least-32-bytes!!";

beforeEach(() => {
  process.env["SESSION_SECRET"] = SECRET;
});
afterEach(() => {
  delete process.env["SESSION_SECRET"];
});

async function lib() {
  return import("../lib/onboard");
}

describe("buildInstallUrl：安装链接 + state 签发", () => {
  it("appSlug 未配置 → null（503 诚实降级，不拼错误链接）", async () => {
    const { buildInstallUrl } = await lib();
    expect(await buildInstallUrl(undefined, "/onboard")).toBeNull();
  });

  it("SESSION_SECRET 未配置 → null（state 签不出来，fail-closed）", async () => {
    const { buildInstallUrl } = await lib();
    delete process.env["SESSION_SECRET"];
    expect(await buildInstallUrl("boardx-devportal", "/onboard")).toBeNull();
  });

  it("正常态：安装链接指向真实 App slug，state 参数与 cookie 里签的 nonce 一致", async () => {
    const { buildInstallUrl, verifyInstallState } = await lib();
    const result = await buildInstallUrl("boardx-devportal", "/onboard");
    expect(result).not.toBeNull();
    const url = new URL(result!.url);
    expect(url.origin + url.pathname).toBe("https://github.com/apps/boardx-devportal/installations/new");
    const nonce = url.searchParams.get("state");
    expect(nonce).toBeTruthy();

    // cookieHeader 形如 "devportal_install_state=<token>; Path=...; ..."——取出 token 核对回调侧逻辑
    const token = result!.cookieHeader.split(";")[0]!.split("=")[1]!;
    const verified = await verifyInstallState(token, nonce);
    expect(verified).toEqual({ returnTo: "/onboard" });
  });

  it("cookie 属性面：HttpOnly + Secure + SameSite=Lax + Path 限定回调子路径", async () => {
    const { buildInstallUrl } = await lib();
    const result = await buildInstallUrl("boardx-devportal", "/onboard");
    expect(result!.cookieHeader).toContain("HttpOnly");
    expect(result!.cookieHeader).toContain("Secure");
    expect(result!.cookieHeader).toContain("SameSite=Lax");
    expect(result!.cookieHeader).toContain("Path=/api/coord/onboard");
  });
});

describe("verifyInstallState：回调 state 核对（防跨会话顶替/重放）", () => {
  it("state 参数与 cookie nonce 不一致 → null", async () => {
    const { buildInstallUrl, verifyInstallState } = await lib();
    const result = await buildInstallUrl("boardx-devportal", "/onboard");
    const token = result!.cookieHeader.split(";")[0]!.split("=")[1]!;
    expect(await verifyInstallState(token, "attacker-guessed-nonce")).toBeNull();
  });

  it("缺 cookie 或缺 state 参数 → null", async () => {
    const { verifyInstallState } = await lib();
    expect(await verifyInstallState(null, "n1")).toBeNull();
    expect(await verifyInstallState("some-token", null)).toBeNull();
  });

  it("篡改 cookie token → null（HMAC 签名保护）", async () => {
    const { buildInstallUrl, verifyInstallState } = await lib();
    const result = await buildInstallUrl("boardx-devportal", "/onboard");
    const url = new URL(result!.url);
    const nonce = url.searchParams.get("state")!;
    const token = result!.cookieHeader.split(";")[0]!.split("=")[1]!;
    const tampered = `${token.slice(0, -4)}AAAA`;
    expect(await verifyInstallState(tampered, nonce)).toBeNull();
  });
});
