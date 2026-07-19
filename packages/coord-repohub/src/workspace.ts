// 工作区分片路由（p30/F04）：需求流水线 / sprint 面板 / talk 对话流。
// 迁入 RepoHub DO 后按仓天然分片——一个项目命名空间的 DO 里根本没有另一个项目
// 的行，隔离（N3）由存储位置保证，与 agent_tokens 的按仓 scope 同一论证。
//
// 写面权限（在 gateway 层把守，DO 只管数据与状态机，对齐既有矩阵）：
//   POST /requirements、/requirements/:id/advance、/talk = scoped 面
//     （bindScopedAgentRequest 强绑定 agent_id，禁止自证他人身份）；
//   POST /requirements/:id/review、/sprint-items/upsert = admin 面
//     （COORD_ADMIN_TOKEN，maintainer 特权，同 tasks 派工先例）。
// 独立成文件是刻意的（同 gateway auth.ts 先例）：repohub.ts 只做路由分发一行，
// 降低与并行 feature 的冲突面，也守住单文件 2000 行纪律。
import {
  REQUIREMENT_BODY_MAX_LENGTH,
  REQUIREMENT_TITLE_MAX_LENGTH,
  TALK_BODY_MAX_LENGTH,
  type EventType,
  type RequirementStatus,
} from "@repo/coord-protocol";
import { ulid } from "./ulid";

/** RepoHub 注入的最小上下文：SQL 句柄 + 事件出口（emit 落库并向 WS 广播）。 */
export interface WorkspaceCtx {
  sql: SqlStorage;
  emit: (type: EventType, resourceId: string, agentId: string, payload: Record<string, unknown>) => void;
}

interface RequirementRow {
  [key: string]: string | number | null;
  id: string;
  title: string;
  body: string;
  status: string;
  submitted_by: string;
  analysis: string | null;
  review_note: string | null;
  reviewed_by: string | null;
  issue: number | null;
  created_at: string;
  updated_at: string;
}

interface SprintItemRow {
  [key: string]: string | number | null;
  sprint: string;
  item_id: string;
  title: string;
  status: string;
  assignee: string | null;
  data: string;
  updated_at: string;
}

interface TalkRow {
  [key: string]: string | number | null;
  message_id: string;
  author: string;
  body: string;
  needs_human: number;
  at: string;
}

// 流水线前向推进表（五态，coord/0.1.3）：advance 只走 happy path 两跳；
// dispatched/rejected 由审核动作（admin 面）产生，均为终态。
const ADVANCE_NEXT: Partial<Record<RequirementStatus, RequirementStatus>> = {
  submitted: "analyzing",
  analyzing: "in_review",
};

const REQUIREMENT_STATUS_SET = new Set(["submitted", "analyzing", "in_review", "dispatched", "rejected"]);

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function iso(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function asObj(body: unknown): Record<string, unknown> | null {
  return typeof body === "object" && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>) : null;
}

