// cycle-report.ts — C-cycle 周期健康表（只读，无 --apply 概念）。
//
// 来源：work-cycle-proposal.md §4.2（PR #443 + amendments）。聚合三个数据源：
// 1. 专用 work-cycle issue（label coordination:work-cycle）上的 cycle-plan/result 评论
//    ——谁在本周期承诺了什么、上周期完成率；
// 2. gh pr list——open PR 的等待时长（SLA：新 PR 同周期内要有首个 review 结论）、
//    近 24h merged PR 的 开出→合并 流动时间（提案唯一成功指标）；
// 3. coord-service GET /status（设了 COORD_SERVICE_URL 才查；这是公开只读端点，
//    无需 token）——active_claims 的心跳年龄，SLA "in_progress 无进展"的权威数据源。
//
// 周期时钟：UTC 整点 00/03/06/09/12/15/18/21 锚定，cycle id = 起始时刻 ISO8601。
import { sh } from "./lib/sh";
import { log } from "./lib/log";
import type { Args } from "./lib/args";

const CYCLE_HOURS = 3;
const WORK_CYCLE_LABEL = "coordination:work-cycle";

interface PrSummary {
  number: number;
  title: string;
  createdAt: string;
  mergedAt?: string;
}

interface IssueComment {
  body: string;
  createdAt: string;
}

function currentCycleStart(now: Date): Date {
  const d = new Date(now);
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(Math.floor(d.getUTCHours() / CYCLE_HOURS) * CYCLE_HOURS);
  return d;
}

function cycleId(start: Date): string {
  return start.toISOString().replace(/:\d{2}\.\d{3}Z$/, "Z").replace(/:00Z$/, "Z");
}

function hoursBetween(aIso: string, b: Date): number {
  return (b.getTime() - new Date(aIso).getTime()) / 3_600_000;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  const lower = sorted[mid - 1];
  const upper = sorted[mid];
  if (sorted.length % 2 === 0 && lower !== undefined && upper !== undefined) {
    return (lower + upper) / 2;
  }
  return upper ?? null;
}

function findWorkCycleIssue(): number | null {
  const result = sh(
    `gh issue list --state open --label ${JSON.stringify(WORK_CYCLE_LABEL)} --json number --limit 1`
  );
  if (result.code !== 0) return null;
  const parsed = JSON.parse(result.stdout || "[]") as Array<{ number: number }>;
  return parsed[0]?.number ?? null;
}

function readCycleComments(issueNumber: number): IssueComment[] {
  const result = sh(
    `gh issue view ${issueNumber} --json comments --jq '[.comments[-60:][] | {body, createdAt}]'`
  );
  if (result.code !== 0) return [];
  try {
    return JSON.parse(result.stdout || "[]") as IssueComment[];
  } catch {
    return [];
  }
}

function listPrs(state: "open" | "merged", limit: number): PrSummary[] {
  const fields = state === "merged" ? "number,title,createdAt,mergedAt" : "number,title,createdAt";
  const result = sh(`gh pr list --state ${state} --limit ${limit} --json ${fields}`);
  if (result.code !== 0) return [];
  try {
    return JSON.parse(result.stdout || "[]") as PrSummary[];
  } catch {
    return [];
  }
}

