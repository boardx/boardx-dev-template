// #769 Access JWT 回退验签单测：CF_ACCESS_AUD 强校验 + 未配置时的向后兼容告警。
// jwtVerify 走网络 JWKS，这里 mock "jose" 本身——只关心 accessUser 传给 jwtVerify 的
// options（是否带 audience）以及对其抛出/返回的响应处理，不测 jose 库本身。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const verifyMock = vi.fn();

vi.mock("jose", () => ({
  createRemoteJWKSet: () => "jwks-stub",
  jwtVerify: (...args: unknown[]) => verifyMock(...args),
}));

async function freshAccess() {
  vi.resetModules();
  return import("../lib/access");
}

beforeEach(() => {
  verifyMock.mockReset();
  delete process.env["CF_ACCESS_AUD"];
});
afterEach(() => {
  delete process.env["CF_ACCESS_AUD"];
});

describe("accessUser：CF_ACCESS_AUD 强校验", () => {
  it("无 Cf-Access-Jwt-Assertion 头 → null，不调用 jwtVerify", async () => {
    const { accessUser } = await freshAccess();
    expect(await accessUser(new Headers())).toBeNull();
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it("配置 CF_ACCESS_AUD 且 token aud 匹配 → 通过，jwtVerify 收到 audience 选项", async () => {
    process.env["CF_ACCESS_AUD"] = "expected-aud";
    verifyMock.mockImplementation((_token: string, _jwks: unknown, opts: { audience?: string }) => {
      expect(opts.audience).toBe("expected-aud");
      return Promise.resolve({ payload: { email: "u@x.com" } });
    });
    const { accessUser } = await freshAccess();
    const headers = new Headers({ "cf-access-jwt-assertion": "token" });
    expect(await accessUser(headers)).toEqual({ email: "u@x.com" });
  });

  it("配置 CF_ACCESS_AUD 但 aud 不匹配 → jwtVerify 抛出 → null（拒绝）", async () => {
    process.env["CF_ACCESS_AUD"] = "expected-aud";
    verifyMock.mockImplementation(() => {
      throw new Error("JWTClaimValidationFailed: unexpected aud claim value");
    });
    const { accessUser } = await freshAccess();
    const headers = new Headers({ "cf-access-jwt-assertion": "token" });
    expect(await accessUser(headers)).toBeNull();
  });

  it("未配置 CF_ACCESS_AUD → 仍验证 issuer+签名（无 audience 选项）+ 只警告不拒绝", async () => {
    verifyMock.mockImplementation((_token: string, _jwks: unknown, opts: { audience?: string }) => {
      expect(opts.audience).toBeUndefined();
      return Promise.resolve({ payload: { email: "u@x.com" } });
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { accessUser } = await freshAccess();
    const headers = new Headers({ "cf-access-jwt-assertion": "token" });
    expect(await accessUser(headers)).toEqual({ email: "u@x.com" });
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0]?.[0]).toContain("CF_ACCESS_AUD");
    warnSpy.mockRestore();
  });
});
