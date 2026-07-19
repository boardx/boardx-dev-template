// POST /api/p30/me/pr-nudge — 「我卡住的 PR」催办按钮（p30/F08）。
//
// GITHUB_TOKEN 是只读 PAT（见 wrangler.toml 头注），本路由不能靠它写 GitHub
// 评论；「产生真实事件」走已有的 coord-gateway 派工 broker（lib/dispatch.ts
// 同款机制，#594 P3 起就在用 COORD_GATEWAY_ADMIN_TOKEN 写 RepoHub 管理面）——
// 催办 = 向 devportal 模块协调者（registry id: coord-devportal，缺省回退
// coord-main）派发一条 high 优先级任务，note 里带 PR 链接与真实催办人。这是
// 一次真实、可审计的 task.dispatched 事件（能在协调事件流里看到），不是
// UI 假装成功。
//
// 安全审收尾（PR #774 review）：这是真实写路径，不是纯读聚合——补两条加固：
//   1. 归属校验（lib/pr-nudge-guard.ts#isOwnOpenPr）：催办目标必须是 body.number
//      对应、且是本人名下当前仍 open 的 PR，否则 403，fail-closed。
//   2. 冷却限流（lib/pr-nudge-guard.ts#hasRecentNudge）：同一 PR 短时间内已被
//      派过工则 429，best-effort（查询失败不阻断催办本体）。
// 另外 body.title/body.url 是客户端完全可控的自由文本，落进 note 会进协调事件流
// ——复用 lib/onboarding-issue.ts 已有的 sanitizeInline（同族注入问题同款修法），
// 不再只是 .slice 截断。
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { sanitizeInline } from "@/lib/onboarding-issue";
import { hasRecentNudge, isOwnOpenPr } from "@/lib/pr-nudge-guard";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const UPSTREAM_TIMEOUT_MS = 8_000;
const NUDGE_ASSIGNEE_FALLBACKS = ["coord-devportal", "coord-main"];

function broker(): { token: string; baseUrl: string } | null {
  const token = process.env["COORD_GATEWAY_ADMIN_TOKEN"];
  const gatewayUrl = process.env["COORD_GATEWAY_URL"];
  const repo = process.env["GITHUB_REPO"];
  if (!token || !gatewayUrl || !repo) return null;
  return { token, baseUrl: `${gatewayUrl}/api/coord/repos/${repo}` };
}

export async function POST(req: Request) {
  const user = await getSessionUser(req.headers);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { number?: unknown; title?: unknown; url?: unknown };
  const number = typeof body.number === "number" ? body.number : Number(body.number);
  if (!Number.isInteger(number) || number <= 0) {
    return NextResponse.json({ error: "missing_pr_number" }, { status: 400 });
  }

  // 归属校验：fail-closed——查无/非 open/非本人/上游异常一律拒绝，不放行任何疑点。
  const owns = await isOwnOpenPr(user.login, number);
  if (!owns) return NextResponse.json({ error: "not_your_open_pr" }, { status: 403 });

  const gw = broker();
  if (!gw) return NextResponse.json({ error: "broker_not_configured" }, { status: 503 });

  // 冷却限流：同一 PR 短时间内已派过工，拒绝重复催办（best-effort，非安全关卡）。
  if (await hasRecentNudge(number)) {
    return NextResponse.json({ error: "cooldown_active" }, { status: 429 });
  }

  const titlePart = typeof body.title === "string" ? ` ${sanitizeInline(body.title.slice(0, 1900))}` : "";
  const urlPart = typeof body.url === "string" ? ` · ${sanitizeInline(body.url.slice(0, 1900))}` : "";
  const note = `[催办 PR] ${user.login} 催办 #${number}${titlePart}${urlPart}`.slice(0, 1900);

  const res = await fetch(`${gw.baseUrl}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${gw.token}` },
    body: JSON.stringify({
      issue: number,
      assignee: NUDGE_ASSIGNEE_FALLBACKS[0],
      priority: "high",
      note,
      created_by: `devportal-me/${user.login}`,
    }),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))) as { error?: string };
    return NextResponse.json({ error: "nudge_failed", upstream: detail.error ?? res.status }, { status: 502 });
  }
  return NextResponse.json(await res.json(), { status: 201 });
}
