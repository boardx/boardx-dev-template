// tasks.ts — 平台中立派工原语（issue #594，人类拍板 2026-07-12）。
//
// 问题：coordinator 派工此前靠两条腿——Claude Code session message（只有 CC 会话
// 能收，Codex/自研 runtime 收不到）和 GitHub label（平台中立但空闲 agent 不轮询就
// 看不见）。人类要求：派送机制不得依赖任何单一 runtime 的私有通道。
//
// 解法：tasks 表 = 每个 agent 的收件箱。coordinator POST /tasks 派工；agent 按
// agent-bootstrap.md 的轮询契约（≤15min）GET 自己的收件箱 → ack → 认领 issue 开工。
// 纯 HTTP + bearer token，任何 runtime 都能接。session message 降级为可选加速器。
//
// 授权模型（与 andon 同门）：
//   POST /tasks           仅 COORDINATOR_KINDS（派工是协调层权力）
//   GET  /tasks           assignee 本人（只能查自己）或 coordinator（可查任何人）
//   POST /tasks/:id/ack   仅 assignee 本人（认领确认，通常伴随 lock-acquire）
//   POST /tasks/:id/done  仅 assignee 本人
//   POST /tasks/:id/recall 仅 COORDINATOR_KINDS（撤回误派/改派）
// 全部动作照写 events 表（task-dispatch/ack/done/recall），portal 与 /status 可见。
import { requireAgent, COORDINATOR_KINDS } from "../auth";
import { HttpError } from "../lib/errors";
import { nowIso } from "../lib/time";
import { insertEvent } from "../db/queries";
import type { Env, TaskRow, TaskStatus } from "../db/types";
import type { Handler } from "../router";

const PRIORITIES = new Set(["high", "normal", "low"]);
const QUERYABLE_STATUSES = new Set<string>(["pending", "acked", "done", "recalled"]);
const NOTE_MAX_LENGTH = 2000; // #631：派工附言不是日志倾倒场
const MAX_BODY_BYTES = 16 * 1024; // #631：派工 body 大小上限（16KB 足够，防大包打库）

function requireCoordinator(agentKind: string): void {
  if (!COORDINATOR_KINDS.has(agentKind)) {
    throw new HttpError(403, "task_dispatch_requires_coordinator");
  }
}

function parseTaskIdParam(params: Record<string, string>): number {
  const id = params["id"] ? Number(params["id"]) : NaN;
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "invalid_task_id");
  return id;
}

async function getTaskOr404(db: D1Database, id: number): Promise<TaskRow> {
  const row = await db.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first<TaskRow>();
  if (!row) throw new HttpError(404, "task_not_found");
  return row;
}

/** POST /tasks — coordinator 派工。body: {issue, assignee, priority?, deadline?, note?} */
export const dispatchTask: Handler = async (request, env: Env) => {
  const agent = await requireAgent(request, env);
  requireCoordinator(agent.kind);

  // #631：先卡 body 大小再解析——不让超大包进 JSON.parse
  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) throw new HttpError(413, "body_too_large");
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "invalid_json_body");
  }

  const issue = body["issue"];
  if (typeof issue !== "number" || !Number.isInteger(issue) || issue <= 0) {
    throw new HttpError(400, "missing_or_invalid_field:issue");
  }
  const assignee = body["assignee"];
  if (typeof assignee !== "string" || assignee.length === 0) {
    throw new HttpError(400, "missing_or_invalid_field:assignee");
  }
  // assignee 必须是已注册且 active 的身份——派给不存在的收件箱 = 静默黑洞，直接拒
  const target = await env.DB.prepare("SELECT id, active FROM agents WHERE id = ?").bind(assignee).first<{ id: string; active: number }>();
  if (!target || !target.active) throw new HttpError(400, "assignee_unknown_or_inactive");

  const priority = typeof body["priority"] === "string" ? body["priority"] : "normal";
  if (!PRIORITIES.has(priority)) throw new HttpError(400, "invalid_priority");

  // #631：deadline 必须是可解析的时间——脏字符串进库会让"超期"判定永远失效（静默）
  let deadline: string | null = null;
  if (body["deadline"] !== undefined && body["deadline"] !== null) {
    if (typeof body["deadline"] !== "string" || Number.isNaN(Date.parse(body["deadline"]))) {
      throw new HttpError(400, "invalid_deadline");
    }
    deadline = new Date(body["deadline"]).toISOString(); // 归一存储，避免各家格式混存
  }

  // #631：note 上限——收件箱是协调面，不是日志倾倒场；超限直接拒（不静默截断）
  let note: string | null = null;
  if (body["note"] !== undefined && body["note"] !== null) {
    if (typeof body["note"] !== "string") throw new HttpError(400, "invalid_note");
    if (body["note"].length > NOTE_MAX_LENGTH) throw new HttpError(400, "note_too_long");
    note = body["note"];
  }
  const at = nowIso();

  const task = await env.DB.prepare(
    `INSERT INTO tasks (issue, assignee, priority, deadline, note, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?) RETURNING *`
  )
    .bind(issue, assignee, priority, deadline, note, agent.id, at, at)
    .first<TaskRow>();
  if (!task) throw new HttpError(500, "task_insert_failed");

  await insertEvent(env.DB, {
    type: "task-dispatch",
    resourceId: `issue:${issue}`,
    agentId: agent.id,
    payload: { task_id: task.id, assignee, priority, deadline, note },
    at,
  });
  return Response.json({ task }, { status: 201 });
};

