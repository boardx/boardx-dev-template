// p30-decisions.ts — 「待拍板@我」信号适配层（p30/F08）。
//
// 权威协议（UC-11 assign/accept/progress/blocker/escalate/decide）由 p30/F09 落地，
// 但 F09 在本 feature 交付时尚无代码（分支 feat/p30-f09-intent-protocol 无提交）。
// 按 F08 任务说明「先接 RepoHub 现有 events 里能表达『需要决策』的信号」，本文件从
// coord-gateway /events（events.md v0.1 封闭集合）推导两类「待拍板」：
//   1. andon.raised 未见对应 andon.cleared（同 resource_id）——停线中，需要有权者解除。
//   2. task.dispatched 指派给我、且未见 task.acked/completed/recalled（同 task_id）——
//      需要我确认/接受的任务。
// F09 落地后：把 buildDecisionSignals 的实现替换为读 decide 类型事件，接口签名
// （DecisionSignal[]）保持不变——调用方（app/api/p30/me/route.ts）不用改。
import type { CoordEvent } from "./coord-gateway";

export interface DecisionSignal {
  id: string;
  projectSlug: string;
  title: string;
  /** SLA 剩余小时（可为负，代表已逾期）——排序键，越小越靠前。 */
  slaHoursLeft: number;
  from: string;
  kind: "decide" | "raise-concern";
  why: string[];
}

const ANDON_TARGET_HOURS = 1; // stop-merge 语义：目标 1h 内响应
const TASK_DEFAULT_TARGET_HOURS = 24; // 无 deadline 时的默认 SLA 窗口

function ageHours(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, (Date.now() - t) / 3_600_000);
}

function agentHandle(agentId: string): string {
  return agentId.startsWith("@") ? agentId : `@${agentId}`;
}

/** 从事件流推导「待拍板@我」信号。events 须按时间升序（旧→新）传入。 */
export function buildDecisionSignals(events: CoordEvent[], projectSlug: string, login: string | null): DecisionSignal[] {
  const ascending = [...events].sort((a, b) => a.event_id.localeCompare(b.event_id));

  // andon：resource_id 上最近一次是 raised 而非 cleared，视为仍在停线。
  const andonState = new Map<string, CoordEvent>(); // resource_id -> 最近一条 raised/cleared
  for (const e of ascending) {
    if (e.type === "andon.raised" || e.type === "andon.cleared") {
      if (e.type === "andon.cleared") andonState.delete(e.resource_id);
      else andonState.set(e.resource_id, e);
    }
  }

  // task：task_id -> dispatched 事件，acked/completed/recalled 出现即摘除。
  const taskState = new Map<string, CoordEvent>();
  for (const e of ascending) {
    const payload = e.payload as { task_id?: unknown } | null;
    const taskId = payload && typeof payload === "object" && "task_id" in payload ? String((payload as { task_id: unknown }).task_id) : null;
    if (!taskId) continue;
    if (e.type === "task.dispatched") taskState.set(taskId, e);
    else if (e.type === "task.acked" || e.type === "task.completed" || e.type === "task.recalled") taskState.delete(taskId);
  }

  const out: DecisionSignal[] = [];

  for (const [resourceId, e] of andonState) {
    const payload = (e.payload ?? {}) as { reason?: unknown; scope?: unknown };
    const reason = typeof payload.reason === "string" ? payload.reason : "未附原因";
    out.push({
      id: `andon-${e.event_id}`,
      projectSlug,
      title: `andon 拉停待解除 · ${resourceId}`,
      slaHoursLeft: Math.round((ANDON_TARGET_HOURS - ageHours(e.at)) * 10) / 10,
      from: agentHandle(e.agent_id),
      kind: "decide",
      why: [
        `${agentHandle(e.agent_id)} 于 ${e.at} 拉停（${typeof payload.scope === "string" ? payload.scope : "repo"}）`,
        `原因：${reason}`,
        "停线期间该 scope 下的合并被阻断，需要有权者核实后解除（andon.cleared）。",
      ],
    });
  }

  for (const [taskId, e] of taskState) {
    const payload = (e.payload ?? {}) as { assignee?: unknown; deadline?: unknown; note?: unknown; priority?: unknown };
    const assignee = typeof payload.assignee === "string" ? payload.assignee : null;
    if (login && assignee && assignee !== login) continue; // 只保留派给我的任务
    const deadline = typeof payload.deadline === "string" ? payload.deadline : null;
    const targetHours = deadline ? (Date.parse(deadline) - Date.parse(e.at)) / 3_600_000 : TASK_DEFAULT_TARGET_HOURS;
    out.push({
      id: `task-${taskId}`,
      projectSlug,
      title: `任务 #${taskId} 待确认${typeof payload.note === "string" && payload.note ? `：${payload.note.slice(0, 60)}` : ""}`,
      slaHoursLeft: Math.round((targetHours - ageHours(e.at)) * 10) / 10,
      from: agentHandle(e.agent_id),
      kind: "decide",
      why: [
        `${agentHandle(e.agent_id)} 于 ${e.at} 派发（优先级：${typeof payload.priority === "string" ? payload.priority : "normal"}）`,
        deadline ? `截止：${deadline}` : "未设截止时间（默认 24h 窗口）",
        "尚未看到你的 ack/完成/撤回事件，需要你处理。",
      ],
    });
  }

  return out.sort((a, b) => a.slaHoursLeft - b.slaHoursLeft);
}
