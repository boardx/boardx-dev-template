// packages/ai/src/avaSettings.ts — AVA AI 设置（P9 F07）

export interface AvaModelOption {
  id: string;
  label: string;
  description: string;
  teamRestricted?: boolean;
}

export interface AvaAgentOption {
  id: string;
  label: string;
  description: string;
  version?: number;
  config?: Record<string, unknown>;
}

export interface AvaToolOption {
  id: string;
  label: string;
  description: string;
  version?: number;
  skillKind?: "text" | "image";
  config?: Record<string, unknown>;
}

export interface AvaAiSettings {
  modelId: string;
  agentId: string;
  toolIds: string[];
}

export const DEFAULT_AVA_MODEL_ID = "stub:default";
export const DEFAULT_AVA_AGENT_ID = "default";
export const DEFAULT_AVA_TOOL_IDS = ["web-search"];

export const AVA_MODEL_OPTIONS: AvaModelOption[] = [
  {
    id: DEFAULT_AVA_MODEL_ID,
    label: "Stub Default",
    description: "Fast deterministic AVA stub model for local chat.",
  },
  {
    // P18 F01：真实模型选项。选中后网关按 anthropic: 前缀路由到 anthropicProvider；
    // 未配置 ANTHROPIC_API_KEY 时发送会得到明确失败态（用户输入不丢），不影响 stub 路径。
    id: "anthropic:claude-sonnet-5",
    label: "Claude Sonnet 5",
    description: "Real Anthropic model. Requires ANTHROPIC_API_KEY on the server.",
  },
  {
    id: "stub:planner",
    label: "Stub Planner",
    description: "Planning-oriented stub response path.",
  },
  {
    id: "stub:team-pro",
    label: "Team Pro Stub",
    description: "Team restricted model, available to owners and admins.",
    teamRestricted: true,
  },
];

export const AVA_AGENT_OPTIONS: AvaAgentOption[] = [
  {
    id: DEFAULT_AVA_AGENT_ID,
    label: "Default AVA",
    description: "General AVA assistant. AI Store agents are added in p11.",
  },
  {
    id: "research",
    label: "Research Agent",
    description: "Built-in research-oriented agent placeholder.",
  },
];

export const AVA_TOOL_OPTIONS: AvaToolOption[] = [
  {
    id: "web-search",
    label: "Web Search",
    description: "Use web-style retrieval when available.",
  },
  {
    id: "board-context",
    label: "Board Context",
    description: "Include current board context when connected.",
  },
  {
    id: "file-reader",
    label: "File Reader",
    description: "Read uploaded files when available.",
  },
];

export function isModelSelectable(modelId: string, canUseTeamRestrictedModels: boolean): boolean {
  const model = AVA_MODEL_OPTIONS.find((m) => m.id === modelId);
  if (!model) return false;
  return !model.teamRestricted || canUseTeamRestrictedModels;
}

export function normalizeAvaAiSettings(
  input: Partial<AvaAiSettings>,
  canUseTeamRestrictedModels: boolean,
  // p18-F09：agent 选项不再只有内置常量——调用方（如消息路由）可传入
  // 「内置 + 当前用户/团队已订阅的 AI Store Agent」的完整可选集；
  // 不传时退化为内置常量（与历史行为一致）。
  agentOptions: ReadonlyArray<Pick<AvaAgentOption, "id">> = AVA_AGENT_OPTIONS,
  toolOptions: ReadonlyArray<Pick<AvaToolOption, "id">> = AVA_TOOL_OPTIONS,
): AvaAiSettings {
  const modelId = isModelSelectable(input.modelId ?? "", canUseTeamRestrictedModels)
    ? input.modelId!
    : DEFAULT_AVA_MODEL_ID;

  const agentId = agentOptions.some((a) => a.id === input.agentId)
    ? input.agentId!
    : DEFAULT_AVA_AGENT_ID;

  const allowedTools = new Set(toolOptions.map((t) => t.id));
  const requestedTools = Array.isArray(input.toolIds) ? input.toolIds : DEFAULT_AVA_TOOL_IDS;
  const toolIds = requestedTools.filter((id) => allowedTools.has(id));

  return {
    modelId,
    agentId,
    toolIds: toolIds.length > 0 ? toolIds : DEFAULT_AVA_TOOL_IDS,
  };
}
