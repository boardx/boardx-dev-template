import type {
  AiStoreItemScope,
  AiStoreItemStatus,
  AiStoreItemType,
  AiStoreSubmitAction,
} from "@repo/data";

export const VALID_TYPES: AiStoreItemType[] = ["agent", "ai-tool", "image-tool", "template"];
const VALID_SCOPES: AiStoreItemScope[] = ["personal", "team", "platform"];
const VALID_ACTIONS: AiStoreSubmitAction[] = ["draft", "publish", "submit_review"];

export interface ParsedAiStorePayload {
  type: AiStoreItemType;
  scope: AiStoreItemScope;
  status: AiStoreItemStatus;
  teamId: number | null;
  name: string;
  description: string;
  cover: string | null;
  tags: string[];
  examples: string[];
  config: Record<string, unknown>;
}

export interface PayloadResult {
  payload?: ParsedAiStorePayload;
  errors?: Record<string, string>;
}

function splitList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean).slice(0, 12);
  }
  return String(value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export function parseAiStorePayload(body: Record<string, unknown>, currentTeamId: number | null): PayloadResult {
  const errors: Record<string, string> = {};

  const typeRaw = String(body.type ?? "");
  const type = VALID_TYPES.includes(typeRaw as AiStoreItemType) ? (typeRaw as AiStoreItemType) : undefined;
  if (!type) errors.type = "请选择创建类型";

  const actionRaw = String(body.action ?? "draft");
  const action = VALID_ACTIONS.includes(actionRaw as AiStoreSubmitAction)
    ? (actionRaw as AiStoreSubmitAction)
    : undefined;
  if (!action) errors.action = "提交动作无效";

  const requestedScopeRaw = String(body.scope ?? "personal");
  const requestedScope = VALID_SCOPES.includes(requestedScopeRaw as AiStoreItemScope)
    ? (requestedScopeRaw as AiStoreItemScope)
    : undefined;
  if (!requestedScope) errors.scope = "可见范围无效";

  const name = String(body.name ?? "").trim();
  const description = String(body.description ?? "").trim();
  const configText = String(body.config ?? "").trim();
  if (!name) errors.name = "名称不能为空";
  if (!description) errors.description = "描述不能为空";
  if (!configText) errors.config = "配置不能为空";

  let scope = requestedScope ?? "personal";
  let status: AiStoreItemStatus = "draft";
  let teamId: number | null = null;

  if (action === "publish") {
    if (scope === "platform") errors.scope = "平台范围需要提交审核，不能直接发布";
    status = "published";
  }
  if (action === "submit_review") {
    // P11 F06：team 范围提交审核走团队管理角色审核队列（不再强制升到 platform 范围）；
    // 其余范围提交审核仍归到 platform，进入 p15-F04 平台审核队列（原有行为不变）。
    if (scope !== "team") scope = "platform";
    status = "pending";
  }
  if (action === "draft") {
    status = "draft";
  }
  if (scope === "team") {
    if (currentTeamId == null) errors.scope = "发布到团队前请先选择团队";
    teamId = currentTeamId;
  }

  if (Object.keys(errors).length > 0 || !type || !action) return { errors };

  return {
    payload: {
      type,
      scope,
      status,
      teamId,
      name,
      description,
      cover: String(body.cover ?? "").trim() || null,
      tags: splitList(body.tags),
      examples: splitList(body.examples),
      config: { instructions: configText },
    },
  };
}
