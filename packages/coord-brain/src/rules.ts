// 五类机械 SOP 规则——纯函数，无 IO、无副作用（R1 影子模式，p30-F10）。
// 权威语义：requirements/coord-resident.md「目标架构 §1」+ feature_list.json F10。
//
// 安全不变量（边界测试的核心）：andon 活跃时，无论 PR 判定多"绿"，合并判定
// 必须为 false——这是渐进接管 R1→R5 全程都不可违反的红线（人类环不变）。
import type {
  AndonSnapshot,
  IssueSnapshot,
  LeaseSnapshot,
  ModuleAffinity,
  PrSnapshot,
  ShadowDecision,
  ShadowDecisionInput,
  ShadowThresholds,
} from "./types";
import { DEFAULT_THRESHOLDS } from "./types";

// ---------- 1. 全绿可合并判定 ----------

export interface MergeReadyDecision {
  ready: boolean;
  reason: string;
}

/** andon 活跃 → 恒为 false（红线）；否则要求 mergeable=MERGEABLE 且
 *  merge_state=CLEAN（GitHub 已把 checks 绿/review 齐/up-to-date 编码进这一字段）。 */
export function decideMergeReady(pr: PrSnapshot, andon: AndonSnapshot): MergeReadyDecision {
  if (andon.active) return { ready: false, reason: "andon_active" };
  if (pr.mergeable !== "MERGEABLE")
    return { ready: false, reason: `mergeable_${pr.mergeable ?? "unknown"}` };
  if (pr.merge_state !== "CLEAN")
    return { ready: false, reason: `merge_state_${pr.merge_state ?? "unknown"}` };
  return { ready: true, reason: "checks_green_review_ok_up_to_date" };
}

// ---------- 2. ready-for-dev 派工判定 ----------

export interface DispatchDecision {
  shouldDispatch: boolean;
  suggestedAssignee?: string;
  reason: string;
}

function moduleLabels(labels: string[]): string[] {
  return labels.filter((l) => l.startsWith("module:"));
}

/** 无活跃租约 + 带 ready-for-dev 标签 + 能从模块标签查到亲和 assignee → 建议派工。
 *  任一条件不满足则不建议（宁可漏派、不可乱派——影子模式只观察不执行，误报比漏报
 *  更损害「零误判」台账，故 no-match 一律判 false）。 */
export function decideDispatch(
  issue: IssueSnapshot,
  activeLeases: LeaseSnapshot[],
  affinity: ModuleAffinity,
  readyForDevLabel: string,
): DispatchDecision {
  const resourceId = `issue:${issue.number}`;
  if (issue.state !== "open")
    return { shouldDispatch: false, reason: "issue_not_open" };
  if (!issue.labels.includes(readyForDevLabel))
    return { shouldDispatch: false, reason: "missing_ready_for_dev_label" };
  if (activeLeases.some((l) => l.resource_id === resourceId))
    return { shouldDispatch: false, reason: "active_lease_exists" };
  const mods = moduleLabels(issue.labels);
  for (const m of mods) {
    const assignee = affinity[m];
    if (assignee) return { shouldDispatch: true, suggestedAssignee: assignee, reason: `affinity_${m}` };
  }
  return { shouldDispatch: false, reason: "no_affinity_match" };
}

// ---------- 3. PR 超时催办判定 ----------

export interface PrNudgeDecision {
  shouldNudge: boolean;
  waitMs: number | null;
  reason: string;
}

/** 等待时长 = now - opened_at；超过阈值且非 DRAFT → 催办。缺 opened_at 时不可判定，
 *  fail-closed 为不催办（宁可漏报，不可对无凭据对象产生动作性建议）。 */
export function decidePrNudge(
  pr: PrSnapshot,
  now: number,
  thresholdMs: number,
): PrNudgeDecision {
  if (pr.merge_state === "DRAFT") return { shouldNudge: false, waitMs: null, reason: "draft_pr" };
  if (!pr.opened_at) return { shouldNudge: false, waitMs: null, reason: "opened_at_unknown" };
  const waitMs = now - Date.parse(pr.opened_at);
  if (!Number.isFinite(waitMs) || waitMs < 0) return { shouldNudge: false, waitMs: null, reason: "opened_at_invalid" };
  if (waitMs < thresholdMs) return { shouldNudge: false, waitMs, reason: "within_threshold" };
  return { shouldNudge: true, waitMs, reason: "wait_exceeds_threshold" };
}

