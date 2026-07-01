// apps/web/lib/admin.ts — P15 Admin 后台：SysAdmin 角色门控（F01 骨架）
// 复用 phase-04 的会话读取（lib/session.currentUser）+ packages/auth 的 isSysAdmin 纯逻辑。
// 页面（server component）与 API 路由共用同一套判定，避免门控逻辑分叉。

import { isSysAdmin } from "@repo/auth";
import type { User } from "@repo/data";
import { currentUser } from "@/lib/session";

export type AdminGateResult =
  | { ok: true; user: User }
  | { ok: false; reason: "unauthenticated" | "forbidden" };

/** 读当前会话用户并判定是否为 SysAdmin。未登录/非管理员分别返回不同 reason，供调用方决定 401 或 403/重定向。 */
export async function requireSysAdmin(): Promise<AdminGateResult> {
  const user = await currentUser();
  if (!user) return { ok: false, reason: "unauthenticated" };
  if (!isSysAdmin(user.platform_role)) return { ok: false, reason: "forbidden" };
  return { ok: true, user };
}
