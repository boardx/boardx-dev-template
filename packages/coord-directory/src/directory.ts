// PlatformDirectory：平台级目录单例 DO（p30/F01，idFromName("platform")）。
// 与按仓分片的 RepoHub（ADR-017）互补：RepoHub 管每仓的工作原语（租约/证据/事件），
// 这里管平台级身份与授权拓扑——Project / Engineer / Membership / Agent / Enrollment。
//
// 三条铁律（platform-redesign §0）：
//   1. GitHub 永远是权威（github_login 是身份锚点，本 DO 不发明身份）；
//   2. 人类是一等实体（agent.owner 必填，owner 与 parent 两条关系并存）；
//   3. 写入面收窄——本 DO 只接受身份/授权/审批类写路径，其余全部只读。
// 每条写路径 emit 一条 append-only 审计事件（directory.*，coord/0.1.2；需求 N5）。
//
// D6：所有实体主键为不可变 ULID（改名不断链）；agent 标识 @handle/agent-name
// （owner 命名空间唯一），sub-agent 用点号沿 parent 命名延伸。
// 原子性纪律同 RepoHub：DO 单线程 + UNIQUE 索引双保险，状态迁移用条件 UPDATE
// （原子判定即结论），禁止 SELECT-then-decide。
import { DurableObject } from "cloudflare:workers";
import { PROTOCOL, type EventType } from "@repo/coord-protocol";
import { SCHEMA } from "./schema";
import { ulid } from "./ulid";
import { computeSlaStatus, type SlaStatus } from "./sla";

// ---------- 领域常量（platform-redesign §1） ----------