async function fetchActiveClaims(): Promise<Array<{ resource_id: string; agent_id: string; last_heartbeat_at: string }> | null> {
  const baseUrl = process.env["COORD_SERVICE_URL"];
  if (!baseUrl) return null;
  try {
    const res = await fetch(`${baseUrl}/status`, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { active_claims?: Array<{ resource_id: string; agent_id: string; last_heartbeat_at: string }> };
    return body.active_claims ?? [];
  } catch {
    return null;
  }
}

export async function cycleReport(_args: Args): Promise<void> {
  const now = new Date();
  const cycleStart = currentCycleStart(now);
  const id = cycleId(cycleStart);
  const elapsedMinutes = ((now.getTime() - cycleStart.getTime()) / 60_000).toFixed(0);
  log.step(`当前周期：${id}（已进行 ${elapsedMinutes} 分钟 / ${CYCLE_HOURS * 60} 分钟）`);

  // 1. cycle-plan / cycle-result 评论
  const issueNumber = findWorkCycleIssue();
  if (issueNumber === null) {
    log.warn(`未找到 label 为 ${WORK_CYCLE_LABEL} 的 work-cycle issue——cycle-plan/result 无处可读。`);
  } else {
    const comments = readCycleComments(issueNumber);
    const plans = comments.filter((c) => c.body.startsWith("cycle-plan") && c.body.includes(`cycle:${id}`));
    const results = comments.filter((c) => c.body.startsWith("cycle-result"));
    log.info(`work-cycle issue：#${issueNumber}`);
    if (plans.length === 0) {
      log.warn(`本周期（${id}）还没有任何 cycle-plan——周期开始 10 分钟内每个在任 coordinator 应发一条。`);
    } else {
      log.info(`本周期 cycle-plan（${plans.length} 条）：`);
      for (const p of plans) {
        const byMatch = /by:(\S+)/.exec(p.body);
        const commitLine = p.body.split("\n").find((l) => l.startsWith("commit:")) ?? "";
        log.info(`  - ${byMatch?.[1] ?? "?"} ${commitLine}`);
      }
    }
    const lastResult = results[results.length - 1];
    if (lastResult) {
      log.info(`最近一条 cycle-result（${lastResult.createdAt}）：${lastResult.body.split("\n")[0]}`);
    }
  }

  // 2. open PR 等待时长（SLA：同周期内要有首个 review 结论；这里报的是 open 时长，
  //    review 明细留给人看 PR 页面——脚本只标记"开了超过一个周期还 open"的）
  const openPrs = listPrs("open", 50);
  const stale = openPrs.filter((pr) => hoursBetween(pr.createdAt, now) > CYCLE_HOURS);
  log.info(`open PR：${openPrs.length} 个，其中 ${stale.length} 个已开出超过一个周期（${CYCLE_HOURS}h）：`);
  for (const pr of stale) {
    log.info(`  ⚠ #${pr.number}（open ${hoursBetween(pr.createdAt, now).toFixed(1)}h）${pr.title.slice(0, 60)}`);
  }

  // 3. flow time（唯一成功指标）：近 24h merged 的 开出→合并 中位时长
  const merged = listPrs("merged", 30).filter(
    (pr) => pr.mergedAt && hoursBetween(pr.mergedAt, now) <= 24
  );
  const flowHours = merged
    .map((pr) => (pr.mergedAt ? hoursBetween(pr.createdAt, new Date(pr.mergedAt)) : null))
    .filter((v): v is number => v !== null);
  const medianFlow = median(flowHours);
  log.info(
    `flow time（近 24h 合并的 ${merged.length} 个 PR，开出→合并中位时长）：` +
      (medianFlow === null ? "无数据" : `${medianFlow.toFixed(1)}h`)
  );

  // 4. coord-service active_claims（权威租约状态）
  const claims = await fetchActiveClaims();
  if (claims === null) {
    log.info("coord-service：COORD_SERVICE_URL 未配置或不可达——跳过租约健康检查。");
  } else if (claims.length === 0) {
    log.info("coord-service：无活跃租约。");
  } else {
    log.info(`coord-service 活跃租约（${claims.length} 个）：`);
    for (const c of claims) {
      const heartbeatAgeMinutes = (now.getTime() - new Date(c.last_heartbeat_at).getTime()) / 60_000;
      const flag = heartbeatAgeMinutes > 30 ? "⚠ " : "";
      log.info(`  ${flag}${c.resource_id} ← ${c.agent_id}（心跳 ${heartbeatAgeMinutes.toFixed(0)} 分钟前）`);
    }
  }
}
