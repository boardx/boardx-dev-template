// RepoHub：每仓一个的协调内核 DO（ADR-017）。
// 原子性来自 DO 单线程串行执行 + uq_active_lease 部分唯一索引双保险；
// 所有租约判定都在这里发生，禁止任何调用方 SELECT-then-INSERT。
import { DurableObject } from "cloudflare:workers";
import {
  PROTOCOL,
  LEASE_TTL_DEFAULT_SECONDS,
  validateClaimRequest,
  validateReleaseRequest,
  validateEvidenceManifest,
  type ClaimRequest,
  type EvidenceManifest,
  type Lease,
  type ReleaseRequest,
  type EventType,
} from "@repo/coord-protocol";
import { SCHEMA } from "./schema";
import { ulid } from "./ulid";

interface LeaseRow {
  [key: string]: string | number | null;
  lease_id: string;
  resource_id: string;
  resource_type: string;
  agent_id: string;
  status: string;
  claimed_at: string;
  last_heartbeat_at: string;
  ttl_seconds: number;
  expires_at: string;
  handoff_note: string | null;
}

interface MirrorRow {
  [key: string]: string | number | null;
  kind: string;
  number: number;
  state: string;
  title: string;
  head_sha: string | null;
  mergeable: string | null;
  merge_state: string | null;
  labels: string;
  assignees: string;
  data: string;
  mirrored_at: string;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// WS 一次性 ticket 有效期（F09）：只够浏览器完成一次握手，泄露也无长期价值
const STREAM_TICKET_TTL_MS = 60_000;

function iso(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

export class RepoHub extends DurableObject {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env as never);
    this.sql = ctx.storage.sql;
    this.sql.exec(SCHEMA);
    // WS 心跳走 Hibernation 自带的自动应答：客户端发 "ping" → 运行时直接回 "pong"，
    // 不唤醒 DO（F09）。
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  // ---------- HTTP 入口（gateway 经 stub.fetch 调用） ----------

  override async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const p = url.pathname;
    try {
      if (req.method === "POST" && p === "/claims") return this.claim(await req.json());
      const hb = p.match(/^\/claims\/([^/]+)\/heartbeat$/);
      if (req.method === "POST" && hb) return this.heartbeat(hb[1]!, await req.json());
      const rel = p.match(/^\/claims\/([^/]+)\/release$/);
      if (req.method === "POST" && rel) return this.release(rel[1]!, await req.json());
      if (req.method === "GET" && p === "/claims") return this.listActiveLeases();
      if (req.method === "GET" && p === "/events") return this.listEvents(url);
      if (req.method === "POST" && p === "/andon") return this.andonAction(await req.json());
      if (req.method === "GET" && p === "/andon") return this.andonStatus();
      if (req.method === "GET" && p === "/projector/cursor") return this.cursorGet();
      if (req.method === "PUT" && p === "/projector/cursor") return this.cursorPut(await req.json());
      if (req.method === "POST" && p === "/evidence") return this.submitEvidence(await req.json());
      if (req.method === "GET" && p === "/evidence") return this.listEvidence(url);
      if (req.method === "POST" && p === "/mirror/upsert") return this.mirrorUpsert(await req.json());
      if (req.method === "POST" && p === "/webhook/ingest") return this.webhookIngest(await req.json());
      if (req.method === "POST" && p === "/tokens/mint") return this.tokenMint(await req.json());
      if (req.method === "POST" && p === "/tokens/revoke") return this.tokenRevoke(await req.json());
      if (req.method === "POST" && p === "/tokens/verify") return this.tokenVerify(await req.json());
      if (req.method === "GET" && p === "/tokens") return this.tokenList();
      if (req.method === "POST" && p === "/stream/ticket") return this.mintStreamTicket();
      if (req.method === "GET" && p === "/stream") return this.streamUpgrade(req, url);
      const rt = p.match(/^\/realtime\/(issues|prs)$/);
      if (req.method === "GET" && rt) return this.realtimeList(rt[1] === "prs" ? "pr" : "issue", url);
      const one = p.match(/^\/realtime\/prs\/(\d+)$/);
      if (req.method === "GET" && one) return this.realtimeOne("pr", Number(one[1]));
      return json(404, { error: "not_found" });
    } catch (e) {
      if (e instanceof SyntaxError) return json(400, { error: "invalid_json" });
      throw e;
    }
  }

