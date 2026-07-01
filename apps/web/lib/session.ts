// apps/web/lib/session.ts — 会话 cookie 读写 + 当前用户（CAP-AUTH）
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  CURRENT_TEAM_COOKIE,
  newSessionId,
  expiresAt,
  resolveDisplayName,
} from "@repo/auth";
import {
  createSession,
  getSessionUser,
  deleteSession,
  type User,
} from "@repo/data";

export interface PublicUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatar: string | null;
}

export function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    email: u.email,
    firstName: u.first_name,
    lastName: u.last_name,
    displayName: resolveDisplayName({
      displayName: u.display_name,
      firstName: u.first_name,
      lastName: u.last_name,
      email: u.email,
    }),
    avatar: u.avatar ?? null,
  };
}

/** 为用户新建会话并写 httpOnly cookie。 */
export async function startSession(userId: number): Promise<void> {
  const id = newSessionId();
  await createSession(id, userId, expiresAt(SESSION_TTL_MS));
  cookies().set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

/** 读取当前登录用户（无/失效会话返回 undefined）。 */
export async function currentUser(): Promise<User | undefined> {
  const id = cookies().get(SESSION_COOKIE)?.value;
  if (!id) return undefined;
  return getSessionUser(id);
}

/** 登出：删会话 + 清 cookie。 */
export async function endSession(): Promise<void> {
  const id = cookies().get(SESSION_COOKIE)?.value;
  if (id) await deleteSession(id);
  cookies().delete(SESSION_COOKIE);
}

/** 当前团队上下文（cookie 未设置/用户未加入任何团队时为 null，即个人上下文）。
 *  与 /api/teams/current 读取同一 cookie，保持全站团队切换一致。 */
export function currentTeamId(): number | null {
  const raw = cookies().get(CURRENT_TEAM_COOKIE)?.value;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
