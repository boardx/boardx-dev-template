// p30/F08 单测：lib/p30-decisions.ts 的事件 → 「待拍板@我」信号推导。
// F09（decide 协议）未落地前的过渡适配层——本测试锁定当前从 andon/task 事件推导的行为，
// F09 合并后若替换实现，测试断言应同步更新（接口 DecisionSignal[] 不变）。
import { describe, expect, it } from "vitest";
import { buildDecisionSignals } from "../lib/p30-decisions";
import type { CoordEvent } from "../lib/coord-gateway";

function ev(partial: Partial<CoordEvent> & Pick<CoordEvent, "event_id" | "type" | "at">): CoordEvent {
  return { resource_id: "r1", agent_id: "wrk-1", payload: {}, ...partial };
}

describe("buildDecisionSignals", () => {
  it("andon.raised 无对应 cleared → 产出待拍板信号", () => {
    const events: CoordEvent[] = [
      ev({ event_id: "evt_01", type: "andon.raised", at: new Date(Date.now() - 3_600_000).toISOString(), resource_id: "repo", payload: { reason: "init.sh 挂了", scope: "repo" } }),
    ];
    const out = buildDecisionSignals(events, "boardx", "usamshen");
    expect(out).toHaveLength(1);
    expect(out[0]!.kind).toBe("decide");
    expect(out[0]!.why.some((w) => w.includes("init.sh 挂了"))).toBe(true);
  });

  it("andon.raised 后跟 andon.cleared（同 resource_id）→ 不产出信号", () => {
    const events: CoordEvent[] = [
      ev({ event_id: "evt_01", type: "andon.raised", at: "2026-07-19T01:00:00Z", resource_id: "repo" }),
      ev({ event_id: "evt_02", type: "andon.cleared", at: "2026-07-19T02:00:00Z", resource_id: "repo" }),
    ];
    expect(buildDecisionSignals(events, "boardx", "usamshen")).toHaveLength(0);
  });

  it("task.dispatched 指派给我且未 ack/complete/recall → 产出信号；指派给别人 → 不产出", () => {
    const events: CoordEvent[] = [
      ev({ event_id: "evt_01", type: "task.dispatched", at: new Date().toISOString(), agent_id: "coord-main", payload: { task_id: 42, assignee: "usamshen", priority: "high" } }),
      ev({ event_id: "evt_02", type: "task.dispatched", at: new Date().toISOString(), agent_id: "coord-main", payload: { task_id: 43, assignee: "someone-else", priority: "high" } }),
    ];
    const out = buildDecisionSignals(events, "boardx", "usamshen");
    expect(out.map((d) => d.id)).toContain("task-42");
    expect(out.map((d) => d.id)).not.toContain("task-43");
  });

  it("task.acked 出现后 → 该任务不再出现在待拍板", () => {
    const events: CoordEvent[] = [
      ev({ event_id: "evt_01", type: "task.dispatched", at: "2026-07-19T01:00:00Z", payload: { task_id: 5, assignee: "usamshen" } }),
      ev({ event_id: "evt_02", type: "task.acked", at: "2026-07-19T01:05:00Z", payload: { task_id: 5 } }),
    ];
    expect(buildDecisionSignals(events, "boardx", "usamshen")).toHaveLength(0);
  });

  it("按 SLA 剩余排序（越紧急越靠前）", () => {
    const events: CoordEvent[] = [
      ev({ event_id: "evt_01", type: "task.dispatched", at: new Date().toISOString(), payload: { task_id: 1, assignee: "usamshen", deadline: new Date(Date.now() + 48 * 3_600_000).toISOString() } }),
      ev({ event_id: "evt_02", type: "andon.raised", at: new Date().toISOString(), resource_id: "repo", payload: { reason: "x" } }),
    ];
    const out = buildDecisionSignals(events, "boardx", "usamshen");
    expect(out[0]!.id).toMatch(/^andon-/); // andon 目标窗口更短，理应排前面
  });
});
