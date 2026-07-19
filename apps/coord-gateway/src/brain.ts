// CoordBrain DO（每仓一个，与 RepoHub 同 worker，ADR-017 风格）——R1 影子模式（p30-F10）。
//
// 纪律红线（本 feature 与 F06/F11/F12 的本质区别）：本文件全代码路径**零写操作**——
// 没有任何 fetch 调用指向 GitHub 的合并/派工/回收 API，只有：
//   ① 读 RepoHub 镜像/租约/andon（GET）
//   ② 把决策写进本 DO 自己的 shadow_events 表（纯本地 SQLite INSERT，非 GitHub 写）
// 决策计算全部委托给 @repo/coord-brain 的纯函数（runShadowSopCycle），本文件
// 只做「读快照 → 调纯函数 → 记事件」的搬运，不含任何判定逻辑本身（避免逻辑分裂）。
import { DurableObject } from "cloudflare:workers";
import { runShadowSopCycle, type ShadowDecision, type ShadowDecisionInput } from "@repo/coord-brain";
import { BRAIN_SCHEMA } from "./brain-schema";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function iso(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

interface ShadowEventRow {
  [key: string]: string | number | null;
  seq: number;
  event_id: string;
  tick_id: string;
  rule: string;
  subject_id: string;
  decision: number;
  reason: string;
  detail: string | null;
  at: string;
}

export class CoordBrain extends DurableObject {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env as never);
    this.sql = ctx.storage.sql;
    this.sql.exec(BRAIN_SCHEMA);
  }

  override async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const p = url.pathname;
    try {
      if (req.method === "POST" && p === "/shadow/record") return this.record(await req.json());
      if (req.method === "GET" && p === "/shadow/decisions") return this.listDecisions(url);
      if (req.method === "GET" && p === "/shadow/cycle-status") return this.cycleStatus();
      return json(404, { error: "not_found" });
    } catch (e) {
      if (e instanceof SyntaxError) return json(400, { error: "invalid_json" });
      throw e;
    }
  }

  /** 唯一写入口：把一批影子决策原样落库为事件行。**不调用任何外部 API**——
   *  纯粹的本地 SQLite INSERT，是"记录"而非"执行"。 */
  private record(body: unknown): Response {
    const b = body as { decisions?: ShadowDecision[]; at?: string } | null;
    const decisions = b?.decisions;
    if (!Array.isArray(decisions)) return json(422, { error: "invalid_shadow_record", details: ["decisions 必须是数组"] });
    const at = typeof b?.at === "string" && b.at.length > 0 ? b.at : iso(Date.now());
    const tickId = `tick_${crypto.randomUUID()}`;
    for (const d of decisions) {
      const eventId = `she_${crypto.randomUUID()}`;
      this.sql.exec(
        `INSERT INTO shadow_events (event_id,tick_id,rule,subject_id,decision,reason,detail,at)
         VALUES (?,?,?,?,?,?,?,?)`,
        eventId, tickId, d.rule, d.subject_id, d.decision ? 1 : 0, d.reason,
        d.detail ? JSON.stringify(d.detail) : null, at,
      );
    }
    return json(201, { ok: true, tick_id: tickId, written: decisions.length, at });
  }

  private listDecisions(url: URL): Response {
    const since = url.searchParams.get("since");
    const rule = url.searchParams.get("rule");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 1000);
    const clauses: string[] = [];
    const params: (string | number)[] = [];
    if (since) { clauses.push("at > ?"); params.push(since); }
    if (rule) { clauses.push("rule = ?"); params.push(rule); }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    // 排序权威是 seq（AUTOINCREMENT，插入序单调），不是 at——"at" 截到秒级，
    // 同一 tick/同一秒内的多条决策若按 at 排序会被打乱因果序（#F10 集成测试发现）。
    const rows = [...this.sql.exec<ShadowEventRow>(
      `SELECT * FROM shadow_events ${where} ORDER BY seq DESC LIMIT ?`, ...params, limit,
    )];
    return json(200, {
      decisions: rows.map((r) => ({
        event_id: r.event_id,
        tick_id: r.tick_id,
        rule: r.rule,
        subject_id: r.subject_id,
        decision: r.decision === 1,
        reason: r.reason,
        detail: r.detail ? JSON.parse(r.detail) : null,
        at: r.at,
      })),
    });
  }

  /** verify-shadow-cycle.sh 消费：影子事件流的时间跨度（首条→末条），供脚本判定
   *  是否已满足 G5 拍板的门槛（≥24h 且 ≥1 完整 C-cycle，取长者）。本 DO 只报告
   *  原始事实（首末时间戳），阈值判定逻辑在脚本侧（保持"事实"与"判定"分离）。 */
  private cycleStatus(): Response {
    const first = [...this.sql.exec<{ at: string }>(`SELECT at FROM shadow_events ORDER BY seq ASC LIMIT 1`)][0];
    const last = [...this.sql.exec<{ at: string }>(`SELECT at FROM shadow_events ORDER BY seq DESC LIMIT 1`)][0];
    const count = [...this.sql.exec<{ n: number }>(`SELECT COUNT(*) as n FROM shadow_events`)][0];
    return json(200, {
      event_count: count?.n ?? 0,
      first_at: first?.at ?? null,
      last_at: last?.at ?? null,
      span_ms: first && last ? Date.parse(last.at) - Date.parse(first.at) : 0,
    });
  }
}