/** GET /tasks?assignee=&status= — 收件箱。非 coordinator 只能查自己。 */
export const listTasks: Handler = async (request, env: Env) => {
  const agent = await requireAgent(request, env);
  const url = new URL(request.url);
  const requestedAssignee = url.searchParams.get("assignee") ?? agent.id;
  if (requestedAssignee !== agent.id && !COORDINATOR_KINDS.has(agent.kind)) {
    throw new HttpError(403, "inbox_is_private"); // 只有协调层能看别人的收件箱
  }
  const status = url.searchParams.get("status");
  if (status && !QUERYABLE_STATUSES.has(status)) throw new HttpError(400, "invalid_status");

  const rows = status
    ? await env.DB.prepare("SELECT * FROM tasks WHERE assignee = ? AND status = ? ORDER BY id DESC LIMIT 100")
        .bind(requestedAssignee, status)
        .all<TaskRow>()
    : await env.DB.prepare("SELECT * FROM tasks WHERE assignee = ? ORDER BY id DESC LIMIT 100")
        .bind(requestedAssignee)
        .all<TaskRow>();
  return Response.json({ tasks: rows.results ?? [] });
};

/** 状态转移的共用骨架：鉴权 → **原子条件 UPDATE** → 写事件。
 *
 *  #631：此前是 read-check-write（先 SELECT 判 status，再无条件 UPDATE），有 TOCTOU
 *  窗口——两个并发 ack 都能通过检查、都写一条 task-ack 事件；done 与 recall 并发时
 *  还能互相覆盖导致事件序错乱。这正是 AGENTS.md 明令禁止、claims 表用
 *  uq_active_claim 守住的那个模式，tasks 却退回去了。
 *
 *  改法：把前置状态判定塞进 UPDATE 的 WHERE（`AND status IN (<from>)`），让**数据库
 *  的原子写本身就是判定**——空返回 = 状态已被别人改走 = 409，不需要也不允许再
 *  SELECT-then-decide。仍先 SELECT 一次：只为拿 assignee/issue 做鉴权与事件归属，
 *  不参与转移判定（鉴权字段不随状态变，无 TOCTOU 风险）。 */
async function transition(
  request: Request,
  env: Env,
  params: Record<string, string>,
  opts: {
    to: TaskStatus;
    from: TaskStatus[];
    eventType: "task-ack" | "task-done" | "task-recall";
    authorize: (agentId: string, agentKind: string, task: TaskRow) => void;
    setAckedAt?: boolean;
  }
): Promise<Response> {
  const agent = await requireAgent(request, env);
  const id = parseTaskIdParam(params);
  const task = await getTaskOr404(env.DB, id); // 仅取 assignee/issue 供鉴权与事件归属
  opts.authorize(agent.id, agent.kind, task);

  const at = nowIso();
  const placeholders = opts.from.map(() => "?").join(", ");
  const sets = ["status = ?", "updated_at = ?", ...(opts.setAckedAt ? ["acked_at = ?"] : [])];
  const binds = [opts.to, at, ...(opts.setAckedAt ? [at] : []), id, ...opts.from];
  const updated = await env.DB.prepare(
    `UPDATE tasks SET ${sets.join(", ")} WHERE id = ? AND status IN (${placeholders}) RETURNING *`
  )
    .bind(...binds)
    .first<TaskRow>();

  // 空返回 = 前置状态不满足（已被并发请求改走 / 本就非法）——原子判定的结果
  if (!updated) {
    const current = await env.DB.prepare("SELECT status FROM tasks WHERE id = ?").bind(id).first<{ status: string }>();
    throw new HttpError(409, `invalid_transition:${current?.status ?? "gone"}->${opts.to}`);
  }

  // 事件只在真的转移成功后写——并发下不会出现两条 task-ack
  await insertEvent(env.DB, {
    type: opts.eventType,
    resourceId: `issue:${task.issue}`,
    agentId: agent.id,
    payload: { task_id: id },
    at,
  });
  return Response.json({ task: updated });
}

/** POST /tasks/:id/ack — assignee 认领确认（通常伴随 lock-acquire 认领 issue）。 */
export const ackTask: Handler = async (request, env: Env, params) =>
  transition(request, env, params, {
    to: "acked",
    from: ["pending"],
    eventType: "task-ack",
    setAckedAt: true,
    authorize: (agentId, _kind, task) => {
      if (task.assignee !== agentId) throw new HttpError(403, "not_your_task");
    },
  });

/** POST /tasks/:id/done — assignee 交付完成（PR 合并/验收过后自报）。 */
export const doneTask: Handler = async (request, env: Env, params) =>
  transition(request, env, params, {
    to: "done",
    from: ["pending", "acked"],
    eventType: "task-done",
    authorize: (agentId, _kind, task) => {
      if (task.assignee !== agentId) throw new HttpError(403, "not_your_task");
    },
  });

/** POST /tasks/:id/recall — coordinator 撤回（误派/改派/不再需要）。 */
export const recallTask: Handler = async (request, env: Env, params) =>
  transition(request, env, params, {
    to: "recalled",
    from: ["pending", "acked"],
    eventType: "task-recall",
    authorize: (_agentId, kind, _task) => {
      requireCoordinator(kind);
    },
  });