  // ---------- Lease（F05） ----------

  private claim(body: unknown): Response {
    const v = validateClaimRequest(body);
    if (!v.ok) return json(422, { error: "invalid_claim_request", details: v.errors });
    const req = body as ClaimRequest;

    const existing = this.activeLease(req.resource_id);
    if (existing) {
      if (existing.agent_id === req.agent_id) return json(200, this.toLease(existing)); // 幂等
      return json(409, {
        protocol: PROTOCOL,
        error: "resource_claimed",
        holder: {
          lease_id: existing.lease_id,
          agent_id: existing.agent_id,
          claimed_at: existing.claimed_at,
          last_heartbeat_at: existing.last_heartbeat_at,
          expires_at: existing.expires_at,
        },
      });
    }

    const now = Date.now();
    const ttl = req.ttl_seconds ?? LEASE_TTL_DEFAULT_SECONDS;
    const row: LeaseRow = {
      lease_id: `lse_${ulid(now)}`,
      resource_id: req.resource_id,
      resource_type: req.resource_type,
      agent_id: req.agent_id,
      status: "in_progress",
      claimed_at: iso(now),
      last_heartbeat_at: iso(now),
      ttl_seconds: ttl,
      expires_at: iso(now + ttl * 1000),
      handoff_note: null,
    };
    this.sql.exec(
      `INSERT INTO leases (lease_id,resource_id,resource_type,agent_id,status,claimed_at,last_heartbeat_at,ttl_seconds,expires_at,handoff_note)
       VALUES (?,?,?,?,?,?,?,?,?,NULL)`,
      row.lease_id, row.resource_id, row.resource_type, row.agent_id,
      row.status, row.claimed_at, row.last_heartbeat_at, row.ttl_seconds, row.expires_at,
    );
    this.emit("lease.claimed", row.resource_id, row.agent_id, { ttl_seconds: ttl, lease_id: row.lease_id });
    void this.scheduleNextAlarm();
    return json(201, this.toLease(row));
  }

  private heartbeat(leaseId: string, body: unknown): Response {
    const agentId = (body as Record<string, unknown> | null)?.["agent_id"];
    const row = this.leaseById(leaseId);
    if (!row) return json(404, { error: "lease_not_found" });
    if (row.status !== "in_progress") return json(410, { error: "lease_gone", status: row.status }); // 防僵尸续命
    if (row.agent_id !== agentId) return json(403, { error: "not_lease_holder" });
    const now = Date.now();
    const expires = iso(now + row.ttl_seconds * 1000);
    this.sql.exec(
      `UPDATE leases SET last_heartbeat_at=?, expires_at=? WHERE lease_id=?`,
      iso(now), expires, leaseId,
    );
    this.emit("lease.heartbeat", row.resource_id, row.agent_id, { lease_id: leaseId });
    return json(200, this.toLease({ ...row, last_heartbeat_at: iso(now), expires_at: expires }));
  }

  private release(leaseId: string, body: unknown): Response {
    const v = validateReleaseRequest(body);
    if (!v.ok) return json(422, { error: "invalid_release_request", details: v.errors });
    const req = body as ReleaseRequest;
    const row = this.leaseById(leaseId);
    if (!row) return json(404, { error: "lease_not_found" });
    if (row.status !== "in_progress") return json(410, { error: "lease_gone", status: row.status });
    if (row.agent_id !== req.agent_id) return json(403, { error: "not_lease_holder" });
    this.sql.exec(
      `UPDATE leases SET status='released', handoff_note=? WHERE lease_id=?`,
      req.handoff_note, leaseId,
    );
    this.emit("lease.released", row.resource_id, row.agent_id, {
      lease_id: leaseId,
      handoff_note: req.handoff_note,
    });
    return json(200, this.toLease({ ...row, status: "released", handoff_note: req.handoff_note }));
  }

  private listActiveLeases(): Response {
    const rows = [...this.sql.exec<LeaseRow>(`SELECT * FROM leases WHERE status='in_progress' ORDER BY claimed_at`)];
    return json(200, { leases: rows.map((r) => this.toLease(r)) });
  }

