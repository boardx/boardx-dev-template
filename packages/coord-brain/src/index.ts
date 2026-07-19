// @repo/coord-brain：CoordBrain 五类机械 SOP 规则的纯函数实现（R1 影子模式，p30-F10）。
// 零 IO——宿主（apps/coord-gateway 的 CoordBrain DO）负责取快照、调本包、写影子事件。
export {
  decideMergeReady,
  decideDispatch,
  decidePrNudge,
  decideStaleLeaseReclaim,
  decideAndonFreeze,
  runShadowSopCycle,
  type MergeReadyDecision,
  type DispatchDecision,
  type PrNudgeDecision,
  type StaleLeaseDecision,
  type AndonFreezeDecision,
} from "./rules";
export {
  DEFAULT_THRESHOLDS,
  type PrSnapshot,
  type IssueSnapshot,
  type LeaseSnapshot,
  type AndonSnapshot,
  type ModuleAffinity,
  type ShadowDecisionInput,
  type ShadowRuleId,
  type ShadowDecision,
  type ShadowThresholds,
} from "./types";