// ---------- 4. stale 租约回收判定 ----------

export interface StaleLeaseDecision {
  shouldReclaim: boolean;
  staleMs: number;
  reason: string;
}

/** 心跳静默超过阈值，或已到硬 TTL 到期时刻 → 起草回收请求（R1 只观察，不真的回收；
 *  RepoHub 自身 alarm 到期后仍会机械过期，这里是"更早"的软预警，供人类核对是否提前
 *  介入）。 */
export function decideStaleLeaseReclaim(
  lease: LeaseSnapshot,
  now: number,
  staleHeartbeatMs: number,
): StaleLeaseDecision {
  const staleMs = now - Date.parse(lease.last_heartbeat_at);
  const pastExpiry = now >= Date.parse(lease.expires_at);
  if (pastExpiry) return { shouldReclaim: true, staleMs, reason: "past_hard_ttl_expiry" };
  if (staleMs >= staleHeartbeatMs) return { shouldReclaim: true, staleMs, reason: "heartbeat_stale" };
  return { shouldReclaim: false, staleMs, reason: "heartbeat_fresh" };
}

// ---------- 5. andon 冻结判定 ----------

export interface AndonFreezeDecision {
  frozen: boolean;
  reason: string;
}

/** andon 状态 → 冻结判定。与 decideMergeReady 的红线共享同一输入，这里单独暴露
 *  是为了让影子事件流里能独立看到"冻结判定"本身（而不必反推自 merge_ready）。 */
export function decideAndonFreeze(andon: AndonSnapshot): AndonFreezeDecision {
  if (!andon.active) return { frozen: false, reason: "not_active" };
  const head = andon.andons[0];
  return { frozen: true, reason: head ? `${head.scope}:${head.reason}` : "active" };
}

// ---------- 汇总：一次 tick 跑全部规则 ----------

/** 对一个仓的当前状态快照跑全部五类规则，产出「本 tick 将会做的决策」列表。
 *  纯函数：同输入同输出，可重放、可单测、无副作用。宿主（CoordBrain DO）负责
 *  把返回值原样写进 coord.shadow.* 事件流，绝不据此发起任何写 API 调用。 */
export function runShadowSopCycle(
  input: ShadowDecisionInput,
  thresholds: ShadowThresholds = DEFAULT_THRESHOLDS,
): ShadowDecision[] {
  const { prs, issues, leases, andon, affinity, now } = input;
  const decisions: ShadowDecision[] = [];

  decisions.push({
    rule: "andon_freeze",
    subject_id: "repo",
    decision: decideAndonFreeze(andon).frozen,
    reason: decideAndonFreeze(andon).reason,
  });

  for (const pr of prs) {
    const merge = decideMergeReady(pr, andon);
    decisions.push({
      rule: "merge_ready",
      subject_id: `pr:${pr.number}`,
      decision: merge.ready,
      reason: merge.reason,
      detail: { mergeable: pr.mergeable, merge_state: pr.merge_state, andon_active: andon.active },
    });

    const nudge = decidePrNudge(pr, now, thresholds.prNudgeMs);
    decisions.push({
      rule: "pr_nudge",
      subject_id: `pr:${pr.number}`,
      decision: nudge.shouldNudge,
      reason: nudge.reason,
      detail: { wait_ms: nudge.waitMs },
    });
  }

  for (const issue of issues) {
    const dispatch = decideDispatch(issue, leases, affinity, thresholds.readyForDevLabel);
    decisions.push({
      rule: "dispatch_suggested",
      subject_id: `issue:${issue.number}`,
      decision: dispatch.shouldDispatch,
      reason: dispatch.reason,
      detail: dispatch.suggestedAssignee ? { suggested_assignee: dispatch.suggestedAssignee } : undefined,
    });
  }

  for (const lease of leases) {
    const stale = decideStaleLeaseReclaim(lease, now, thresholds.staleHeartbeatMs);
    decisions.push({
      rule: "stale_lease_reclaim",
      subject_id: `lease:${lease.lease_id}`,
      decision: stale.shouldReclaim,
      reason: stale.reason,
      detail: { stale_ms: stale.staleMs, resource_id: lease.resource_id },
    });
  }

  return decisions;
}