  // TTL 过期回收：DO alarm 机械执行（lease.md——不依赖巡检会话恰好注意到）
  override async alarm(): Promise<void> {
    const now = Date.now();
    const due = [...this.sql.exec<LeaseRow>(
      `SELECT * FROM leases WHERE status='in_progress' AND expires_at <= ?`, iso(now),
    )];
    for (const row of due) {
      const note = `[expired] last_heartbeat_at=${row.last_heartbeat_at}`;
      this.sql.exec(`UPDATE leases SET status='expired', handoff_note=? WHERE lease_id=?`, note, row.lease_id);
      this.emit("lease.expired", row.resource_id, row.agent_id, {
        lease_id: row.lease_id,
        last_heartbeat_at: row.last_heartbeat_at,
        handoff_note: note,
      });
    }
    await this.scheduleNextAlarm();
  }

  private async scheduleNextAlarm(): Promise<void> {
    const next = [...this.sql.exec<{ expires_at: string }>(
      `SELECT expires_at FROM leases WHERE status='in_progress' ORDER BY expires_at LIMIT 1`,
    )][0];
    const current = await this.ctx.storage.getAlarm();
    if (!next) {
      if (current !== null) await this.ctx.storage.deleteAlarm();
      return;
    }
    const at = Date.parse(next.expires_at);
    if (current === null || Math.abs(current - at) > 1000) await this.ctx.storage.setAlarm(at);
  }

  // ---------- Events ----------

