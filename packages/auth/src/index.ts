// packages/auth/src/index.ts — CAP-AUTH 纯逻辑（密码/校验/令牌/会话）
// 与 IO 解耦，全部可单测。表与仓储在 @repo/data；HTTP/cookie 在 apps/web。

import bcrypt from "bcryptjs";
import { randomBytes, randomUUID, createHash } from "node:crypto";

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
export const CURRENT_TEAM_COOKIE = "boardx_current_team";
export const TEAM_INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 天

// ─── 团队角色与权限（纯逻辑，可单测）─────────────────────────────────────────

export type TeamRole = "owner" | "admin" | "member";

const ROLE_RANK: Record<TeamRole, number> = { owner: 3, admin: 2, member: 1 };

export function isTeamRole(s: string): s is TeamRole {
  return s === "owner" || s === "admin" || s === "member";
}

/** owner/admin 可管理团队（邀请、改角色、移除、改名/删除）。 */
export function canManageTeam(role: TeamRole | undefined): boolean {
  return role === "owner" || role === "admin";
}

/** a 的角色是否 >= b（用于权限比较）。 */
export function roleAtLeast(a: TeamRole | undefined, b: TeamRole): boolean {
  return a ? ROLE_RANK[a] >= ROLE_RANK[b] : false;
}

// ─── 账号资料与偏好（纯逻辑，可单测）─────────────────────────────────────────

/** 确定性头像 seed（同输入同结果）。真 AI 生成头像 deferred；这里返回稳定 seed 串。 */
export function avatarSeed(input: string): string {
  return "seed:" + createHash("sha256").update(input).digest("hex").slice(0, 16);
}

/** 显示名回退：优先 displayName，否则 first+last，否则邮箱前缀。 */
export function resolveDisplayName(p: {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
}): string {
  if (p.displayName && p.displayName.trim()) return p.displayName.trim();
  const fl = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
  return fl || p.email.split("@")[0]!;
}

export const AI_MODELS = ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5"] as const;
export const PRIVACY_LEVELS = ["private", "team"] as const;

export function isAiModel(s: string): boolean {
  return (AI_MODELS as readonly string[]).includes(s);
}
export function isPrivacyLevel(s: string): boolean {
  return (PRIVACY_LEVELS as readonly string[]).includes(s);
}
