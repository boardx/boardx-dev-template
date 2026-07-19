// p30-me-types.ts — /api/p30/me 响应契约（p30/F08）。共享给服务端聚合路由与
// 客户端 me-workbench 组件，两边都从这一份类型走，避免结构漂移。
import type { DecisionSignal } from "./p30-decisions";

export type { DecisionSignal };

export interface StuckPrItem {
  id: string;
  number: number;
  title: string;
  url: string;
  ageHours: number;
  waitingOn: string;
}

export interface AgentAnomalyItem {
  id: string;
  agentId: string;
  kind: "heartbeat-lost" | "stale-lease";
  sinceMin: number;
  detail: string;
}

export type ColumnState<T> = { state: "ready"; items: T[] } | { state: "degraded"; items: [] };

export interface ProjectInfo {
  slug: string;
  name: string;
  badgeCount: number;
}

export interface MeApiPayload {
  login: string;
  access: "granted" | "denied";
  accessReason?: string;
  project: ProjectInfo | null;
  decisions: ColumnState<DecisionSignal>;
  stuckPrs: ColumnState<StuckPrItem>;
  anomalies: ColumnState<AgentAnomalyItem>;
  generatedAt: string;
}
