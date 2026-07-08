import { requireAgent } from "../auth";
import { HttpError } from "../lib/errors";
import { nowIso } from "../lib/time";
import { insertEventReturning } from "../db/queries";
import type { Env, EventType } from "../db/types";
import type { Handler } from "../router";

// ADR-009 之后 GitHub 协调面退役——原本落在 lease issue / #323 / #452 上的叙述层
// 内容（周期站会的 cycle-plan/cycle-result、main 打挂的 andon 停线/恢复信号）
// 需要在 D1 有家。events 表已有自由 payload 字段，这里开一个 authed 的通用写入
// 端点让协调会话直接写这三类叙述事件；claim 生命周期事件（claim/heartbeat/
// release/expire/verdict/merge）仍只由各自的 claim/verdict 路由自动产生，不走
// 这个端点（那些是有 resource 归属的状态转移，不是自由叙述）。
const NARRATIVE_TYPES: ReadonlySet<EventType> = new Set<EventType>(["cycle-plan", "cycle-result", "andon"]);

function requireStringField(body: unknown, field: string): string {
  if (typeof body !== "object" || body === null) throw new HttpError(400, "invalid_body");
  const value = (body as Record<string, unknown>)[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new HttpError(400, `missing_field:${field}`);
  }
  return value;
}

/**
 * POST /events — 任意已认证身份写一条叙述层事件（cycle-plan/cycle-result/andon）。
 *
 * body: { type: "cycle-plan"|"cycle-result"|"andon", resource_id: string, payload?: object }
 *  - type 必须是三类叙述事件之一；claim 生命周期类型（claim/heartbeat/…）一律 400
 *    拒绝——它们只能由 claim/verdict 路由作为状态转移的副作用产生，不接受手写，
 *    否则会污染审计语义（伪造"某资源被 claim 过"的历史）。
 *  - resource_id：叙述事件也挂一个 resource 便于聚合，如 "cycle:2026-07-08T12:00Z"
 *    或 "andon:main"。自由字符串，服务端不校验格式。
 *  - agent_id 永远取自 bearer token（见 auth.ts），不信 body。
 *  - payload：可选自由 JSON（cycle-plan 装 commit/carry/blocked；andon 装
 *    stop/clear+reason）。原样存进 events.payload。
 */
export const submitEvent: Handler = async (request, env: Env) => {
  const agent = await requireAgent(request, env);
  const body: unknown = await request.json().catch(() => {
    throw new HttpError(400, "invalid_json_body");
  });
  const type = requireStringField(body, "type") as EventType;
  if (!NARRATIVE_TYPES.has(type)) {
    throw new HttpError(400, "type_not_narrative"); // claim 生命周期事件不接受手写
  }
  const resourceId = requireStringField(body, "resource_id");
  const payloadRaw = (body as Record<string, unknown>)["payload"];
  const payload = payloadRaw === undefined ? undefined : payloadRaw;
  const at = nowIso();

  const event = await insertEventReturning(env.DB, {
    type,
    resourceId,
    agentId: agent.id,
    payload,
    at,
  });
  return Response.json({ event }, { status: 201 });
};