  private emit(type: EventType, resourceId: string, agentId: string, payload: Record<string, unknown>): void {
    const event = {
      protocol: PROTOCOL,
      event_id: `evt_${ulid()}`,
      type,
      resource_id: resourceId,
      agent_id: agentId,
      at: iso(Date.now()),
      payload,
    };
    this.sql.exec(
      `INSERT INTO events (event_id,type,resource_id,agent_id,at,payload) VALUES (?,?,?,?,?,?)`,
      event.event_id, type, resourceId, agentId, event.at, JSON.stringify(payload),
    );
    // F09：入库后向所有活跃 WS 连接广播同一信封（events.md wire format）。
    // send 失败 = 连接已死，由运行时的 close 流程回收，不影响事件落库。
    const wire = JSON.stringify(event);
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(wire); } catch { /* 死连接，忽略 */ }
    }
  }

  private listEvents(url: URL): Response {
    const since = url.searchParams.get("since");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
    const rows = since
      ? [...this.sql.exec(`SELECT * FROM events WHERE event_id > ? ORDER BY event_id LIMIT ?`, since, limit)]
      : [...this.sql.exec(`SELECT * FROM events ORDER BY event_id LIMIT ?`, limit)];
    return json(200, {
      events: rows.map((r) => ({ ...r, payload: JSON.parse(r["payload"] as string) })),
    });
  }

  // ---------- WS 实时流（F09） ----------
  // 订阅语义（events.md §订阅）：连接后先按 ?since=<event_id> 补发积压，再进实时；
  // 断线重连用最后收到的 event_id 续传。鉴权两条路：
  //   1) gateway 已验 bearer → 转发时带 x-coord-stream-auth: bearer（DO 仅 gateway 可达）；
  //   2) 浏览器路径 → ?ticket=<一次性 60s ticket>（WebSocket 无法带 Authorization header）。

  private mintStreamTicket(): Response {
    const now = Date.now();
    // 顺手清理过期 ticket（量极小，无需独立 alarm）
    this.sql.exec(`DELETE FROM stream_tickets WHERE expires_at <= ?`, iso(now));
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const ticket = "stk_" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    const expiresAt = iso(now + STREAM_TICKET_TTL_MS);
    this.sql.exec(`INSERT INTO stream_tickets (ticket, expires_at) VALUES (?,?)`, ticket, expiresAt);
    return json(201, { ticket, expires_at: expiresAt });
  }

  /** 一次性消费：查到即销（无论过期与否），再判有效期——重放窗口为零。 */
  private consumeStreamTicket(ticket: string): boolean {
    const row = [...this.sql.exec<{ expires_at: string }>(
      `SELECT expires_at FROM stream_tickets WHERE ticket=?`, ticket,
    )][0];
    if (!row) return false;
    this.sql.exec(`DELETE FROM stream_tickets WHERE ticket=?`, ticket);
    return Date.parse(row.expires_at) > Date.now();
  }

  private streamUpgrade(req: Request, url: URL): Response {
    if (req.headers.get("upgrade")?.toLowerCase() !== "websocket")
      return json(426, { error: "upgrade_required" });
    if (req.headers.get("x-coord-stream-auth") !== "bearer") {
      const ticket = url.searchParams.get("ticket");
      if (!ticket || !this.consumeStreamTicket(ticket))
        return json(401, { error: "invalid_or_expired_ticket" });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server); // Hibernation API：连接可在 DO 休眠后存活
    // 先补发积压再进实时：acceptWebSocket 之后、返回 101 之前发送，与后续 emit
    // 广播同在 DO 单线程内串行，不会乱序或丢事件。
    const since = url.searchParams.get("since");
    const backlog = since
      ? [...this.sql.exec(`SELECT * FROM events WHERE event_id > ? ORDER BY event_id LIMIT 500`, since)]
      : [...this.sql.exec(`SELECT * FROM events ORDER BY event_id LIMIT 500`)];
    for (const r of backlog) {
      server.send(JSON.stringify({ protocol: PROTOCOL, ...r, payload: JSON.parse(r["payload"] as string) }));
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(_ws: WebSocket, _message: string | ArrayBuffer): Promise<void> {
    // 客户端不上行业务消息；心跳 ping/pong 由 setWebSocketAutoResponse 处理，不到这里
  }

  override async webSocketClose(ws: WebSocket, code: number, _reason: string, _clean: boolean): Promise<void> {
    try { ws.close(code === 1005 ? 1000 : code); } catch { /* 已关闭 */ }
  }

  // ---------- Andon（F06） ----------
  // 权限（仅 maintainer 级可发）在 gateway 层由独立 COORD_ADMIN_TOKEN 把守；
  // DO 只管状态机与 payload 合法性——校验规则与 coord-protocol validateEvent
  // 的 andon 分支保持一致（reason≥10、scope ∈ repo|module:<name>、raise 时
  // severity 必须 stop-merge），events.md §Andon 是权威。

  private andonAction(body: unknown): Response {
    const b = body as Record<string, unknown> | null;
    const action = b?.["action"];
    const agentId = b?.["agent_id"];
    const reason = b?.["reason"];
    const scope = b?.["scope"];
    const errors: string[] = [];
    if (action !== "raise" && action !== "clear") errors.push('action 必须是 "raise" | "clear"');
    if (typeof agentId !== "string" || agentId.length === 0) errors.push("agent_id 必须是非空字符串");
    if (typeof reason !== "string" || reason.length < 10) errors.push("reason 长度必须 ≥10（须含可查证锚点）");
    if (typeof scope !== "string" || !(scope === "repo" || /^module:[\w-]+$/.test(scope)))
      errors.push("scope 必须是 repo 或 module:<name>");
    if (action === "raise" && b?.["severity"] !== "stop-merge")
      errors.push('severity 必须是 "stop-merge"');
    if (errors.length > 0) return json(422, { error: "invalid_andon_request", details: errors });

    const s = scope as string;
    const now = iso(Date.now());
    const current = [...this.sql.exec(`SELECT active FROM andon_state WHERE scope=?`, s)][0];
    if (action === "raise") {
      if (current && current["active"] === 1)
        return json(409, { error: "andon_already_active", scope: s });
      this.sql.exec(
        `INSERT INTO andon_state (scope,active,severity,reason,raised_by,raised_at,cleared_at)
         VALUES (?,1,'stop-merge',?,?,?,NULL)
         ON CONFLICT(scope) DO UPDATE SET
           active=1, severity='stop-merge', reason=excluded.reason,
           raised_by=excluded.raised_by, raised_at=excluded.raised_at, cleared_at=NULL`,
        s, reason as string, agentId as string, now,
      );
      this.emit("andon.raised", s, agentId as string, {
        scope: s, reason, severity: "stop-merge",
      });
    } else {
      if (!current || current["active"] !== 1)
        return json(409, { error: "andon_not_active", scope: s });
      this.sql.exec(`UPDATE andon_state SET active=0, cleared_at=? WHERE scope=?`, now, s);
      this.emit("andon.cleared", s, agentId as string, { scope: s, reason });
    }
    return this.andonStatus();
  }

  private andonStatus(): Response {
    const rows = [...this.sql.exec(`SELECT * FROM andon_state WHERE active=1 ORDER BY scope`)];
    return json(200, {
      active: rows.length > 0, // 任一 scope 停线即整体停线（投影阻断的判定口径）
      andons: rows.map((r) => ({
        scope: r["scope"], severity: r["severity"], reason: r["reason"],
        raised_by: r["raised_by"], raised_at: r["raised_at"],
      })),
    });
  }

  // ---------- Evidence（F07） ----------

  // 完成声明入库：manifest 是"声明"不是"事实"（evidence.md），入库前先过协议校验——
  // 非法声明（exit_code 非 0、缺 head_sha 等）422 拒收，防止假证据进入审计链。
  private submitEvidence(body: unknown): Response {
    const v = validateEvidenceManifest(body);
    if (!v.ok) return json(422, { error: "invalid_evidence_manifest", details: v.errors });
    const m = body as EvidenceManifest;
    const dup = [...this.sql.exec(
      `SELECT 1 FROM evidence_manifests WHERE manifest_id=?`, m.manifest_id,
    )][0];
    if (dup) return json(200, { ok: true, manifest_id: m.manifest_id, duplicate: true }); // 幂等重提交
    const now = iso(Date.now());
    this.sql.exec(
      `INSERT INTO evidence_manifests (manifest_id,resource_id,head_sha,body,at) VALUES (?,?,?,?,?)`,
      m.manifest_id, m.resource_id, m.head_sha, JSON.stringify(m), now,
    );
    this.emit("evidence.submitted", m.resource_id, m.agent_id, {
      manifest_id: m.manifest_id,
      head_sha: m.head_sha,
    });
    return json(201, { ok: true, manifest_id: m.manifest_id, duplicate: false, at: now });
  }

  private listEvidence(url: URL): Response {
    const resourceId = url.searchParams.get("resource_id");
    const rows = resourceId
      ? [...this.sql.exec(`SELECT * FROM evidence_manifests WHERE resource_id=? ORDER BY manifest_id`, resourceId)]
      : [...this.sql.exec(`SELECT * FROM evidence_manifests ORDER BY manifest_id`)];
    return json(200, {
      manifests: rows.map((r) => ({
        manifest_id: r["manifest_id"],
        resource_id: r["resource_id"],
        head_sha: r["head_sha"],
        at: r["at"],
        manifest: JSON.parse(r["body"] as string),
      })),
    });
  }

  // ---------- 投影游标（F06） ----------

  private cursorGet(): Response {
    const row = [...this.sql.exec(`SELECT value FROM projector_state WHERE key='cursor'`)][0];
    return json(200, { cursor: row ? (row["value"] as string) : null });
  }

  private cursorPut(body: unknown): Response {
    const cursor = (body as Record<string, unknown> | null)?.["cursor"];
    if (typeof cursor !== "string" || cursor.length === 0)
      return json(422, { error: "invalid_cursor" });
    this.sql.exec(
      `INSERT INTO projector_state (key,value) VALUES ('cursor',?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      cursor,
    );
    return json(200, { ok: true, cursor });
  }

  // ---------- Mirror（F04） ----------

  private mirrorUpsert(body: unknown): Response {
    const b = body as Record<string, unknown> | null;
    const kind = b?.["kind"];
    const data = b?.["data"] as Record<string, unknown> | undefined;
    if ((kind !== "issue" && kind !== "pr") || !data || typeof data["number"] !== "number")
      return json(422, { error: "invalid_mirror_item", details: ["需要 kind issue|pr 与含 number 的 data"] });
    const now = iso(Date.now());
    this.sql.exec(
      `INSERT INTO mirror_items (kind,number,state,title,head_sha,mergeable,merge_state,labels,assignees,data,mirrored_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(kind,number) DO UPDATE SET
         state=excluded.state, title=excluded.title, head_sha=excluded.head_sha,
         mergeable=excluded.mergeable, merge_state=excluded.merge_state,
         labels=excluded.labels, assignees=excluded.assignees,
         data=excluded.data, mirrored_at=excluded.mirrored_at`,
      kind, data["number"], String(data["state"] ?? "unknown"), String(data["title"] ?? ""),
      (data["head_sha"] as string | undefined) ?? null,
      (data["mergeable"] as string | undefined) ?? null,
      (data["merge_state"] as string | undefined) ?? null,
      JSON.stringify(data["labels"] ?? []), JSON.stringify(data["assignees"] ?? []),
      JSON.stringify(data), now,
    );
    this.emit("mirror.updated", `${kind}:${data["number"]}`, "system", { kind, number: data["number"] });
    return json(200, { ok: true, mirrored_at: now });
  }

  // webhook 幂等入口（F03）：delivery GUID 去重后应用镜像增量。
  // 去重判定在 DO 单线程内完成——重复投递（GitHub redelivery/重试）不产生重复事件。
  private webhookIngest(body: unknown): Response {
    const b = body as Record<string, unknown> | null;
    const deliveryId = b?.["delivery_id"];
    if (typeof deliveryId !== "string" || deliveryId.length === 0)
      return json(422, { error: "missing_delivery_id" });
    const seen = [...this.sql.exec(`SELECT 1 FROM deliveries WHERE delivery_id=?`, deliveryId)][0];
    if (seen) return json(200, { ok: true, duplicate: true });
    this.sql.exec(`INSERT INTO deliveries (delivery_id, at) VALUES (?,?)`, deliveryId, iso(Date.now()));
    const mirror = b?.["mirror"] as Record<string, unknown> | undefined;
    if (mirror) {
      const r = this.mirrorUpsert(mirror);
      if (r.status !== 200) return r;
    }
    return json(200, { ok: true, duplicate: false });
  }

  private realtimeList(kind: "issue" | "pr", url: URL): Response {
    const state = url.searchParams.get("state");
    const rows = state
      ? [...this.sql.exec<MirrorRow>(`SELECT * FROM mirror_items WHERE kind=? AND state=? ORDER BY number DESC`, kind, state)]
      : [...this.sql.exec<MirrorRow>(`SELECT * FROM mirror_items WHERE kind=? ORDER BY number DESC`, kind)];
    return json(200, { items: rows.map(rowToItem) });
  }

  private realtimeOne(kind: "issue" | "pr", number: number): Response {
    const row = [...this.sql.exec<MirrorRow>(`SELECT * FROM mirror_items WHERE kind=? AND number=?`, kind, number)][0];
    if (!row) return json(404, { error: "not_mirrored" });
    return json(200, rowToItem(row));
  }

  // ---------- Agent tokens（F08：按仓 scoped token，DO 是唯一权威） ----------
  // 安全不变量：①明文只在 mint 响应出现一次，DO 只存 sha256 hex；②verify 每次
  // 实时查表（吊销即时生效，无任何缓存层）；③跨仓 scope 由存储位置天然保证——
  // token 只在所属仓的 DO 有记录，别仓 verify 查无即拒。调用方权限（mint/revoke
  // 是 COORD_ADMIN_TOKEN 特权）在 gateway 层把守，DO 只管数据与判定。

  private async tokenMint(body: unknown): Promise<Response> {
    const b = body as Record<string, unknown> | null;
    const agentId = b?.["agent_id"];
    const owner = b?.["owner"];
    const errors: string[] = [];
    if (typeof agentId !== "string" || agentId.length === 0) errors.push("agent_id 必须是非空字符串");
    if (typeof owner !== "string" || owner.length === 0) errors.push("owner 必须是非空字符串（问责锚点）");
    if (errors.length > 0) return json(422, { error: "invalid_token_mint_request", details: errors });

    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes); // CSPRNG，256-bit 熵
    const token = `coordtk_${toHex(bytes)}`;
    const hash = await sha256Hex(token);
    const now = iso(Date.now());
    this.sql.exec(
      `INSERT INTO agent_tokens (token_hash,owner,agent_id,created_at,revoked_at) VALUES (?,?,?,?,NULL)`,
      hash, owner as string, agentId as string, now,
    );
    // 明文 token 只在这个响应里出现一次，之后任何接口都拿不回它
    return json(201, {
      token,
      token_hash_prefix: hash.slice(0, 8),
      agent_id: agentId,
      owner,
      created_at: now,
    });
  }

  private tokenVerify(body: unknown): Response {
    const hash = (body as Record<string, unknown> | null)?.["token_hash"];
    if (typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash))
      return json(422, { error: "invalid_token_hash" });
    const row = [...this.sql.exec(`SELECT * FROM agent_tokens WHERE token_hash=?`, hash)][0];
    if (!row) return json(404, { ok: false, reason: "unknown_token" }); // 含跨仓 token：本仓查无
    if (row["revoked_at"]) return json(401, { ok: false, reason: "revoked" });
    return json(200, { ok: true, agent_id: row["agent_id"], owner: row["owner"] });
  }

  private tokenRevoke(body: unknown): Response {
    const b = body as Record<string, unknown> | null;
    const full = b?.["token_hash"];
    const prefix = b?.["token_hash_prefix"];
    let where: string; let arg: string;
    if (typeof full === "string" && /^[0-9a-f]{64}$/.test(full)) {
      where = "token_hash=?"; arg = full;
    } else if (typeof prefix === "string" && /^[0-9a-f]{8,64}$/.test(prefix)) {
      where = "token_hash LIKE ?"; arg = `${prefix}%`; // 前缀吊销（列表接口只露前 8 位）
    } else {
      return json(422, { error: "invalid_token_revoke_request", details: ["需要 token_hash（64 hex）或 token_hash_prefix（≥8 hex）"] });
    }
    const rows = [...this.sql.exec(`SELECT token_hash, revoked_at FROM agent_tokens WHERE ${where}`, arg)];
    if (rows.length === 0) return json(404, { error: "token_not_found" });
    if (rows.length > 1) return json(409, { error: "ambiguous_prefix", matches: rows.length });
    const target = rows[0]!;
    if (target["revoked_at"]) {
      return json(200, { ok: true, already_revoked: true, revoked_at: target["revoked_at"] }); // 幂等
    }
    const now = iso(Date.now());
    this.sql.exec(`UPDATE agent_tokens SET revoked_at=? WHERE token_hash=?`, now, target["token_hash"]);
    return json(200, { ok: true, already_revoked: false, revoked_at: now });
  }

  // 列表绝不含明文（拿不回）也不含完整 hash（防离线撞库比对），只露前 8 位定位用
  private tokenList(): Response {
    const rows = [...this.sql.exec(`SELECT * FROM agent_tokens ORDER BY created_at`)];
    return json(200, {
      tokens: rows.map((r) => ({
        token_hash_prefix: (r["token_hash"] as string).slice(0, 8),
        agent_id: r["agent_id"],
        owner: r["owner"],
        created_at: r["created_at"],
        revoked_at: r["revoked_at"],
      })),
    });
  }

  // ---------- helpers ----------

  private activeLease(resourceId: string): LeaseRow | undefined {
    return [...this.sql.exec<LeaseRow>(
      `SELECT * FROM leases WHERE resource_id=? AND status='in_progress'`, resourceId,
    )][0];
  }

  private leaseById(leaseId: string): LeaseRow | undefined {
    return [...this.sql.exec<LeaseRow>(`SELECT * FROM leases WHERE lease_id=?`, leaseId)][0];
  }

  private toLease(row: LeaseRow): Lease {
    return {
      protocol: PROTOCOL,
      lease_id: row.lease_id,
      resource_id: row.resource_id,
      resource_type: row.resource_type as Lease["resource_type"],
      agent_id: row.agent_id,
      status: row.status as Lease["status"],
      claimed_at: row.claimed_at,
      last_heartbeat_at: row.last_heartbeat_at,
      ttl_seconds: row.ttl_seconds,
      expires_at: row.expires_at,
      ...(row.handoff_note ? { handoff_note: row.handoff_note } : {}),
    };
  }
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return toHex(new Uint8Array(digest));
}

function rowToItem(row: MirrorRow): Record<string, unknown> {
  const data = JSON.parse(row.data) as Record<string, unknown>;
  return {
    kind: row.kind,
    body: typeof data["body"] === "string" ? data["body"] : null, // 投影解析 "Closes #N" 关联（F06）
    number: row.number,
    state: row.state,
    title: row.title,
    head_sha: row.head_sha,
    mergeable: row.mergeable,
    merge_state: row.merge_state,
    labels: JSON.parse(row.labels),
    assignees: JSON.parse(row.assignees),
    mirrored_at: row.mirrored_at, // 新鲜度锚点：响应必带（F04）
  };
}
