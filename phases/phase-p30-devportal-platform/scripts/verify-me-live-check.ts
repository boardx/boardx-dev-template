// verify-me-live-check.ts — p30/F08 端到端验证的 TS 助手（由 verify-me-live.sh 经
// `pnpm --filter devportal exec tsx` 调用，不直接执行）。
// 对活体 coord-gateway 派发一条真实 task.dispatched 事件（COORD_GATEWAY_ADMIN_TOKEN 写面），
// 拉回 /events，喂给真实的 lib/p30-decisions.ts（devportal 服务端用的同一份适配层），
// 断言：
//   1. 注入的任务在 N 秒内出现在推导结果里（新鲜度）；
//   2. 待拍板列表按 slaHoursLeft 升序（越紧急越靠前）。
// 用真实 GITHUB_REPO 的活体 RepoHub DO，不是本地 mock——F09 落地前，这是能验证到的
// 最接近真实的契约：适配层读的是真事件，不是测试夹具。
//
// 包成 async main() 而非顶层 await：脚本不在 devportal 包内，最近的 package.json
// 未声明 "type": "module"，tsx 按 CJS 转译时顶层 await 会报错。
import { buildDecisionSignals } from "../../../apps/devportal/lib/p30-decisions";

interface CoordEvent {
  event_id: string;
  type: string;
  resource_id: string;
  agent_id: string;
  at: string;
  payload: unknown;
}

async function main(): Promise<void> {
  const gatewayUrl = process.env["GATEWAY_URL"] ?? "https://coord-gateway.boardx.workers.dev";
  const repo = process.env["GITHUB_REPO"];
  const apiToken = process.env["COORD_API_TOKEN"];
  const adminToken = process.env["COORD_GATEWAY_ADMIN_TOKEN"];

  if (!repo || !apiToken || !adminToken) {
    console.error("FAIL: 需要 GITHUB_REPO / COORD_API_TOKEN / COORD_GATEWAY_ADMIN_TOKEN（活体验证凭据）");
    process.exit(1);
  }

  const base = `${gatewayUrl.replace(/\/+$/, "")}/api/coord/repos/${repo}`;
  const ts = Date.now();
  const urgentAssignee = `verify-me-urgent-${ts}`;
  const laxAssignee = `verify-me-lax-${ts}`;

  async function dispatch(assignee: string, deadlineMs: number, note: string): Promise<void> {
    const res = await fetch(`${base}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        issue: 1,
        assignee,
        priority: "high",
        note,
        deadline: new Date(ts + deadlineMs).toISOString(),
        created_by: "verify-me-live",
      }),
    });
    if (!res.ok) {
      console.error(`FAIL: POST /tasks (${assignee}) → ${res.status}`);
      console.error(await res.text());
      process.exit(1);
    }
  }

  console.log("== 1. 派发两条真实任务（不同紧急度）");
  await dispatch(urgentAssignee, 1 * 3_600_000, "verify-me-live: 紧急 1h 窗口");
  await dispatch(laxAssignee, 72 * 3_600_000, "verify-me-live: 宽松 72h 窗口");

  console.log("== 2. 拉回真实事件流，断言新鲜度（N 秒内可见）");
  const eventsRes = await fetch(`${base}/events?limit=500`, {
    headers: { authorization: `Bearer ${apiToken}` },
  });
  if (!eventsRes.ok) {
    console.error(`FAIL: GET /events → ${eventsRes.status}`);
    process.exit(1);
  }
  const eventsBody = (await eventsRes.json()) as { events?: CoordEvent[] };
  const events = eventsBody.events ?? [];
  const sawUrgent = events.some((e) => e.type === "task.dispatched" && (e.payload as { assignee?: string })?.assignee === urgentAssignee);
  const sawLax = events.some((e) => e.type === "task.dispatched" && (e.payload as { assignee?: string })?.assignee === laxAssignee);
  if (!sawUrgent || !sawLax) {
    console.error("FAIL: 刚派发的任务未出现在 /events（新鲜度不满足）");
    process.exit(1);
  }

  console.log("== 3. 真实适配层（lib/p30-decisions.ts）推导 + 排序断言");
  const urgentSignals = buildDecisionSignals(events, "verify-project", urgentAssignee);
  const laxSignals = buildDecisionSignals(events, "verify-project", laxAssignee);
  if (urgentSignals.length === 0) {
    console.error("FAIL: 紧急任务未被适配层识别为待拍板信号");
    process.exit(1);
  }
  if (laxSignals.length === 0) {
    console.error("FAIL: 宽松任务未被适配层识别为待拍板信号");
    process.exit(1);
  }
  if (!(urgentSignals[0]!.slaHoursLeft < laxSignals[0]!.slaHoursLeft)) {
    console.error("FAIL: 紧急任务的 slaHoursLeft 应小于宽松任务（排序键错误）");
    process.exit(1);
  }

  console.log("OK: 待拍板信号来自真实事件流，且 SLA 排序键正确。");
}

main().catch((err) => {
  console.error("FAIL: 未预期异常", err);
  process.exit(1);
});
