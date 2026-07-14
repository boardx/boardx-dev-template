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
