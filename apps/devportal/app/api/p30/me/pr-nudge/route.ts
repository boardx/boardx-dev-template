// POST /api/p30/me/pr-nudge — 「我卡住的 PR」催办按钮（p30/F08）。
//
// GITHUB_TOKEN 是只读 PAT（见 wrangler.toml 头注），本路由不能靠它写 GitHub
// 评论；「产生真实事件」走已有的 coord-gateway 派工 broker（lib/dispatch.ts
// 同款机制，#594 P3 起就在用 COORD_GATEWAY_ADMIN_TOKEN 写 RepoHub 管理面）——
// 催办 = 向 devportal 模块协调者（registry id: coord-devportal，缺省回退
// coord-main）派发一条 high 优先级任务，note 里带 PR 链接与真实催办人。这是
// 一次真实、可审计的 task.dispatched 事件（能在协调事件流里看到），不是
// UI 假装成功。
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";

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

  const gw = broker();
  if (!gw) return NextResponse.json({ error: "broker_not_configured" }, { status: 503 });

  const note = `[催办 PR] ${user.login} 催办 #${number}${typeof body.title === "string" ? ` ${body.title}` : ""}${typeof body.url === "string" ? ` · ${body.url}` : ""}`.slice(0, 1900);

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
