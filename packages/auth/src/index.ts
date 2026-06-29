// packages/auth/src/index.ts — CAP-AUTH 纯逻辑（密码/校验/令牌/会话）
// 与 IO 解耦，全部可单测。表与仓储在 @repo/data；HTTP/cookie 在 apps/web。

import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "node:crypto";

// ─── 密码 ────────────────────────────────────────────────────────────────────

const SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ─── 校验（业务规则：邮箱小写、密码≥6）──────────────────────────────────────

export const MIN_PASSWORD_LENGTH = 6;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(normalizeEmail(email));
}

export function isValidPassword(pw: string): boolean {
  return typeof pw === "string" && pw.length >= MIN_PASSWORD_LENGTH;
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  agreeTerms: boolean;
}

/** 注册表单字段级校验；返回字段→错误信息（空对象=通过）。 */
export function validateRegister(input: Partial<RegisterInput>): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.firstName || !input.firstName.trim()) errors.firstName = "名不能为空";
  if (!input.lastName || !input.lastName.trim()) errors.lastName = "姓不能为空";
  if (!input.email || !isValidEmail(input.email)) errors.email = "邮箱格式无效";
  if (!input.password || !isValidPassword(input.password)) errors.password = `密码至少 ${MIN_PASSWORD_LENGTH} 位`;
  if (!input.agreeTerms) errors.agreeTerms = "请同意服务条款和隐私政策";
  return errors;
}

// ─── 令牌与会话 ──────────────────────────────────────────────────────────────

/** 不透明的随机令牌（用于密码重置/邮箱确认）。绝不可预测。 */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function newSessionId(): string {
  return randomUUID();
}

/** 过期时间戳（从现在起 N 毫秒）。 */
export function expiresAt(ms: number): Date {
  return new Date(Date.now() + ms);
}

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 天
export const RESET_TOKEN_TTL_MS = 1000 * 60 * 30; // 30 分钟

export function isExpired(at: Date | string): boolean {
  return new Date(at).getTime() <= Date.now();
}

export const SESSION_COOKIE = "boardx_session";