export const MEMBERSHIP_ROLES = ["owner", "maintainer", "approver", "contributor"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const MEMBERSHIP_STATUSES = ["pending", "active", "suspended", "rejected"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

// 状态机唯一出口：pending→active（approve）/ pending→rejected（reject，终态，p30/F06）
// →suspended（suspend，仅 active）→active（reinstate，仅 suspended）。
// 其余一律非法（pending→suspended、重复 approve、对 rejected 再 approve、active→reinstate……）→ 409。
const MEMBERSHIP_TRANSITIONS = {
  approve: { from: ["pending"], to: "active" },
  reject: { from: ["pending"], to: "rejected" },
  suspend: { from: ["active"], to: "suspended" },
  reinstate: { from: ["suspended"], to: "active" },
} as const;
type MembershipAction = keyof typeof MEMBERSHIP_TRANSITIONS;

// Agent 生命周期状态机（p30/F07，M2 车队管理台「轮换/暂停/退役」的暂停面）：
// pause（active→paused）/ resume（paused→active）/ retire（active|paused→retired，
// 终态，重复 retire 409）。轮换 token 不改这里的状态——那是纯 RepoHub token 面的事。
const AGENT_LIFECYCLE_TRANSITIONS = {
  pause: { from: ["active"], to: "paused" },
  resume: { from: ["paused"], to: "active" },
  retire: { from: ["active", "paused"], to: "retired" },
} as const;
type AgentLifecycleAction = keyof typeof AGENT_LIFECYCLE_TRANSITIONS;

export const PROJECT_VISIBILITIES = ["public", "private"] as const;

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;
const HANDLE_RE = /^[a-z0-9][a-z0-9-]{0,38}$/;
// agent 名单段；完整名 = 单段（顶级）或 parent.name + "." + 单段…（sub，D6）
const AGENT_SEGMENT_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const AGENT_NAME_MAX = 128;

// enrollments.token_ref 格式校验（#770 跟进 2/3）：只接受 hash 前缀形态，
// 把「只存 hash 前缀，绝不存明文/完整 token」从注释约定变成代码不变量。
// 真实 token（GitHub PAT/scoped token/JWT 等）远比这更长、且含 `_`/`.`/大写等
// 字符，格式上天然被拒；不做「黑名单猜 token 长相」，只做「白名单认前缀形态」。
const TOKEN_REF_RE = /^[0-9a-f]{6,16}$/;

// ---------- 行类型 ----------

interface ProjectRow {
  [key: string]: string | number | null;
  project_id: string;
  slug: string;
  name: string;
  visibility: string;
  modules: string;
  sla: string;
  gate_policy: string;
  created_at: string;
  updated_at: string;
}

interface EngineerRow {
  [key: string]: string | number | null;
  engineer_id: string;
  handle: string;
  display_name: string;
  github_login: string | null;
  created_at: string;
  updated_at: string;
}

interface MembershipRow {
  [key: string]: string | number | null;
  membership_id: string;
  project_id: string;
  engineer_id: string;
  role: string;
  status: string;
  modules: string;
  intro: string;
  onboarding_issue_url: string | null;
  created_at: string;
  updated_at: string;
}

interface AgentRow {
  [key: string]: string | number | null;
  agent_id: string;
  name: string;
  owner_engineer_id: string;
  parent_agent_id: string | null;
  capabilities: string;
  last_heartbeat_at: string | null;
  lifecycle: string;
  created_at: string;
  updated_at: string;
}

interface EnrollmentRow {
  [key: string]: string | number | null;
  enrollment_id: string;
  agent_id: string;
  project_id: string;
  token_ref: string | null;
  status: string;
  created_at: string;
  revoked_at: string | null;
}

type Obj = Record<string, unknown>;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function iso(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(o: Obj | null, key: string): string | undefined {
  const v = o?.[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/**
 * ⚠️ 不可信自报提示字段，非鉴权主体（#770 跟进 1/3）：`actor` 由请求体自报，
 * 服务端零校验——当前单一 admin token 场景下本就无法区分主体，任何调用方
 * 都可以在请求体里填任意 actor 值。events.agent_id 列存的就是这个自报值，
 * 只能当「提示」用于人工排障，绝不能当鉴权/问责证据使用。
 * 未来按人凭据接入（OAuth/scoped token）后，actor 必须从鉴权主体派生
 * （例如 gateway 校验后的 engineer/agent 身份），而不是继续信任请求体。
 */
function actorOf(o: Obj | null): string {
  return str(o, "actor") ?? "admin";
}

function jsonField(o: Obj | null, key: string, fallback: unknown): string | Response {
  const v = o?.[key];
  if (v === undefined || v === null) return JSON.stringify(fallback);
  if (key === "modules" || key === "capabilities") {
    if (!Array.isArray(v)) return json(422, { error: `invalid_${key}`, details: [`${key} 必须是数组`] });
  } else if (!isObj(v)) {
    return json(422, { error: `invalid_${key}`, details: [`${key} 必须是对象`] });
  }
  return JSON.stringify(v);
}

export class PlatformDirectory extends DurableObject {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env as never);
    this.sql = ctx.storage.sql;
    this.sql.exec(SCHEMA);
    this.migrate();
  }

  /** 加法迁移（p30/F07）：SQLite 无 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`，
   *  用「试跑一次，已存在则吞掉报错」保持幂等——同一纪律见文件头「幂等 SCHEMA」。 */
  private migrate(): void {
    try {
      this.sql.exec(`ALTER TABLE agents ADD COLUMN lifecycle TEXT NOT NULL DEFAULT 'active'`);
    } catch {
      /* 列已存在（非首次启动）——幂等 no-op */
    }
  }

  // ---------- HTTP 入口（gateway 经 stub.fetch 调用） ----------

  override async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const p = url.pathname;
    try {
      // 读面
      if (req.method === "GET" && p === "/directory/projects") return this.listProjects();
      if (req.method === "GET" && p === "/directory/engineers") return this.listEngineers();
      if (req.method === "GET" && p === "/directory/agents") return this.listAgents();
      const one = p.match(/^\/directory\/agents\/(agt_[0-9A-Z]+)$/);
      if (req.method === "GET" && one) return this.getAgent(one[1]!);
      if (req.method === "GET" && p === "/directory/memberships") return this.listMemberships();
      const msla = p.match(/^\/directory\/memberships\/(mem_[0-9A-Z]+)\/sla$/);
      if (req.method === "GET" && msla) return this.membershipSla(msla[1]!);
      if (req.method === "GET" && p === "/directory/enrollments") return this.listEnrollments();
      if (req.method === "GET" && p === "/directory/events") return this.listEvents(url);
      // 写面（仅身份/授权/审批类，三条铁律；权限门在 gateway：COORD_ADMIN_TOKEN）
      if (req.method === "POST" && p === "/directory/projects") return this.registerProject(await req.json());
      if (req.method === "POST" && p === "/directory/engineers") return this.upsertEngineer(await req.json());
      if (req.method === "POST" && p === "/directory/memberships") return this.requestMembership(await req.json());
      const mt = p.match(/^\/directory\/memberships\/(mem_[0-9A-Z]+)\/transition$/);
      if (req.method === "POST" && mt) return this.transitionMembership(mt[1]!, await req.json());
      if (req.method === "POST" && p === "/directory/agents") return this.enrollAgent(await req.json());
      const hb = p.match(/^\/directory\/agents\/(agt_[0-9A-Z]+)\/heartbeat$/);
      if (req.method === "POST" && hb) return this.agentHeartbeat(hb[1]!, await req.json());
      const rn = p.match(/^\/directory\/agents\/(agt_[0-9A-Z]+)\/rename$/);
      if (req.method === "POST" && rn) return this.renameAgent(rn[1]!, await req.json());
      const lc = p.match(/^\/directory\/agents\/(agt_[0-9A-Z]+)\/lifecycle$/);
      if (req.method === "POST" && lc) return this.setAgentLifecycle(lc[1]!, await req.json());
      if (req.method === "POST" && p === "/directory/enrollments") return this.createEnrollment(await req.json());
      const rv = p.match(/^\/directory\/enrollments\/(enr_[0-9A-Z]+)\/revoke$/);
      if (req.method === "POST" && rv) return this.revokeEnrollment(rv[1]!, await req.json());
      return json(404, { error: "not_found" });
    } catch (e) {
      if (e instanceof SyntaxError) return json(400, { error: "invalid_json" });
      throw e;
    }
  }

  // ---------- 审计事件（append-only，coord/0.1.2 directory.*） ----------

  private emit(type: EventType, resourceId: string, actor: string, payload: Obj): void {
    this.sql.exec(
      `INSERT INTO events (event_id,type,resource_id,agent_id,at,payload) VALUES (?,?,?,?,?,?)`,
      `evt_${ulid()}`, type, resourceId, actor, iso(Date.now()), JSON.stringify(payload),
    );
  }

  private listEvents(url: URL): Response {
    const since = url.searchParams.get("since");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
    const rows = since
      ? [...this.sql.exec(`SELECT * FROM events WHERE event_id > ? ORDER BY event_id LIMIT ?`, since, limit)]
      : [...this.sql.exec(`SELECT * FROM events ORDER BY event_id LIMIT ?`, limit)];
    return json(200, {
      events: rows.map((r) => ({ protocol: PROTOCOL, ...r, payload: JSON.parse(r["payload"] as string) })),
    });
  }

  // ---------- Project ----------

  private registerProject(body: unknown): Response {
    const b = isObj(body) ? body : null;
    const slug = str(b, "slug");
    if (!slug || !SLUG_RE.test(slug))
      return json(422, { error: "invalid_slug", details: ["slug 必须匹配 ^[a-z0-9][a-z0-9-]{1,62}$"] });
    const visibility = str(b, "visibility") ?? "private";
    if (!(PROJECT_VISIBILITIES as readonly string[]).includes(visibility))
      return json(422, { error: "invalid_visibility", details: ["visibility 必须是 public | private"] });
    const modules = jsonField(b, "modules", []);
    if (modules instanceof Response) return modules;
    const sla = jsonField(b, "sla", {});
    if (sla instanceof Response) return sla;
    const gatePolicy = jsonField(b, "gate_policy", { agent_admission: "auto" }); // D2 默认自动准入
    if (gatePolicy instanceof Response) return gatePolicy;

    const dup = [...this.sql.exec(`SELECT project_id FROM projects WHERE slug=?`, slug)][0];
    if (dup) return json(409, { error: "slug_taken", project_id: dup["project_id"] });

    const now = iso(Date.now());
    const row = [...this.sql.exec<ProjectRow>(
      `INSERT INTO projects (project_id,slug,name,visibility,modules,sla,gate_policy,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?) RETURNING *`,
      `prj_${ulid()}`, slug, str(b, "name") ?? slug, visibility, modules, sla, gatePolicy, now, now,
    )][0]!;
    this.emit("directory.project.registered", `project:${slug}`, actorOf(b), {
      project_id: row.project_id, slug, visibility,
    });
    return json(201, { project: this.toProject(row) });
  }

  private listProjects(): Response {
    const rows = [...this.sql.exec<ProjectRow>(`SELECT * FROM projects ORDER BY slug`)];
    return json(200, { projects: rows.map((r) => this.toProject(r)) });
  }

  private toProject(r: ProjectRow): Obj {
    return {
      project_id: r.project_id,
      slug: r.slug,
      name: r.name,
      visibility: r.visibility,
      modules: JSON.parse(r.modules),
      sla: JSON.parse(r.sla),
      gate_policy: JSON.parse(r.gate_policy),
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }

  // ---------- Engineer ----------

  /** upsert by handle：@handle 全局唯一。同 handle 再 POST = 更新资料（200）；
   *  但 github_login 与在册记录冲突（两边非空且不同）= 抢占他人 handle → 409。
   *  GitHub 永远是权威：github_login 是判定「同一个人」的锚点。 */
  private upsertEngineer(body: unknown): Response {
    const b = isObj(body) ? body : null;
    const raw = str(b, "handle");
    const handle = raw?.startsWith("@") ? raw.slice(1) : raw;
    if (!handle || !HANDLE_RE.test(handle))
      return json(422, { error: "invalid_handle", details: ["handle 必须匹配 ^[a-z0-9][a-z0-9-]{0,38}$（可带 @ 前缀）"] });
    const githubLogin = str(b, "github_login") ?? null;
    const displayName = str(b, "display_name");

    const existing = [...this.sql.exec<EngineerRow>(`SELECT * FROM engineers WHERE handle=?`, handle)][0];
    const now = iso(Date.now());
    if (existing) {
      if (githubLogin && existing.github_login && githubLogin !== existing.github_login)
        return json(409, {
          error: "handle_taken",
          handle,
          details: [`@${handle} 已被 github:${existing.github_login} 注册`],
        });
      const row = [...this.sql.exec<EngineerRow>(
        `UPDATE engineers SET display_name=?, github_login=?, updated_at=? WHERE engineer_id=? RETURNING *`,
        displayName ?? existing.display_name, githubLogin ?? existing.github_login, now, existing.engineer_id,
      )][0]!;
      this.emit("directory.engineer.upserted", `engineer:${handle}`, actorOf(b), {
        engineer_id: row.engineer_id, handle, created: false,
      });
      return json(200, { engineer: this.toEngineer(row) });
    }
    const row = [...this.sql.exec<EngineerRow>(
      `INSERT INTO engineers (engineer_id,handle,display_name,github_login,created_at,updated_at)
       VALUES (?,?,?,?,?,?) RETURNING *`,
      `eng_${ulid()}`, handle, displayName ?? handle, githubLogin, now, now,
    )][0]!;
    this.emit("directory.engineer.upserted", `engineer:${handle}`, actorOf(b), {
      engineer_id: row.engineer_id, handle, created: true,
    });
    return json(201, { engineer: this.toEngineer(row) });
  }

  private listEngineers(): Response {
    const rows = [...this.sql.exec<EngineerRow>(`SELECT * FROM engineers ORDER BY handle`)];
    return json(200, { engineers: rows.map((r) => this.toEngineer(r)) });
  }

  private toEngineer(r: EngineerRow): Obj {
    return {
      engineer_id: r.engineer_id,
      handle: r.handle,
      display_name: r.display_name,
      github_login: r.github_login,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }

  private engineerByRef(ref: string): EngineerRow | undefined {
    if (ref.startsWith("eng_"))
      return [...this.sql.exec<EngineerRow>(`SELECT * FROM engineers WHERE engineer_id=?`, ref)][0];
    const handle = ref.startsWith("@") ? ref.slice(1) : ref;
    return [...this.sql.exec<EngineerRow>(`SELECT * FROM engineers WHERE handle=?`, handle)][0];
  }

  private projectByRef(ref: string): ProjectRow | undefined {
    if (ref.startsWith("prj_"))
      return [...this.sql.exec<ProjectRow>(`SELECT * FROM projects WHERE project_id=?`, ref)][0];
    return [...this.sql.exec<ProjectRow>(`SELECT * FROM projects WHERE slug=?`, ref)][0];
  }

  // ---------- Membership ----------

  private requestMembership(body: unknown): Response {
    const b = isObj(body) ? body : null;
    const projectRef = str(b, "project");
    const engineerRef = str(b, "engineer");
    const role = str(b, "role");
    if (!projectRef || !engineerRef)
      return json(422, { error: "invalid_membership", details: ["project 与 engineer 必填（slug/id 或 @handle/id）"] });
    if (!role || !(MEMBERSHIP_ROLES as readonly string[]).includes(role))
      return json(422, { error: "invalid_role", details: [`role 必须是 ${MEMBERSHIP_ROLES.join(" | ")} 之一`] });
    const project = this.projectByRef(projectRef);
    if (!project) return json(404, { error: "unknown_project", project: projectRef });
    const engineer = this.engineerByRef(engineerRef);
    if (!engineer) return json(404, { error: "unknown_engineer", engineer: engineerRef });

    // F06：加入向导带来的申请上下文（模块/自介），W6 审批队列展示用；全部可选。
    const modules = jsonField(b, "modules", []);
    if (modules instanceof Response) return modules;
    const intro = str(b, "intro") ?? "";
    const onboardingIssueUrl = str(b, "onboarding_issue_url") ?? null;

    const dup = [...this.sql.exec(
      `SELECT membership_id, status FROM memberships WHERE project_id=? AND engineer_id=?`,
      project.project_id, engineer.engineer_id,
    )][0];
    if (dup)
      return json(409, { error: "membership_exists", membership_id: dup["membership_id"], status: dup["status"] });

    const now = iso(Date.now());
    const row = [...this.sql.exec<MembershipRow>(
      `INSERT INTO memberships (membership_id,project_id,engineer_id,role,status,modules,intro,onboarding_issue_url,created_at,updated_at)
       VALUES (?,?,?,?,'pending',?,?,?,?,?) RETURNING *`,
      `mem_${ulid()}`, project.project_id, engineer.engineer_id, role, modules, intro, onboardingIssueUrl, now, now,
    )][0]!;
    this.emit("directory.membership.requested", `membership:${project.slug}/${engineer.handle}`, actorOf(b), {
      membership_id: row.membership_id, project: project.slug, engineer: engineer.handle, role,
    });
    return json(201, { membership: this.toMembership(row) });
  }

  /** 状态机迁移：approve（pending→active）/ suspend（active→suspended）/
   *  reinstate（suspended→active）。条件 UPDATE 原子判定——空返回 = 前置状态
   *  不满足 → 409（禁止 SELECT-then-decide）；未知 action → 422。 */
  private transitionMembership(id: string, body: unknown): Response {
    const b = isObj(body) ? body : null;
    const action = str(b, "action");
    if (!action || !(action in MEMBERSHIP_TRANSITIONS))
      return json(422, { error: "invalid_action", details: ["action 必须是 approve | suspend | reinstate"] });
    const spec = MEMBERSHIP_TRANSITIONS[action as MembershipAction];
    const now = iso(Date.now());
    const placeholders = spec.from.map(() => "?").join(",");
    const updated = [...this.sql.exec<MembershipRow>(
      `UPDATE memberships SET status=?, updated_at=? WHERE membership_id=? AND status IN (${placeholders}) RETURNING *`,
      spec.to, now, id, ...spec.from,
    )][0];
    if (!updated) {
      const current = [...this.sql.exec<{ status: string }>(
        `SELECT status FROM memberships WHERE membership_id=?`, id,
      )][0];
      if (!current) return json(404, { error: "membership_not_found" });
      return json(409, { error: `invalid_transition:${current.status}->${spec.to}`, action });
    }
    this.emit("directory.membership.transitioned", `membership:${id}`, actorOf(b), {
      membership_id: id, action, from: spec.from, to: spec.to,
    });
    return json(200, { membership: this.toMembership(updated) });
  }

  private toMembership(r: MembershipRow): Obj {
    return {
      membership_id: r.membership_id,
      project_id: r.project_id,
      engineer_id: r.engineer_id,
      role: r.role,
      status: r.status,
      modules: JSON.parse(r.modules),
      intro: r.intro,
      onboarding_issue_url: r.onboarding_issue_url,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }

  private listMemberships(): Response {
    // 目录读面的「行自答」（§1 设计推论）：membership 行直接带 slug/handle
    const rows = [...this.sql.exec<MembershipRow & { project_slug: string; engineer_handle: string; project_sla: string }>(
      `SELECT m.*, p.slug AS project_slug, e.handle AS engineer_handle, p.sla AS project_sla
       FROM memberships m
       JOIN projects p ON p.project_id = m.project_id
       JOIN engineers e ON e.engineer_id = m.engineer_id
       ORDER BY m.membership_id`,
    )];
    return json(200, {
      memberships: rows.map((r) => ({
        ...this.toMembership(r),
        project_slug: r.project_slug,
        engineer_handle: r.engineer_handle,
        // pending 行附带 SLA 现状（W6 审批队列倒计时徽章的数据源）；非 pending 不适用
        sla: r.status === "pending" ? this.slaFor(r.created_at, r.project_sla) : null,
      })),
    });
  }

  /** SLA 判定单一出口：project.sla.promiseH（默认 24h）+ membership.created_at。 */
  private slaFor(createdAt: string, projectSlaJson: string): SlaStatus {
    let promiseH = 24;
    try {
      const parsed = JSON.parse(projectSlaJson) as { promiseH?: unknown };
      if (typeof parsed.promiseH === "number" && parsed.promiseH > 0) promiseH = parsed.promiseH;
    } catch {
      /* 解析失败 → 用默认 24h（fail-closed 到保守值，不炸读面） */
    }
    return computeSlaStatus(createdAt, promiseH);
  }

  /** GET /directory/memberships/:id/sla — 轮询判定「是否已超时」（F06；供 owner 待拍板
   *  升级流 / 未来 F10 dispatcher 消费，本 feature 只产出信号，不跑 cron）。 */
  private membershipSla(id: string): Response {
    const row = [...this.sql.exec<MembershipRow & { project_sla: string }>(
      `SELECT m.*, p.sla AS project_sla FROM memberships m JOIN projects p ON p.project_id = m.project_id WHERE m.membership_id=?`,
      id,
    )][0];
    if (!row) return json(404, { error: "membership_not_found" });
    if (row.status !== "pending")
      return json(200, { membership_id: id, status: row.status, sla: null });
    return json(200, { membership_id: id, status: "pending", sla: this.slaFor(row.created_at, row.project_sla) });
  }

  // ---------- Agent ----------

  /** enroll 登记：owner 必填（人类问责锚点）；D6 命名——owner 命名空间内唯一，
   *  顶级名不得含点号；sub-agent 必须给 parent_agent_id，且名字 = parent 现名
   *  + "." + 合法单段延伸；parent 与 sub 必须同 owner（owner 沿 parent 链一致）。 */
  private enrollAgent(body: unknown): Response {
    const b = isObj(body) ? body : null;
    const ownerRef = str(b, "owner");
    if (!ownerRef)
      return json(422, { error: "owner_required", details: ["agent.owner 必填：任何 agent 都必须归属一个人类（@handle 或 engineer_id）"] });
    const owner = this.engineerByRef(ownerRef);
    if (!owner) return json(404, { error: "unknown_owner", owner: ownerRef });

    const name = str(b, "name");
    const nameErr = this.validateAgentName(name, str(b, "parent_agent_id") ?? null, owner.engineer_id);
    if (nameErr instanceof Response) return nameErr;
    const parent = nameErr; // AgentRow | null

    const capabilities = jsonField(b, "capabilities", []);
    if (capabilities instanceof Response) return capabilities;

    const dup = [...this.sql.exec(
      `SELECT agent_id FROM agents WHERE owner_engineer_id=? AND name=?`, owner.engineer_id, name,
    )][0];
    if (dup)
      return json(409, { error: "agent_name_taken", agent_id: dup["agent_id"], identifier: `@${owner.handle}/${name}` });

    const now = iso(Date.now());
    const row = [...this.sql.exec<AgentRow>(
      `INSERT INTO agents (agent_id,name,owner_engineer_id,parent_agent_id,capabilities,last_heartbeat_at,created_at,updated_at)
       VALUES (?,?,?,?,?,NULL,?,?) RETURNING *`,
      `agt_${ulid()}`, name, owner.engineer_id, parent?.agent_id ?? null, capabilities, now, now,
    )][0]!;
    this.emit("directory.agent.enrolled", `agent:@${owner.handle}/${name}`, actorOf(b), {
      agent_id: row.agent_id, owner: owner.handle, name, parent_agent_id: parent?.agent_id ?? null,
    });
    return json(201, { agent: this.toAgent(row) });
  }

  /** 名字合法性单一出口（enroll 与 rename 共用）。合法时返回 parent 行（无 parent
   *  返回 null），非法时返回 4xx Response。 */
  private validateAgentName(
    name: string | undefined,
    parentId: string | null,
    ownerEngineerId: string,
  ): Response | AgentRow | null {
    if (!name || name.length > AGENT_NAME_MAX || !name.split(".").every((s) => AGENT_SEGMENT_RE.test(s)))
      return json(422, { error: "invalid_agent_name", details: ["name 必须是点号分隔的小写段（^[a-z0-9][a-z0-9-]*$）"] });
    if (!parentId) {
      if (name.includes("."))
        return json(422, { error: "dotted_name_requires_parent", details: ["点号命名保留给 sub-agent：必须带 parent_agent_id（D6）"] });
      return null;
    }
    const parent = [...this.sql.exec<AgentRow>(`SELECT * FROM agents WHERE agent_id=?`, parentId)][0];
    if (!parent) return json(404, { error: "unknown_parent", parent_agent_id: parentId });
    if (parent.owner_engineer_id !== ownerEngineerId)
      return json(422, { error: "parent_owner_mismatch", details: ["sub-agent 必须与 parent 同 owner（owner 沿 parent 链一致）"] });
    if (!name.startsWith(`${parent.name}.`) || name.length <= parent.name.length + 1)
      return json(422, {
        error: "invalid_sub_name",
        details: [`sub-agent 名必须沿 parent 现名点号延伸：${parent.name}.<segment>`],
      });
    return parent;
  }

  /** 心跳时间戳更新（enroll 后「等首个心跳点亮」，M2 的 aha moment 数据源）。 */
  private agentHeartbeat(id: string, body: unknown): Response {
    const b = isObj(body) ? body : null;
    const now = iso(Date.now());
    const row = [...this.sql.exec<AgentRow>(
      `UPDATE agents SET last_heartbeat_at=?, updated_at=? WHERE agent_id=? RETURNING *`, now, now, id,
    )][0];
    if (!row) return json(404, { error: "agent_not_found" });
    this.emit("directory.agent.heartbeat", `agent:${id}`, actorOf(b), { agent_id: id, at: now });
    return json(200, { agent: this.toAgent(row) });
  }

  /** 改名：ULID 主键不可变（D6 改名不断链——parent/enrollment 引用全部锚 ULID，
   *  旧 ULID 照常解析）。新名走同一套命名规则（相对其现有 parent）。 */
  private renameAgent(id: string, body: unknown): Response {
    const b = isObj(body) ? body : null;
    const row = [...this.sql.exec<AgentRow>(`SELECT * FROM agents WHERE agent_id=?`, id)][0];
    if (!row) return json(404, { error: "agent_not_found" });
    const name = str(b, "name");
    const nameErr = this.validateAgentName(name, row.parent_agent_id, row.owner_engineer_id);
    if (nameErr instanceof Response) return nameErr;
    const dup = [...this.sql.exec(
      `SELECT agent_id FROM agents WHERE owner_engineer_id=? AND name=? AND agent_id<>?`,
      row.owner_engineer_id, name, id,
    )][0];
    if (dup) return json(409, { error: "agent_name_taken", agent_id: dup["agent_id"] });
    const now = iso(Date.now());
    const updated = [...this.sql.exec<AgentRow>(
      `UPDATE agents SET name=?, updated_at=? WHERE agent_id=? RETURNING *`, name, now, id,
    )][0]!;
    this.emit("directory.agent.updated", `agent:${id}`, actorOf(b), {
      agent_id: id, field: "name", from: row.name, to: name,
    });
    return json(200, { agent: this.toAgent(updated) });
  }

  /** 生命周期迁移：pause/resume/retire（条件 UPDATE 原子判定，非法迁移 409，见常量注释）。
   *  轮换 token 不经此路径——那是 RepoHub 的事，本 DO 只管身份/授权面的三条铁律。 */
  private setAgentLifecycle(id: string, body: unknown): Response {
    const b = isObj(body) ? body : null;
    const action = str(b, "action");
    if (!action || !(action in AGENT_LIFECYCLE_TRANSITIONS))
      return json(422, { error: "invalid_action", details: ["action 必须是 pause | resume | retire"] });
    const spec = AGENT_LIFECYCLE_TRANSITIONS[action as AgentLifecycleAction];
    const now = iso(Date.now());
    const placeholders = spec.from.map(() => "?").join(",");
    const updated = [...this.sql.exec<AgentRow>(
      `UPDATE agents SET lifecycle=?, updated_at=? WHERE agent_id=? AND lifecycle IN (${placeholders}) RETURNING *`,
      spec.to, now, id, ...spec.from,
    )][0];
    if (!updated) {
      const current = [...this.sql.exec<{ lifecycle: string }>(
        `SELECT lifecycle FROM agents WHERE agent_id=?`, id,
      )][0];
      if (!current) return json(404, { error: "agent_not_found" });
      return json(409, { error: `invalid_transition:${current.lifecycle}->${spec.to}`, action });
    }
    this.emit("directory.agent.lifecycle_changed", `agent:${id}`, actorOf(b), {
      agent_id: id, action, to: spec.to,
    });
    return json(200, { agent: this.toAgent(updated) });
  }

  private getAgent(id: string): Response {
    const row = [...this.sql.exec<AgentRow>(`SELECT * FROM agents WHERE agent_id=?`, id)][0];
    if (!row) return json(404, { error: "agent_not_found" });
    return json(200, { agent: this.toAgent(row) });
  }

  private listAgents(): Response {
    const rows = [...this.sql.exec<AgentRow>(`SELECT * FROM agents ORDER BY agent_id`)];
    return json(200, { agents: rows.map((r) => this.toAgent(r)) });
  }

  /** 行自答三问（§1 设计推论）：哪个项目的？属于哪个人类？parent 是谁？ */
  private toAgent(r: AgentRow): Obj {
    const owner = [...this.sql.exec<EngineerRow>(
      `SELECT * FROM engineers WHERE engineer_id=?`, r.owner_engineer_id,
    )][0];
    const parent = r.parent_agent_id
      ? [...this.sql.exec<AgentRow>(`SELECT agent_id, name FROM agents WHERE agent_id=?`, r.parent_agent_id)][0]
      : undefined;
    const projects = [...this.sql.exec<{ slug: string }>(
      `SELECT p.slug FROM enrollments en JOIN projects p ON p.project_id = en.project_id
       WHERE en.agent_id=? AND en.status='active' ORDER BY p.slug`, r.agent_id,
    )].map((x) => x.slug);
    return {
      agent_id: r.agent_id,
      name: r.name,
      identifier: owner ? `@${owner.handle}/${r.name}` : r.name, // D6：@handle/agent-name
      owner: owner ? { engineer_id: owner.engineer_id, handle: owner.handle } : null, // 属于哪个人类
      parent: parent ? { agent_id: parent["agent_id"], name: parent["name"] } : null, // parent 是谁
      projects, // 哪个项目的（active enrollment 的项目 slug）
      capabilities: JSON.parse(r.capabilities),
      lifecycle: r.lifecycle ?? "active", // active | paused | retired（p30/F07）
      last_heartbeat_at: r.last_heartbeat_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }

  // ---------- Enrollment ----------

  /** agent×项目授权登记 + scoped token 引用（token 本体在对应仓 RepoHub，
   *  这里只存 token_hash_prefix 引用）。同 pair 已 active → 409；曾 revoked →
   *  原行复活（ULID 不变，重新 emit created）。 */
  private createEnrollment(body: unknown): Response {
    const b = isObj(body) ? body : null;
    const agentId = str(b, "agent_id");
    const projectRef = str(b, "project");
    if (!agentId || !projectRef)
      return json(422, { error: "invalid_enrollment", details: ["agent_id 与 project（slug/id）必填"] });
    const agent = [...this.sql.exec<AgentRow>(`SELECT * FROM agents WHERE agent_id=?`, agentId)][0];
    if (!agent) return json(404, { error: "agent_not_found", agent_id: agentId });
    const project = this.projectByRef(projectRef);
    if (!project) return json(404, { error: "unknown_project", project: projectRef });
    const tokenRef = str(b, "token_ref") ?? null;
    if (tokenRef !== null && !TOKEN_REF_RE.test(tokenRef))
      return json(422, {
        error: "invalid_token_ref",
        details: ["token_ref 只接受 hash 前缀格式 ^[0-9a-f]{6,16}$；只存 hash 前缀，绝不存明文/完整 token"],
      });

    const existing = [...this.sql.exec<EnrollmentRow>(
      `SELECT * FROM enrollments WHERE agent_id=? AND project_id=?`, agentId, project.project_id,
    )][0];
    const now = iso(Date.now());
    if (existing) {
      if (existing.status === "active")
        return json(409, { error: "already_enrolled", enrollment_id: existing.enrollment_id });
      const row = [...this.sql.exec<EnrollmentRow>(
        `UPDATE enrollments SET status='active', token_ref=?, revoked_at=NULL WHERE enrollment_id=? RETURNING *`,
        tokenRef, existing.enrollment_id,
      )][0]!;
      this.emit("directory.enrollment.created", `enrollment:${row.enrollment_id}`, actorOf(b), {
        enrollment_id: row.enrollment_id, agent_id: agentId, project: project.slug, reenrolled: true,
      });
      return json(200, { enrollment: row });
    }
    const row = [...this.sql.exec<EnrollmentRow>(
      `INSERT INTO enrollments (enrollment_id,agent_id,project_id,token_ref,status,created_at,revoked_at)
       VALUES (?,?,?,?,'active',?,NULL) RETURNING *`,
      `enr_${ulid()}`, agentId, project.project_id, tokenRef, now,
    )][0]!;
    this.emit("directory.enrollment.created", `enrollment:${row.enrollment_id}`, actorOf(b), {
      enrollment_id: row.enrollment_id, agent_id: agentId, project: project.slug, reenrolled: false,
    });
    return json(201, { enrollment: row });
  }

  private revokeEnrollment(id: string, body: unknown): Response {
    const b = isObj(body) ? body : null;
    const now = iso(Date.now());
    // 条件 UPDATE 原子判定：只有 active 可吊销；重复吊销 → 409（非法迁移被拒）
    const row = [...this.sql.exec<EnrollmentRow>(
      `UPDATE enrollments SET status='revoked', revoked_at=? WHERE enrollment_id=? AND status='active' RETURNING *`,
      now, id,
    )][0];
    if (!row) {
      const current = [...this.sql.exec<{ status: string }>(
        `SELECT status FROM enrollments WHERE enrollment_id=?`, id,
      )][0];
      if (!current) return json(404, { error: "enrollment_not_found" });
      return json(409, { error: `invalid_transition:${current.status}->revoked` });
    }
    this.emit("directory.enrollment.revoked", `enrollment:${id}`, actorOf(b), {
      enrollment_id: id, agent_id: row.agent_id,
    });
    return json(200, { enrollment: row });
  }

  private listEnrollments(): Response {
    const rows = [...this.sql.exec(
      `SELECT en.*, p.slug AS project_slug FROM enrollments en
       JOIN projects p ON p.project_id = en.project_id ORDER BY en.enrollment_id`,
    )];
    return json(200, { enrollments: rows });
  }
}
