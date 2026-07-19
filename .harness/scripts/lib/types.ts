export type FeatureStatus = "not_started" | "in_progress" | "blocked" | "passing";
export const FEATURE_STATES: FeatureStatus[] = ["not_started", "in_progress", "blocked", "passing"];

export interface Feature {
  id: string;
  priority: number;
  area: string;
  title: string;
  user_visible_behavior: string;
  status: FeatureStatus;
  sprint: string | null;
  /** 认领此 feature 的 agent 标识（null = 未认领；认领后不可被他人抢占） */
  owner: string | null;
  /** 所属能力平面（CAP-WEB / CAP-DATA / CAP-WORKFLOW…）；可选，便于按平面归类与并行 */
  capability?: string;
  /** 前置依赖：同阶段写 "F0x"；跨阶段写 "p9:F0x" 这种形式。用于 sweep-unblock / dep-graph。 */
  depends_on?: string[];
  /** 派发波次，纯提示性，不参与门控逻辑 */
  wave?: number;
  /** 设计参照（prototype 锚点 / mockup 路径 / 已确认 UI 组件路径）；投影进 issue 供实现者定位 */
  design_ref?: string;
  /** story 出处：`<requirements 文件名>#R<n>`，指向 phases/<phase>/requirements/ 下的具体章节。
   *  2026-07-19 起新 feature 硬性要求（claim/verify 双重门控）；历史 feature 缺失时 doctor 报 WARN 不报 FAIL。 */
  spec_ref?: string;
  verification: string[];
  evidence: string;
  notes: string;
}

export interface FeatureList {
  phase: string;
  features: Feature[];
}

export type PhaseStatus = "not_started" | "in_progress" | "blocked" | "done";

export interface RoadmapPhase {
  id: string;
  slug: string;
  name: string;
  goal: string;
  status: PhaseStatus;
  depends_on: string[];
  /** true = 本阶段有用户界面，须先过 UI 先行确认关卡（ui-signoff.md confirmed）才能开 sprint。见 ADR-003。 */
  has_ui?: boolean;
  /** Existing GitHub umbrella issue used for external phase coordination. */
  tracking_issue?: number;
}

export interface Roadmap {
  project: string;
  phases: RoadmapPhase[];
}
