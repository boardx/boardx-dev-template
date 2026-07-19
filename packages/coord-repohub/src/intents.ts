// 意图消息线程闭环状态推导（F09，coord/0.1.4）。纯函数、可独立单测——
// 语义权威：docs/coord-platform/protocol/intents.md §闭环状态。
//
// 两条环各自独立、不得相互解除（独立安全审 #772 阻断修复）：
//   - 上行环 escalate→decide：只有 intent.decide 能解除「等待拍板」。intent.accept
//     是 scoped 面任何 agent 都能发的消息，若被算作能解除 awaiting_decision，等于
//     绕过了专门给 decide 设的 admin 门禁（gateway requireAdmin）——scoped agent
//     发一条 accept 就能静默把等待人类拍板的线程伪造成已闭环。
//   - 下行环 assign→accept：accept 只闭合这一环，与 escalate/decide 无关。
//
// 规则（按 event_id 严格递增排序后取最新）：
//   - 若最新一条 intent.escalate 晚于最新一条 intent.decide（或后者不存在）
//     → awaiting_decision（等待拍板，👤 尚未回应升级；此状态下的任何 intent.accept
//       一律不参与判定，不能解除它）。
//   - 否则若存在 intent.decide 或 intent.accept → closed（已闭环——decide 闭合上行环，
//     accept 闭合下行环；二者都只在「当前没有未解除的 escalate」时才生效）。
//   - 否则（只有 assign/progress/blocker，从未 escalate/decide/accept 过）→ open（进行中）
export interface ThreadEvent {
  event_id: string;
  type: string;
}

export type ThreadStatus = "open" | "awaiting_decision" | "closed";

export function deriveThreadStatus(events: ThreadEvent[]): ThreadStatus {
  let lastEscalate: string | null = null;
  let lastDecide: string | null = null;
  let lastAccept: string | null = null;
  for (const e of events) {
    if (e.type === "intent.escalate") lastEscalate = e.event_id;
    if (e.type === "intent.decide") lastDecide = e.event_id;
    if (e.type === "intent.accept") lastAccept = e.event_id;
  }
  // 上行环优先级最高且只认 decide：accept 完全不出现在这个判断里。
  if (lastEscalate && (!lastDecide || lastEscalate > lastDecide)) return "awaiting_decision";
  if (lastDecide || lastAccept) return "closed";
  return "open";
}
