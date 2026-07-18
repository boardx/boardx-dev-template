// dispatch — 门户派工看板（#594 P3）。
//   GET  → 派工资格 + 可派 agent 列表 + 全队任务队列（coordinator 视角）
//   POST → 派工（验资格 → broker 代调 coord-gateway 管理面 POST /tasks，note 带真人 email；
//          F10-pre 起数据源为 RepoHub DO，coord-service 通道废弃）
// 门禁 Cloudflare Access；无派工资格的人看得到队列但不显示派工表单（前端）+ POST 403。
import { NextResponse } from "next/server";
import { accessUser, ownerMatches } from "@/lib/access";
import { loadRegistry, canDispatch, dispatchBroker } from "@/lib/dispatch";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const UPSTREAM_TIMEOUT_MS = 8_000;

interface Task {
  id: number; issue: number; assignee: string; priority: string;
  status: string; note: string | null; deadline: string | null;
  created_by: string; created_at: string; acked_at: string | null;
}

// —— 有意的团队级可见（人类 2026-07-18 确认，非漏洞）——
// 本 GET 对**任何通过 Cloudflare Access 的用户**返回全队任务队列，
// 含 created_by / 派工人 email（note 前缀）/ deadline 等字段。这是刻意的团队透明设计。
// 它**有意放宽**了上游声明的「协调者-only 读模型」：上游（F10-pre 起为 coord-gateway，
// 此前为 coord-service）对 worker 的 assignee=* 请求会返 403 inbox_is_private
// （per-user 隐私边界）。此处门户 broker 以协调者
// 身份绕过该 per-user 边界、把全队队列摊平给所有 Access 用户，是设计决策而非越权——
// 可见性由整站的 Cloudflare Access（GitHub org 成员）统一兜底。
// 注意:此放宽只作用于**读取（GET）**；派工（POST）仍严格限协调者（见下方 canDispatch 校验）。
export async function GET(req: Request) {
  const user = await accessUser(req.headers);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const agents = await loadRegistry();
  if (!agents) return NextResponse.json({ error: "registry_unavailable" }, { status: 502 });

  const may = canDispatch(agents, user.email);
  const broker = dispatchBroker();

  // 全队任务队列（broker 以协调者身份 assignee=* 列全部）；broker 未配置 → 空队列+提示
  let tasks: Task[] = [];
  let queueConfigured = false;
  if (broker) {
    try {
      const res = await fetch(`${broker.baseUrl}/tasks?assignee=*`, {
        headers: { Authorization: `Bearer ${broker.token}` },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        cache: "no-store",
      });
      if (res.ok) {
        tasks = ((await res.json()) as { tasks: Task[] }).tasks;
        queueConfigured = true;
      }
    } catch {
      /* 上游不可达 → 空队列，前端诚实降级 */
    }
  }

  // 可派 agent 列表：active 的非协调者身份（派活给 worker/sub-agent；协调者不互相派）
  const assignable = agents
    .filter((a) => a.active !== false && !["coordinator", "architecture-coordinator", "token-broker"].includes(a.kind))
    .map((a) => ({ id: a.id, kind: a.kind, owner: a.owner ?? null, is_mine: ownerMatches(a.owner, user.email) }));

  return NextResponse.json({ can_dispatch: may, broker_configured: Boolean(broker), queue_configured: queueConfigured, assignable, tasks });
}

export async function POST(req: Request) {
  const user = await accessUser(req.headers);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const agents = await loadRegistry();
  if (!agents) return NextResponse.json({ error: "registry_unavailable" }, { status: 502 });
  if (!canDispatch(agents, user.email)) {
    return NextResponse.json({ error: "not_a_coordinator" }, { status: 403 });
  }
  const broker = dispatchBroker();
  if (!broker) return NextResponse.json({ error: "broker_not_configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { issue?: unknown; assignee?: unknown; priority?: unknown; note?: unknown; deadline?: unknown };
  const issue = typeof body.issue === "number" ? body.issue : Number(body.issue);
  const assignee = typeof body.assignee === "string" ? body.assignee : "";
  if (!Number.isInteger(issue) || issue <= 0 || !assignee) {
    return NextResponse.json({ error: "missing_issue_or_assignee" }, { status: 400 });
  }
  // assignee 必须是 registry 里 active 的可派身份（前端已过滤，服务端再校验一次）
  if (!agents.some((a) => a.id === assignee && a.active !== false)) {
    return NextResponse.json({ error: "unknown_assignee" }, { status: 400 });
  }

  // 审计：note 前缀标注真实派工人（上游记录的 created_by 是 broker 身份；
  // F10-pre 起上游为 coord-gateway admin 面，broker 身份由本路由显式自报）
  const humanNote = `[派工人 ${user.email}] ${typeof body.note === "string" ? body.note : ""}`.trim().slice(0, 1900);
  const payload: Record<string, unknown> = { issue, assignee, note: humanNote, created_by: "devportal-broker" };
  if (typeof body.priority === "string") payload["priority"] = body.priority;
  if (typeof body.deadline === "string") payload["deadline"] = body.deadline;

  const res = await fetch(`${broker.baseUrl}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${broker.token}` },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))) as { error?: string };
    return NextResponse.json({ error: "dispatch_failed", upstream: detail.error ?? res.status }, { status: 502 });
  }
  return NextResponse.json(await res.json(), { status: 201 });
}