// ---------- Cron 编排（宿主调用，同 projection.ts 风格） ----------

export interface ShadowTickEnv {
  REPOHUB: DurableObjectNamespace;
  COORDBRAIN: DurableObjectNamespace;
  /** JSON 字符串：模块标签 → 建议 assignee（可选，缺省 {} 即"从不建议派工"，
   *  fail-closed，宁可影子模式下漏报也不可无凭据地建议）。 */
  COORD_BRAIN_AFFINITY?: string;
}

async function doJson<T>(stub: DurableObjectStub, path: string, init?: RequestInit): Promise<T> {
  const res = await stub.fetch(`https://do${path}`, init);
  if (!res.ok) throw new Error(`do_${res.status}: ${path}`);
  return res.json<T>();
}

function parseAffinity(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, string>;
  } catch {
    /* 配置损坏视同未配置，fail-closed */
  }
  return {};
}

/** 单仓一次影子 tick：读 RepoHub 只读端点（GET，零写）→ 纯函数判定 → 写本仓
 *  CoordBrain 的 shadow_events（本地 INSERT，非外部 API）。任何一步失败只记日志，
 *  不影响其他仓（同 projection.ts 的隔离纪律）。 */
export async function runShadowTickForRepo(env: ShadowTickEnv, repo: string): Promise<void> {
  const repoStub = env.REPOHUB.get(env.REPOHUB.idFromName(repo));
  const brainStub = env.COORDBRAIN.get(env.COORDBRAIN.idFromName(repo));

  const [prsRes, issuesRes, leasesRes, andon] = await Promise.all([
    doJson<{ items: Array<Record<string, unknown>> }>(repoStub, "/realtime/prs?state=open"),
    doJson<{ items: Array<Record<string, unknown>> }>(repoStub, "/realtime/issues?state=open"),
    doJson<{ leases: Array<Record<string, unknown>> }>(repoStub, "/claims"),
    doJson<{ active: boolean; andons: Array<{ scope: string; reason: string; raised_by?: string; raised_at?: string }> }>(repoStub, "/andon"),
  ]);

  const input: ShadowDecisionInput = {
    prs: prsRes.items.map((i) => ({
      number: i["number"] as number,
      head_sha: (i["head_sha"] as string | null) ?? null,
      mergeable: (i["mergeable"] as string | null) ?? null,
      merge_state: (i["merge_state"] as string | null) ?? null,
      opened_at: (i["created_at"] as string | undefined) ?? null,
      labels: ((i["labels"] as Array<string | { name?: string }> | undefined) ?? []).map((l) =>
        typeof l === "string" ? l : (l.name ?? ""),
      ),
    })),
    issues: issuesRes.items.map((i) => ({
      number: i["number"] as number,
      state: (i["state"] as string) ?? "open",
      labels: ((i["labels"] as Array<string | { name?: string }> | undefined) ?? []).map((l) =>
        typeof l === "string" ? l : (l.name ?? ""),
      ),
      assignees: ((i["assignees"] as Array<string | { login?: string }> | undefined) ?? []).map((a) =>
        typeof a === "string" ? a : (a.login ?? ""),
      ),
    })),
    leases: leasesRes.leases.map((l) => ({
      lease_id: l["lease_id"] as string,
      resource_id: l["resource_id"] as string,
      agent_id: l["agent_id"] as string,
      claimed_at: l["claimed_at"] as string,
      last_heartbeat_at: l["last_heartbeat_at"] as string,
      expires_at: l["expires_at"] as string,
    })),
    andon: { active: andon.active, andons: andon.andons },
    affinity: parseAffinity(env.COORD_BRAIN_AFFINITY),
    now: Date.now(),
  };

  const decisions = runShadowSopCycle(input);
  await doJson(brainStub, "/shadow/record", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decisions, at: iso(Date.now()) }),
  });
}

export async function runShadowTick(env: ShadowTickEnv & { PROJECTION_REPOS?: string }): Promise<void> {
  const repos = (env.PROJECTION_REPOS ?? "boardx/boardx-dev-template")
    .split(",").map((r) => r.trim()).filter(Boolean);
  for (const repo of repos) {
    try {
      await runShadowTickForRepo(env, repo);
    } catch (e) {
      console.error(`[coord-brain shadow] ${repo} 本 tick 失败（不影响其他仓，下 tick 重试）`, e);
    }
  }
}
