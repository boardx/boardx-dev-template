// 意图消息线程闭环状态推导（F09，coord/0.1.3）。纯函数、可独立单测——
// 语义权威：docs/coord-platform/protocol/intents.md §闭环状态。
//
// 规则（按 event_id 严格递增排序后取最新）：
//   - 若最新一条 intent.escalate 晚于最新一条 intent.decide/intent.accept（或后者不存在）
//     → awaiting_decision（等待拍板，👤 尚未回应升级）
//   - 否则若存在 intent.decide/intent.accept → closed（已闭环，最近一次上行/下行都有了结）
//   - 否则（只有 assign/progress/blocker，从未 escalate/decide/accept 过）→ open（进行中）
export interface ThreadEvent {
  event_id: string;
  type: string;
}

export type ThreadStatus = "open" | "awaiting_decision" | "closed";

export function deriveThreadStatus(events: ThreadEvent[]): ThreadStatus {
  let lastEscalate: string | null = null;
  let lastDecideOrAccept: string | null = null;
  for (const e of events) {
    if (e.type === "intent.escalate") lastEscalate = e.event_id;
    if (e.type === "intent.decide" || e.type === "intent.accept") lastDecideOrAccept = e.event_id;
  }
  if (lastEscalate && (!lastDecideOrAccept || lastEscalate > lastDecideOrAccept)) return "awaiting_decision";
  if (lastDecideOrAccept) return "closed";
  return "open";
}
