// apps/web/lib/ava-thread-auth.ts — AVA 线程归属校验（单一事实来源）
//
// #153：AVA 线程路由曾只校验 user_id，遗漏 team_id，导致跨团队用可枚举的线程 id 越权
// 访问。该 bug 此后在多个独立实现的路由里重复出现（含已合并上线的 share/route.ts）。
// 所有按 id 取 AVA 线程后做鉴权的路由必须调用这里的 isThreadInCurrentContext，
// 不要各自重新实现 user_id/team_id 比较逻辑。
export function isThreadInCurrentContext(
  thread: { user_id: number | string; team_id: number | string | null },
  userId: number,
  teamId: number | null
): boolean {
  const sameUser = String(thread.user_id) === String(userId);
  const sameTeam = thread.team_id == null ? teamId == null : teamId != null && String(thread.team_id) === String(teamId);
  return sameUser && sameTeam;
}
