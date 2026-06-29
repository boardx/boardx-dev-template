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
}

export interface Roadmap {
  project: string;
  phases: RoadmapPhase[];
}
