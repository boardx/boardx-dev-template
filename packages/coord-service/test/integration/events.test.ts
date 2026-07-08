import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { sha256Hex } from "../../src/lib/crypto";

async function seedAgent(id: string, token: string, kind = "module-coordinator"): Promise<void> {
  // 默认 module-coordinator（有权写 andon）；测 andon 授权边界时单独 seed 一个 worker。
  const tokenHash = await sha256Hex(token);
  await env.DB.prepare(
    "INSERT INTO agents (id, kind, areas, token_hash, active, created_at) VALUES (?, ?, ?, ?, 1, ?)"
  )
    .bind(id, kind, null, tokenHash, new Date().toISOString())
    .run();
}

function req(path: string, token: string, body: unknown): Request {
  return new Request(`http://coord-service.local${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

describe("POST /events (narrative events — ADR-009 GitHub 协调面退役后的站会/andon 信道)", () => {
  beforeEach(async () => {
    await seedAgent("coord-events-test", "events-token");
  });

  it("no bearer token → 401", async () => {
    const res = await SELF.fetch(
      new Request("http://coord-service.local/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "andon", resource_id: "andon:main" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("cycle-plan 写入成功并可在 /status 的 recent_events 里看到", async () => {
    const res = await SELF.fetch(
      req("/events", "events-token", {
        type: "cycle-plan",
        resource_id: "cycle:2026-07-08T12:00Z",
        payload: { commit: ["ship X"], carry: [], blocked: [] },
      })
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { event: { type: string; agent_id: string; resource_id: string } };
    expect(body.event.type).toBe("cycle-plan");
    expect(body.event.agent_id).toBe("coord-events-test"); // 身份取自 token，不是 body
    expect(body.event.resource_id).toBe("cycle:2026-07-08T12:00Z");

    const status = await (await SELF.fetch("http://coord-service.local/status")).json() as {
      recent_events: Array<{ type: string; resource_id: string }>;
    };
    expect(status.recent_events.some((e) => e.type === "cycle-plan" && e.resource_id === "cycle:2026-07-08T12:00Z")).toBe(true);
  });

  it("andon stop 信号写入成功，payload 原样保留", async () => {
    const res = await SELF.fetch(
      req("/events", "events-token", {
        type: "andon",
        resource_id: "andon:main",
        payload: { signal: "stop", reason: "main typecheck red" },
      })
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { event: { type: string; payload: string | null } };
    expect(body.event.type).toBe("andon");
    expect(JSON.parse(body.event.payload as string)).toEqual({ signal: "stop", reason: "main typecheck red" });
  });

  it("claim 生命周期类型（如 claim）不接受手写 → 400，防止伪造审计历史", async () => {
    const res = await SELF.fetch(
      req("/events", "events-token", { type: "claim", resource_id: "role:coord-main" })
    );
    expect(res.status).toBe(400);
  });

  it("缺 resource_id → 400", async () => {
    const res = await SELF.fetch(req("/events", "events-token", { type: "cycle-result" }));
    expect(res.status).toBe(400);
  });

  it("worker 身份写 andon → 403（停线信号是 coordinator 层专属，防伪造拉停 fleet）", async () => {
    await seedAgent("plain-worker", "worker-token", "worker");
    const res = await SELF.fetch(
      req("/events", "worker-token", { type: "andon", resource_id: "andon:main", payload: { signal: "stop" } })
    );
    expect(res.status).toBe(403);
  });

  it("worker 身份写 cycle-plan → 201（叙述站会不限 coordinator）", async () => {
    await seedAgent("plain-worker-2", "worker-token-2", "worker");
    const res = await SELF.fetch(
      req("/events", "worker-token-2", { type: "cycle-plan", resource_id: "cycle:x", payload: {} })
    );
    expect(res.status).toBe(201);
  });
});
