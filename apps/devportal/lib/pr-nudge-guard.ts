// pr-nudge 写路径加固（p30/F08 安全审收尾，PR #774 review）：
//
// pr-nudge 不是「纯读聚合」——它是一条真实写路径，会用 COORD_GATEWAY_ADMIN_TOKEN
// （写特权 master key）向 coord-gateway 派发真实 task.dispatched 事件。原实现对
// body.number 零归属校验、零限流：任何登录用户都能对任意 PR 号发起高优先级派工。
// 本文件拆出两条独立可测的加固检查，供 app/api/p30/me/pr-nudge/route.ts 调用：
//   - isOwnOpenPr：催办目标必须是「本人」名下的 open PR（fail-closed——任何疑点一律拒绝）。
//   - hasRecentNudge：同一 PR 短时间内已派过工，视为重复催办（best-effort 去重，
//     查询失败不因此阻断催办本体，只是不去重——这不是安全关卡，是滥用面的简单限流）。
const UPSTREAM_TIMEOUT_MS = 8_000;
const DEFAULT_COOLDOWN_MS = 15 * 60_000;

interface GhSearchItem {
  number: number;
}

/** 目标 PR 必须是 login 名下、GitHub 侧当前仍 open 的 PR。
 *  复用 app/api/p30/me/route.ts 里「我卡住的 PR」同款 Search API 查询（同 token、同 repo
 *  env var）：查询本身已经用 `author:${login}+is:open` 过滤，只要返回结果里不含该 number，
 *  就说明它要么不是本人的、要么已关闭/合并、要么根本不存在——三种情况一律拒绝，不区分。
 *  任何上游异常（未配置/超时/非 2xx/解析失败）都 fail-closed 返回 false，绝不因为「查不清
 *  楚」就放行。 */
export async function isOwnOpenPr(login: string, number: number): Promise<boolean> {
  const token = process.env["GITHUB_TOKEN"];
  const repo = process.env["GITHUB_REPO"];
  if (!token || !repo) return false;
  try {
    const res = await fetch(
      `https://api.github.com/search/issues?q=repo:${repo}+is:pr+is:open+author:${login}&per_page=20`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "boardx-devportal" },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        cache: "no-store",
      },
    );
    if (!res.ok) return false;
    const body = (await res.json()) as { items?: GhSearchItem[] };
    return (body.items ?? []).some((item) => item.number === number);
  } catch {
    return false;
  }
}

interface TaskRow {
  issue: number;
  created_at: string;
}

/** 同一 PR 号在 cooldownMs 内已经被（任何人）派过一次催办任务，视为命中冷却——拒绝重复派工。
 *  复用既有 GET /tasks?assignee=* 收件箱面（admin bearer，#706 全队可见），不新建基础设施；
 *  这是滥用面限流，不是安全关卡：查询本身失败（未配置/超时/非 2xx）时不阻断催办，只是放弃
 *  去重（best-effort，与 broker 本体的「最佳努力」风格一致）。 */
export async function hasRecentNudge(number: number, cooldownMs = DEFAULT_COOLDOWN_MS): Promise<boolean> {
  const token = process.env["COORD_GATEWAY_ADMIN_TOKEN"];
  const gatewayUrl = process.env["COORD_GATEWAY_URL"];
  const repo = process.env["GITHUB_REPO"];
  if (!token || !gatewayUrl || !repo) return false;
  try {
    const res = await fetch(`${gatewayUrl}/api/coord/repos/${repo}/tasks?assignee=*`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { tasks?: TaskRow[] };
    const now = Date.now();
    return (body.tasks ?? []).some(
      (t) => t.issue === number && now - new Date(t.created_at).getTime() < cooldownMs,
    );
  } catch {
    return false;
  }
}