function nonEmptyStr(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

/** 路由入口：命中工作区路径返回 Response，否则返回 null 交还 repohub.ts。 */
export async function handleWorkspace(
  ctx: WorkspaceCtx,
  req: Request,
  url: URL,
): Promise<Response | null> {
  const p = url.pathname;
  if (req.method === "POST" && p === "/requirements") return requirementSubmit(ctx, await req.json());
  if (req.method === "GET" && p === "/requirements") return requirementList(ctx, url);
  const one = p.match(/^\/requirements\/([\w-]+)$/);
  if (req.method === "GET" && one) return requirementGet(ctx, one[1]!);
  const adv = p.match(/^\/requirements\/([\w-]+)\/advance$/);
  if (req.method === "POST" && adv) return requirementAdvance(ctx, adv[1]!, await req.json());
  const rev = p.match(/^\/requirements\/([\w-]+)\/review$/);
  if (req.method === "POST" && rev) return requirementReview(ctx, rev[1]!, await req.json());
  if (req.method === "POST" && p === "/sprint-items/upsert") return sprintUpsert(ctx, await req.json());
  if (req.method === "GET" && p === "/sprint-items") return sprintList(ctx, url);
  if (req.method === "POST" && p === "/talk") return talkAppend(ctx, await req.json());
  if (req.method === "GET" && p === "/talk") return talkList(ctx, url);
  return null;
}

// ---------- 需求流水线 ----------

function toRequirement(r: RequirementRow): Record<string, unknown> {
  return {
    id: r.id, title: r.title, body: r.body, status: r.status,
    submitted_by: r.submitted_by, analysis: r.analysis, review_note: r.review_note,
    reviewed_by: r.reviewed_by, issue: r.issue,
    created_at: r.created_at, updated_at: r.updated_at,
  };
}

/** POST /requirements — 需求提交（scoped 面：agent_id 由 gateway 强绑定注入）。 */
function requirementSubmit(ctx: WorkspaceCtx, body: unknown): Response {
  const b = asObj(body);
  const errors: string[] = [];
  const title = b?.["title"];
  if (!nonEmptyStr(title)) errors.push("title 必须是非空字符串");
  else if (title.length > REQUIREMENT_TITLE_MAX_LENGTH) errors.push(`title 长度必须 ≤${REQUIREMENT_TITLE_MAX_LENGTH}`);
  const text = b?.["body"];
  if (typeof text !== "string") errors.push("body 必须是字符串（可为空串）");
  else if (text.length > REQUIREMENT_BODY_MAX_LENGTH) errors.push(`body 长度必须 ≤${REQUIREMENT_BODY_MAX_LENGTH}`);
  const agentId = b?.["agent_id"];
  if (!nonEmptyStr(agentId)) errors.push("agent_id 必须是非空字符串");
  if (errors.length > 0) return json(422, { error: "invalid_requirement", details: errors });

  const now = Date.now();
  const row: RequirementRow = {
    id: `req_${ulid(now)}`,
    title: title as string,
    body: text as string,
    status: "submitted",
    submitted_by: agentId as string,
    analysis: null, review_note: null, reviewed_by: null, issue: null,
    created_at: iso(now), updated_at: iso(now),
  };
  ctx.sql.exec(
    `INSERT INTO requirements (id,title,body,status,submitted_by,analysis,review_note,reviewed_by,issue,created_at,updated_at)
     VALUES (?,?,?,?,?,NULL,NULL,NULL,NULL,?,?)`,
    row.id, row.title, row.body, row.status, row.submitted_by, row.created_at, row.updated_at,
  );
  ctx.emit("requirement.submitted", `requirement:${row.id}`, row.submitted_by, {
    requirement_id: row.id, title: row.title,
  });
  return json(201, { requirement: toRequirement(row) });
}

function requirementList(ctx: WorkspaceCtx, url: URL): Response {
  const status = url.searchParams.get("status");
  if (status && !REQUIREMENT_STATUS_SET.has(status)) return json(400, { error: "invalid_status" });
  const rows = status
    ? [...ctx.sql.exec<RequirementRow>(`SELECT * FROM requirements WHERE status=? ORDER BY id DESC LIMIT 200`, status)]
    : [...ctx.sql.exec<RequirementRow>(`SELECT * FROM requirements ORDER BY id DESC LIMIT 200`)];
  return json(200, { requirements: rows.map(toRequirement) });
}

function requirementGet(ctx: WorkspaceCtx, id: string): Response {
  const row = [...ctx.sql.exec<RequirementRow>(`SELECT * FROM requirements WHERE id=?`, id)][0];
  if (!row) return json(404, { error: "requirement_not_found" });
  return json(200, { requirement: toRequirement(row) });
}

/** POST /requirements/:id/advance — 流水线前向推进（scoped 面）。
 *  submitted→analyzing→in_review 两跳；审核结论（下发/拒绝）走 admin 面 review。 */
function requirementAdvance(ctx: WorkspaceCtx, id: string, body: unknown): Response {
  const b = asObj(body);
  const agentId = b?.["agent_id"];
  if (!nonEmptyStr(agentId)) return json(400, { error: "missing_agent_id" });
  let analysis: string | null = null;
  if (b?.["analysis"] !== undefined && b["analysis"] !== null) {
    if (typeof b["analysis"] !== "string" || b["analysis"].length > REQUIREMENT_BODY_MAX_LENGTH)
      return json(422, { error: "invalid_analysis" });
    analysis = b["analysis"];
  }
  const row = [...ctx.sql.exec<RequirementRow>(`SELECT * FROM requirements WHERE id=?`, id)][0];
  if (!row) return json(404, { error: "requirement_not_found" });
  const next = ADVANCE_NEXT[row.status as RequirementStatus];
  if (!next) return json(409, { error: `invalid_transition:${row.status}->advance` });

  const at = iso(Date.now());
  // 原子条件 UPDATE（tasks 先例）：数据库的原子写本身就是判定，不退回 SELECT-then-decide
  const updated = [...ctx.sql.exec<RequirementRow>(
    `UPDATE requirements SET status=?, analysis=COALESCE(?, analysis), updated_at=?
     WHERE id=? AND status=? RETURNING *`,
    next, analysis, at, id, row.status,
  )][0];
  if (!updated) return json(409, { error: `invalid_transition:gone->advance` });
  ctx.emit("requirement.advanced", `requirement:${id}`, agentId, {
    requirement_id: id, status: next,
  });
  return json(200, { requirement: toRequirement(updated) });
}

/** POST /requirements/:id/review — 审核动作（admin 面）：approve → dispatched
 *  （可带下发 issue 号），reject → rejected。仅 in_review 可审。 */
function requirementReview(ctx: WorkspaceCtx, id: string, body: unknown): Response {
  const b = asObj(body);
  const action = b?.["action"];
  if (action !== "approve" && action !== "reject")
    return json(422, { error: "invalid_review_action", details: ['action 必须是 "approve" | "reject"'] });
  const reviewer = nonEmptyStr(b?.["agent_id"]) ? (b!["agent_id"] as string) : "admin";
  let note: string | null = null;
  if (b?.["review_note"] !== undefined && b["review_note"] !== null) {
    if (typeof b["review_note"] !== "string" || b["review_note"].length > REQUIREMENT_BODY_MAX_LENGTH)
      return json(422, { error: "invalid_review_note" });
    note = b["review_note"];
  }
  let issue: number | null = null;
  if (b?.["issue"] !== undefined && b["issue"] !== null) {
    if (!Number.isInteger(b["issue"]) || (b["issue"] as number) <= 0)
      return json(422, { error: "invalid_issue" });
    issue = b["issue"] as number;
  }

  const to: RequirementStatus = action === "approve" ? "dispatched" : "rejected";
  const at = iso(Date.now());
  const updated = [...ctx.sql.exec<RequirementRow>(
    `UPDATE requirements SET status=?, review_note=?, reviewed_by=?, issue=?, updated_at=?
     WHERE id=? AND status='in_review' RETURNING *`,
    to, note, reviewer, issue, at, id,
  )][0];
  if (!updated) {
    const current = [...ctx.sql.exec<{ status: string }>(`SELECT status FROM requirements WHERE id=?`, id)][0];
    if (!current) return json(404, { error: "requirement_not_found" });
    return json(409, { error: `invalid_transition:${current.status}->${to}` });
  }
  ctx.emit(action === "approve" ? "requirement.dispatched" : "requirement.rejected",
    `requirement:${id}`, reviewer,
    { requirement_id: id, ...(issue !== null ? { issue } : {}) });
  return json(200, { requirement: toRequirement(updated) });
}

// ---------- sprint 面板 ----------

function toSprintItem(r: SprintItemRow): Record<string, unknown> {
  return {
    sprint: r.sprint, item_id: r.item_id, title: r.title, status: r.status,
    assignee: r.assignee, data: JSON.parse(r.data) as unknown, updated_at: r.updated_at,
  };
}

/** POST /sprint-items/upsert — 面板条目写入/更新（admin 面，broker/协调层写）。 */
function sprintUpsert(ctx: WorkspaceCtx, body: unknown): Response {
  const b = asObj(body);
  const errors: string[] = [];
  for (const f of ["sprint", "item_id", "title", "status"] as const) {
    if (!nonEmptyStr(b?.[f])) errors.push(`${f} 必须是非空字符串`);
  }
  const assignee = b?.["assignee"];
  if (assignee !== undefined && assignee !== null && !nonEmptyStr(assignee))
    errors.push("assignee 必须是非空字符串或省略");
  if (errors.length > 0) return json(422, { error: "invalid_sprint_item", details: errors });

  const at = iso(Date.now());
  const data = JSON.stringify(b!["data"] ?? {});
  ctx.sql.exec(
    `INSERT INTO sprint_items (sprint,item_id,title,status,assignee,data,updated_at)
     VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(sprint,item_id) DO UPDATE SET
       title=excluded.title, status=excluded.status, assignee=excluded.assignee,
       data=excluded.data, updated_at=excluded.updated_at`,
    b!["sprint"] as string, b!["item_id"] as string, b!["title"] as string, b!["status"] as string,
    (assignee as string | undefined) ?? null, data, at,
  );
  const createdBy = nonEmptyStr(b?.["agent_id"]) ? (b!["agent_id"] as string) : "admin";
  ctx.emit("sprint.upserted", `sprint:${b!["sprint"] as string}/${b!["item_id"] as string}`, createdBy, {
    sprint: b!["sprint"], item_id: b!["item_id"],
  });
  return json(200, { ok: true, updated_at: at });
}

function sprintList(ctx: WorkspaceCtx, url: URL): Response {
  const sprint = url.searchParams.get("sprint");
  const rows = sprint
    ? [...ctx.sql.exec<SprintItemRow>(`SELECT * FROM sprint_items WHERE sprint=? ORDER BY item_id`, sprint)]
    : [...ctx.sql.exec<SprintItemRow>(`SELECT * FROM sprint_items ORDER BY sprint, item_id LIMIT 500`)];
  return json(200, { items: rows.map(toSprintItem) });
}

// ---------- talk 对话流 ----------

function toTalk(r: TalkRow): Record<string, unknown> {
  return {
    message_id: r.message_id, author: r.author, body: r.body,
    needs_human: r.needs_human === 1, at: r.at,
  };
}

/** POST /talk — 对话流追加（scoped 面：agent_id 由 gateway 强绑定注入）。
 *  append-only：无编辑/删除面，历史即事实。 */
function talkAppend(ctx: WorkspaceCtx, body: unknown): Response {
  const b = asObj(body);
  const errors: string[] = [];
  const agentId = b?.["agent_id"];
  if (!nonEmptyStr(agentId)) errors.push("agent_id 必须是非空字符串");
  const text = b?.["body"];
  if (!nonEmptyStr(text)) errors.push("body 必须是非空字符串");
  else if (text.length > TALK_BODY_MAX_LENGTH) errors.push(`body 长度必须 ≤${TALK_BODY_MAX_LENGTH}`);
  const needsHuman = b?.["needs_human"];
  if (needsHuman !== undefined && typeof needsHuman !== "boolean") errors.push("needs_human 必须是布尔值");
  if (errors.length > 0) return json(422, { error: "invalid_talk_message", details: errors });

  const now = Date.now();
  const row: TalkRow = {
    message_id: `tlk_${ulid(now)}`,
    author: agentId as string,
    body: text as string,
    needs_human: needsHuman === true ? 1 : 0,
    at: iso(now),
  };
  ctx.sql.exec(
    `INSERT INTO talk_messages (message_id,author,body,needs_human,at) VALUES (?,?,?,?,?)`,
    row.message_id, row.author, row.body, row.needs_human, row.at,
  );
  ctx.emit("talk.posted", `talk:${row.message_id}`, row.author, {
    message_id: row.message_id, needs_human: row.needs_human === 1,
  });
  return json(201, { message: toTalk(row) });
}

/** GET /talk?since=&limit= — ULID 时间序升序；since 续传语义同 /events。 */
function talkList(ctx: WorkspaceCtx, url: URL): Response {
  const since = url.searchParams.get("since");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
  if (!Number.isInteger(limit) || limit <= 0) return json(400, { error: "invalid_limit" });
  const rows = since
    ? [...ctx.sql.exec<TalkRow>(`SELECT * FROM talk_messages WHERE message_id > ? ORDER BY message_id LIMIT ?`, since, limit)]
    : [...ctx.sql.exec<TalkRow>(`SELECT * FROM talk_messages ORDER BY message_id LIMIT ?`, limit)];
  return json(200, { messages: rows.map(toTalk) });
}
