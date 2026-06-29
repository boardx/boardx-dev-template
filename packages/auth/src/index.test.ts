import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  normalizeEmail,
  isValidEmail,
  isValidPassword,
  validateRegister,
  generateToken,
  isExpired,
  expiresAt,
  canManageTeam,
  roleAtLeast,
  isTeamRole,
} from "./index";

describe("password", () => {
  it("hash 不等于明文，verify 正确匹配", async () => {
    const h = await hashPassword("secret123");
    expect(h).not.toBe("secret123");
    expect(await verifyPassword("secret123", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
});

describe("email/password 校验（业务规则）", () => {
  it("邮箱转小写", () => {
    expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
  });
  it("邮箱格式", () => {
    expect(isValidEmail("a@b.com")).toBe(true);
    expect(isValidEmail("bad")).toBe(false);
  });
  it("密码至少 6 位", () => {
    expect(isValidPassword("12345")).toBe(false);
    expect(isValidPassword("123456")).toBe(true);
  });
});

describe("validateRegister", () => {
  it("全空 → 多个字段错误", () => {
    const e = validateRegister({});
    expect(Object.keys(e).sort()).toEqual(["agreeTerms", "email", "firstName", "lastName", "password"]);
  });
  it("合法输入 → 无错误", () => {
    expect(
      validateRegister({ firstName: "A", lastName: "B", email: "a@b.com", password: "123456", agreeTerms: true })
    ).toEqual({});
  });
  it("未勾选条款 → agreeTerms 错误", () => {
    const e = validateRegister({ firstName: "A", lastName: "B", email: "a@b.com", password: "123456", agreeTerms: false });
    expect(e.agreeTerms).toBeDefined();
  });
});

describe("token/expiry", () => {
  it("token 随机且足够长", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });
  it("过期判断", () => {
    expect(isExpired(new Date(Date.now() - 1000))).toBe(true);
    expect(isExpired(expiresAt(10000))).toBe(false);
  });
});

describe("团队角色权限", () => {
  it("owner/admin 可管理，member 不可", () => {
    expect(canManageTeam("owner")).toBe(true);
    expect(canManageTeam("admin")).toBe(true);
    expect(canManageTeam("member")).toBe(false);
    expect(canManageTeam(undefined)).toBe(false);
  });
  it("roleAtLeast 比较", () => {
    expect(roleAtLeast("owner", "admin")).toBe(true);
    expect(roleAtLeast("member", "admin")).toBe(false);
    expect(roleAtLeast(undefined, "member")).toBe(false);
  });
  it("isTeamRole 守卫", () => {
    expect(isTeamRole("owner")).toBe(true);
    expect(isTeamRole("hacker")).toBe(false);
  });
});
