// apps/web/lib/agents.ts — Home Agent 视图模型与纯过滤逻辑（P2 F02/F03）
// Agent 真实数据源由 AI Store(p11) 提供；本期分组为空集，仅渲染空状态与入口。

export interface Agent {
  id: string | number;
  name: string;
  description?: string;
  tags?: string[];
  source?: string;
  model?: string;
}

export type AgentGroupKey = "recent" | "subscribed" | "recommended";

export type AgentGroups = Record<AgentGroupKey, Agent[]>;

export const EMPTY_AGENT_GROUPS: AgentGroups = {
  recent: [],
  subscribed: [],
  recommended: [],
};

/** 按关键词过滤 Agent（名称/描述/标签，大小写不敏感）。空查询返回原集合。纯函数，可单测。 */
export function filterAgents(agents: Agent[], q: string): Agent[] {
  const t = q.trim().toLowerCase();
  if (!t) return agents;
  return agents.filter(
    (a) =>
      a.name.toLowerCase().includes(t) ||
      (a.description ?? "").toLowerCase().includes(t) ||
      (a.tags ?? []).some((tag) => tag.toLowerCase().includes(t))
  );
}
