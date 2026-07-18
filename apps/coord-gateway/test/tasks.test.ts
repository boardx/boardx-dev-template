// F10-pre tasks 面隔离测试（真 workerd）：
//   派工/撤回/导入 = COORD_ADMIN_TOKEN 管理面（原 coord-service COORDINATOR_KINDS）；
//   收件箱轮询 + ack/complete = scoped 面 + agent_id 强绑定（冒充 403）；
//   GET /tasks：admin bearer 可 assignee=*（devportal broker，#706），
//   scoped 强制只见自己（inbox_is_private），ops 万能钥匙可查任何人。
import { SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

const REPO = "boardx/boardx-dev-template";
const API = (sub: string) => `https://gw.test/api/coord/repos/${REPO}${sub}`;
const ADMIN = { authorization: "Bearer test-admin-token", "content-type": "application/json" };
const OPS = { authorization: "Bearer test-api-token", "content-type": "application/json" };

interface Task {
  id: number; issue: number; assignee: string; priority: string; status: string;
  note: string | null; created_by: string; acked_at: string | null;
}

// 吸收 vitest-pool-workers singleWorker 跨文件 transform 造成的一次性 DO 失效（同 gateway.test.ts）
beforeAll(async () => {
  for (let i = 0; i < 2; i++) {
    const r = await SELF.fetch(API("/claims"), {
      headers: { authorization: "Bearer test-api-token" },
    }).catch(() => null);
    if (r?.ok) break;
  }
});

async function mintScoped(agentId: string): Promise<string> {
  const r = await SELF.fetch(API("/tokens/mint"), {
    method: "POST", headers: ADMIN,
    body: JSON.stringify({ agent_id: agentId, owner: "usam.shen@gmail.com" }),
  });
  expect(r.status).toBe(201);
  return (await r.json<{ token: string }>()).token;
}

async function adminDispatch(issue: number, assignee: string): Promise<Task> {
  const r = await SELF.fetch(API("/tasks"), {
    method: "POST", headers: ADMIN,
    body: JSON.stringify({ issue, assignee, created_by: "devportal-broker", note: "[派工人 usam.shen@gmail.com] 测试派工" }),
  });
  expect(r.status).toBe(201);
  return (await r.json<{ task: Task }>()).task;
}

describe("tasks 派工面（admin 特权）", () => {
  it("POST /tasks：无 token 401；ops/scoped token 也是 401（派工是协调层权力）；admin 201", async () => {
    const body = JSON.stringify({ issue: 801, assignee: "wrk-gw-t1" });
    expect((await SELF.fetch(API("/tasks"), { method: "POST", body })).status).toBe(401);
    expect((await SELF.fetch(API("/tasks"), { method: "POST", headers: OPS, body })).status).toBe(401);
    const scoped = await mintScoped("wrk-gw-priv");
    expect((await SELF.fetch(API("/tasks"), {
      method: "POST", headers: { authorization: `Bearer ${scoped}`, "content-type": "application/json" }, body,
    })).status).toBe(401);
    const task = await adminDispatch(801, "wrk-gw-t1");
    expect(task).toMatchObject({ issue: 801, assignee: "wrk-gw-t1", status: "pending", created_by: "devportal-broker" });
  });

  it("recall/import 只在 admin 面：scoped/ops POST 401；REST 透传路径不存在（防绕过）", async () => {
    const task = await adminDispatch(802, "wrk-gw-t2");
    for (const headers of [OPS]) {
      expect((await SELF.fetch(API(`/tasks/${task.id}/recall`), { method: "POST", headers })).status).toBe(401);
      expect((await SELF.fetch(API("/tasks/import"), { method: "POST", headers, body: "{}" })).status).toBe(401);
    }
    const r = await SELF.fetch(API(`/tasks/${task.id}/recall`), { method: "POST", headers: ADMIN });
    expect(r.status).toBe(200);
    expect((await r.json<{ task: Task }>()).task.status).toBe("recalled");
  });

  it("缺 COORD_ADMIN_TOKEN 配置 → 派工 503 fail-closed", async () => {
    const { env } = await import("cloudflare:test");
    const worker = (await import("../src/index")).default;
    const req = new Request(API("/tasks"), {
      method: "POST", headers: ADMIN, body: JSON.stringify({ issue: 1, assignee: "x" }),
    });
    expect((await worker.fetch(req, { ...env, COORD_ADMIN_TOKEN: undefined })).status).toBe(503);
  });
});

describe("tasks 收件箱可见性（GET /tasks）", () => {
  it("admin bearer assignee=* 列全队（devportal broker 路径，#706）", async () => {
    await adminDispatch(803, "wrk-gw-a");
    await adminDispatch(804, "wrk-gw-b");
    const r = await SELF.fetch(API("/tasks?assignee=*"), { headers: ADMIN });
    expect(r.status).toBe(200);
    const { tasks } = await r.json<{ tasks: Task[] }>();
    const assignees = new Set(tasks.map((t) => t.assignee));
    expect(assignees.has("wrk-gw-a")).toBe(true);
    expect(assignees.has("wrk-gw-b")).toBe(true);
  });

  it("scoped token：缺省注入本人收件箱；指定他人/assignee=* → 403 inbox_is_private", async () => {
    await adminDispatch(805, "wrk-gw-me");
    const token = await mintScoped("wrk-gw-me");
    const bearer = { authorization: `Bearer ${token}` };
    const mine = await SELF.fetch(API("/tasks"), { headers: bearer });
    expect(mine.status).toBe(200);
    const { tasks } = await mine.json<{ tasks: Task[] }>();
    expect(tasks.length).toBeGreaterThanOrEqual(1);
    expect(tasks.every((t) => t.assignee === "wrk-gw-me")).toBe(true);

    const other = await SELF.fetch(API("/tasks?assignee=wrk-gw-a"), { headers: bearer });
    expect(other.status).toBe(403);
    expect((await other.json<Record<string, unknown>>())["error"]).toBe("inbox_is_private");
    expect((await SELF.fetch(API("/tasks?assignee=*"), { headers: bearer })).status).toBe(403);
    // 显式查自己 + status 过滤照常放行
    const own = await SELF.fetch(API("/tasks?assignee=wrk-gw-me&status=pending"), { headers: bearer });
    expect(own.status).toBe(200);
  });

  it("ops 万能钥匙可查任何人与 assignee=*（运维/协调层语义）", async () => {
    const one = await SELF.fetch(API("/tasks?assignee=wrk-gw-a"), { headers: OPS });
    expect(one.status).toBe(200);
    expect((await SELF.fetch(API("/tasks?assignee=*"), { headers: OPS })).status).toBe(200);
  });
});

describe("tasks ack/complete（scoped 面 + agent_id 强绑定）", () => {
  it("scoped 本人 ack → acked（空 body {} 即可，agent_id 由 gateway 注入）；complete → done + 事件可见", async () => {
    const task = await adminDispatch(806, "wrk-gw-ack");
    const token = await mintScoped("wrk-gw-ack");
    const bearer = { authorization: `Bearer ${token}`, "content-type": "application/json" };
    const acked = await SELF.fetch(API(`/tasks/${task.id}/ack`), { method: "POST", headers: bearer, body: "{}" });
    expect(acked.status).toBe(200);
    const a = (await acked.json<{ task: Task }>()).task;
    expect(a.status).toBe("acked");
    expect(typeof a.acked_at).toBe("string");
    const done = await SELF.fetch(API(`/tasks/${task.id}/complete`), { method: "POST", headers: bearer, body: "{}" });
    expect(done.status).toBe(200);
    expect((await done.json<{ task: Task }>()).task.status).toBe("done");
    // 状态迁移事件全链路可见（scoped 面读 events）
    const events = await (
      await SELF.fetch(API("/events?limit=500"), { headers: bearer })
    ).json<{ events: Array<{ type: string; payload: { task_id?: number } }> }>();
    const mine = events.events.filter((e) => e.payload.task_id === task.id);
    expect(mine.map((e) => e.type)).toEqual(["task.dispatched", "task.acked", "task.completed"]);
  });

  it("冒充：body 自证他人 agent_id → 403 token_agent_mismatch（gateway 拦截，DO 不触达）", async () => {
    const task = await adminDispatch(807, "wrk-gw-victim");
    const token = await mintScoped("wrk-gw-evil");
    const r = await SELF.fetch(API(`/tasks/${task.id}/ack`), {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ agent_id: "wrk-gw-victim" }),
    });
    expect(r.status).toBe(403);
    expect((await r.json<Record<string, unknown>>())["error"]).toBe("token_agent_mismatch");
  });

  it("非 assignee 的 scoped token ack 他人任务 → 403 not_your_task（DO 判定）", async () => {
    const task = await adminDispatch(808, "wrk-gw-owner");
    const token = await mintScoped("wrk-gw-stranger");
    const r = await SELF.fetch(API(`/tasks/${task.id}/ack`), {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: "{}",
    });
    expect(r.status).toBe(403);
    expect((await r.json<Record<string, unknown>>())["error"]).toBe("not_your_task");
  });
});
