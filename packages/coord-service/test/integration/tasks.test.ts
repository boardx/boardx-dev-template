// tasks.test.ts — 平台中立派工原语（#594）的授权边界与生命周期。
import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { sha256Hex } from "../../src/lib/crypto";

async function seedAgent(id: string, token: string, kind = "module-coordinator", active = 1): Promise<void> {
  const tokenHash = await sha256Hex(token);
  await env.DB.prepare(
    "INSERT INTO agents (id, kind, areas, token_hash, active, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(id, kind, null, tokenHash, active, new Date().toISOString())
    .run();
}

function post(path: string, token: string, body?: unknown): Request {
  return new Request(`http://coord-service.local${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body ?? {}),
  });
}

function get(path: string, token: string): Request {
  return new Request(`http://coord-service.local${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function dispatch(issue = 594, assignee = "wrk-1"): Promise<number> {
  const res = await SELF.fetch(post("/tasks", "coord-token", { issue, assignee }));
  expect(res.status).toBe(201);
  const body = (await res.json()) as { task: { id: number } };
  return body.task.id;
}

describe("tasks 派工原语（#594：收件箱 + 轮询契约的服务端）", () => {
  beforeEach(async () => {
    await seedAgent("coord-t", "coord-token", "coordinator");
    await seedAgent("wrk-1", "wrk1-token", "worker");
    await seedAgent("wrk-2", "wrk2-token", "worker");
  });

  it("worker 不能派工（403）——派工是协调层权力，同 andon 的门", async () => {
    const res = await SELF.fetch(post("/tasks", "wrk1-token", { issue: 1, assignee: "wrk-2" }));
    expect(res.status).toBe(403);
  });

  it("coordinator 派工成功；assignee 收件箱可见 pending", async () => {
    const id = await dispatch();
    const inbox = await SELF.fetch(get("/tasks?status=pending", "wrk1-token"));
    expect(inbox.status).toBe(200);
    const body = (await inbox.json()) as { tasks: Array<{ id: number; issue: number; status: string }> };
    expect(body.tasks.map((t) => t.id)).toContain(id);
    expect(body.tasks[0]!.status).toBe("pending");
  });

  it("派给未注册/inactive 身份直接 400——收件箱黑洞在入口拒绝", async () => {
    const res = await SELF.fetch(post("/tasks", "coord-token", { issue: 1, assignee: "ghost" }));
    expect(res.status).toBe(400);
    await seedAgent("wrk-off", "off-token", "worker", 0);
    const res2 = await SELF.fetch(post("/tasks", "coord-token", { issue: 1, assignee: "wrk-off" }));
    expect(res2.status).toBe(400);
  });

  it("收件箱是私有的：worker 查别人 403，coordinator 查任何人 200", async () => {
    await dispatch();
    const spy = await SELF.fetch(get("/tasks?assignee=wrk-1", "wrk2-token"));
    expect(spy.status).toBe(403);
    const boss = await SELF.fetch(get("/tasks?assignee=wrk-1", "coord-token"));
    expect(boss.status).toBe(200);
  });

  it("ack：仅 assignee；pending→acked 写 acked_at；重复 ack 409", async () => {
    const id = await dispatch();
    const wrong = await SELF.fetch(post(`/tasks/${id}/ack`, "wrk2-token"));
    expect(wrong.status).toBe(403);
    const ok = await SELF.fetch(post(`/tasks/${id}/ack`, "wrk1-token"));
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { task: { status: string; acked_at: string | null } };
    expect(body.task.status).toBe("acked");
    expect(body.task.acked_at).not.toBeNull();
    const dup = await SELF.fetch(post(`/tasks/${id}/ack`, "wrk1-token"));
    expect(dup.status).toBe(409);
  });

  it("done：assignee 可从 acked 或 pending 直达；recalled 后不可 done", async () => {
    const id = await dispatch();
    await SELF.fetch(post(`/tasks/${id}/ack`, "wrk1-token"));
    const done = await SELF.fetch(post(`/tasks/${id}/done`, "wrk1-token"));
    expect(done.status).toBe(200);

    const id2 = await dispatch(595);
    await SELF.fetch(post(`/tasks/${id2}/recall`, "coord-token"));
    const late = await SELF.fetch(post(`/tasks/${id2}/done`, "wrk1-token"));
    expect(late.status).toBe(409);
  });

  it("recall：仅 coordinator（assignee 自己不能撤）", async () => {
    const id = await dispatch();
    const self = await SELF.fetch(post(`/tasks/${id}/recall`, "wrk1-token"));
    expect(self.status).toBe(403);
    const ok = await SELF.fetch(post(`/tasks/${id}/recall`, "coord-token"));
    expect(ok.status).toBe(200);
  });

  it("全生命周期照写 events（task-dispatch/ack/done），portal 可对账", async () => {
    const id = await dispatch(777);
    await SELF.fetch(post(`/tasks/${id}/ack`, "wrk1-token"));
    await SELF.fetch(post(`/tasks/${id}/done`, "wrk1-token"));
    const rows = await env.DB.prepare(
      "SELECT type FROM events WHERE resource_id = 'issue:777' ORDER BY id"
    ).all<{ type: string }>();
    expect((rows.results ?? []).map((r) => r.type)).toEqual(["task-dispatch", "task-ack", "task-done"]);
  });

  it("手写 POST /events 不接受 task-* 类型（只能由 /tasks 路由内部产生）", async () => {
    const res = await SELF.fetch(post("/events", "coord-token", { type: "task-dispatch", resource_id: "issue:1" }));
    expect(res.status).toBe(400);
  });
});

// ── #631 加固：原子条件 UPDATE + 入参校验 ─────────────────────────────
describe("#631 transition 原子性（TOCTOU 修复）", () => {
  beforeEach(async () => {
    await seedAgent("coord-t2", "coord-token2", "coordinator");
    await seedAgent("wrk-c", "wrkc-token", "worker");
  });

  it("并发 ack 只有一个成功，另一个 409——且只写一条 task-ack 事件", async () => {
    const res = await SELF.fetch(post("/tasks", "coord-token2", { issue: 631, assignee: "wrk-c" }));
    const id = ((await res.json()) as { task: { id: number } }).task.id;

    // 两个 ack 同时打——read-check-write 版本会双双通过并写两条事件
    const [a, b] = await Promise.all([
      SELF.fetch(post(`/tasks/${id}/ack`, "wrkc-token")),
      SELF.fetch(post(`/tasks/${id}/ack`, "wrkc-token")),
    ]);
    const codes = [a.status, b.status].sort();
    expect(codes).toEqual([200, 409]); // 恰好一胜一败，不是双双 200

    const events = await env.DB.prepare(
      "SELECT type FROM events WHERE resource_id = 'issue:631' AND type = 'task-ack'"
    ).all<{ type: string }>();
    expect((events.results ?? []).length).toBe(1); // 事件不重复
  });

  it("并发 done 与 recall：只有一个生效，最终状态自洽", async () => {
    const res = await SELF.fetch(post("/tasks", "coord-token2", { issue: 632, assignee: "wrk-c" }));
    const id = ((await res.json()) as { task: { id: number } }).task.id;
    const [d, r] = await Promise.all([
      SELF.fetch(post(`/tasks/${id}/done`, "wrkc-token")),
      SELF.fetch(post(`/tasks/${id}/recall`, "coord-token2")),
    ]);
    expect([d.status, r.status].sort()).toEqual([200, 409]);
    const row = await env.DB.prepare("SELECT status FROM tasks WHERE id = ?").bind(id).first<{ status: string }>();
    expect(["done", "recalled"]).toContain(row!.status); // 终态是二者之一，不是错乱
  });

  it("409 报出的是真实当前状态（原子判定后回读）", async () => {
    const res = await SELF.fetch(post("/tasks", "coord-token2", { issue: 633, assignee: "wrk-c" }));
    const id = ((await res.json()) as { task: { id: number } }).task.id;
    await SELF.fetch(post(`/tasks/${id}/ack`, "wrkc-token"));
    const dup = await SELF.fetch(post(`/tasks/${id}/ack`, "wrkc-token"));
    expect(dup.status).toBe(409);
    expect((await dup.json()) as { error: string }).toEqual({ error: "invalid_transition:acked->acked" });
  });
});

describe("#631 派工入参校验", () => {
  beforeEach(async () => {
    await seedAgent("coord-t3", "coord-token3", "coordinator");
    await seedAgent("wrk-d", "wrkd-token", "worker");
  });

  it("deadline 非法时间 → 400（脏值进库会让超期判定静默失效）", async () => {
    const bad = await SELF.fetch(post("/tasks", "coord-token3", { issue: 1, assignee: "wrk-d", deadline: "下周三" }));
    expect(bad.status).toBe(400);
    expect((await bad.json()) as { error: string }).toEqual({ error: "invalid_deadline" });
  });

  it("deadline 合法 → 归一成 ISO 存储", async () => {
    const ok = await SELF.fetch(post("/tasks", "coord-token3", { issue: 2, assignee: "wrk-d", deadline: "2026-08-01T10:00:00Z" }));
    expect(ok.status).toBe(201);
    expect(((await ok.json()) as { task: { deadline: string } }).task.deadline).toBe("2026-08-01T10:00:00.000Z");
  });

  it("note 超 2000 字 → 400 note_too_long（拒绝，不静默截断）", async () => {
    const long = await SELF.fetch(post("/tasks", "coord-token3", { issue: 3, assignee: "wrk-d", note: "x".repeat(2001) }));
    expect(long.status).toBe(400);
    expect((await long.json()) as { error: string }).toEqual({ error: "note_too_long" });
  });

  it("body 超 16KB → 413 body_too_large（不进 JSON.parse）", async () => {
    const huge = await SELF.fetch(post("/tasks", "coord-token3", { issue: 4, assignee: "wrk-d", note: "x".repeat(20000) }));
    expect(huge.status).toBe(413);
  });
});

describe("#594 P3 门户派工看板：assignee=* 列全队", () => {
  beforeEach(async () => {
    await seedAgent("coord-p3", "coord-p3-token", "coordinator");
    await seedAgent("wrk-p3a", "wrka-token", "worker");
    await seedAgent("wrk-p3b", "wrkb-token", "worker");
  });
  it("coordinator assignee=* 列出所有 agent 的任务", async () => {
    await SELF.fetch(post("/tasks", "coord-p3-token", { issue: 701, assignee: "wrk-p3a" }));
    await SELF.fetch(post("/tasks", "coord-p3-token", { issue: 702, assignee: "wrk-p3b" }));
    const res = await SELF.fetch(get("/tasks?assignee=*", "coord-p3-token"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tasks: Array<{ issue: number; assignee: string }> };
    const pairs = body.tasks.map((t) => `${t.assignee}:${t.issue}`);
    expect(pairs).toContain("wrk-p3a:701");
    expect(pairs).toContain("wrk-p3b:702");
  });
  it("worker assignee=* → 403（列全队是协调层特权）", async () => {
    const res = await SELF.fetch(get("/tasks?assignee=*", "wrka-token"));
    expect(res.status).toBe(403);
  });
  it("assignee=* 可叠加 status 过滤", async () => {
    const r = await SELF.fetch(post("/tasks", "coord-p3-token", { issue: 703, assignee: "wrk-p3a" }));
    const id = ((await r.json()) as { task: { id: number } }).task.id;
    await SELF.fetch(post(`/tasks/${id}/ack`, "wrka-token"));
    const pending = await SELF.fetch(get("/tasks?assignee=*&status=pending", "coord-p3-token"));
    const body = (await pending.json()) as { tasks: Array<{ issue: number }> };
    expect(body.tasks.map((t) => t.issue)).not.toContain(703); // 已 ack，不在 pending
  });
});
