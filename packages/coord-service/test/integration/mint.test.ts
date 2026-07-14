// mint.test.ts — 自助 token 领取/轮换（ADR-011 P2）的授权边界与轮换语义。
import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { sha256Hex } from "../../src/lib/crypto";

async function seedAgent(id: string, token: string, kind: string): Promise<void> {
  const tokenHash = await sha256Hex(token);
  await env.DB.prepare(
    "INSERT INTO agents (id, kind, areas, token_hash, active, created_at) VALUES (?, ?, ?, ?, 1, ?)"
  )
    .bind(id, kind, null, tokenHash, new Date().toISOString())
    .run();
}

function mint(id: string, token: string, requestedBy = "usamshen"): Request {
  return new Request(`http://coord-service.local/agents/${id}/mint-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ requested_by: requestedBy }),
  });
}

describe("POST /agents/:id/mint-token（ADR-011 P2 自助领取）", () => {
  beforeEach(async () => {
    await seedAgent("portal-broker", "broker-token", "token-broker");
    await seedAgent("wrk-dev-1", "old-worker-token", "worker");
    await seedAgent("coord-x", "coord-token", "coordinator");
    await seedAgent("coord-mod-x", "modcoord-token", "module-coordinator");
    await seedAgent("coord-arch-x", "archcoord-token", "architecture-coordinator");
  });

  it("非 broker 一律 403（worker 不能给自己 mint，coordinator 也不行——入口唯一）", async () => {
    expect((await SELF.fetch(mint("wrk-dev-1", "old-worker-token"))).status).toBe(403);
    expect((await SELF.fetch(mint("wrk-dev-1", "coord-token"))).status).toBe(403);
  });

  it("broker mint 成功：返回明文一次；旧 token 立即失效、新 token 立即可用", async () => {
    const res = await SELF.fetch(mint("wrk-dev-1", "broker-token"));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { agent_id: string; token: string };
    expect(body.agent_id).toBe("wrk-dev-1");
    expect(body.token.length).toBeGreaterThan(30);

    // 认证探针用 POST /events（requireAgent 真验身份；GET /claims 是公开只读不验 token）
    const probe = (token: string) =>
      SELF.fetch(
        new Request("http://coord-service.local/events", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ type: "cycle-plan", resource_id: "probe:mint-test" }),
        })
      );
    expect((await probe("old-worker-token")).status).toBe(401); // 旧 token 立即失效
    expect((await probe(body.token)).status).toBe(201);         // 新 token 立即可用
  });

  it("broker/全部协调层身份不可经自助通道轮换（共享设施钥匙走人类运维流程）", async () => {
    expect((await SELF.fetch(mint("coord-x", "broker-token"))).status).toBe(403);
    expect((await SELF.fetch(mint("portal-broker", "broker-token"))).status).toBe(403);
    // 安全审查 #629：module-/architecture-coordinator 同持 andon 停线权，同样不可自助 mint
    expect((await SELF.fetch(mint("coord-mod-x", "broker-token"))).status).toBe(403);
    expect((await SELF.fetch(mint("coord-arch-x", "broker-token"))).status).toBe(403);
  });

  it("未注册身份 404；缺 requested_by 400；mint 写 token-mint 审计事件", async () => {
    expect((await SELF.fetch(mint("ghost", "broker-token"))).status).toBe(404);
    const noBody = await SELF.fetch(
      new Request("http://coord-service.local/agents/wrk-dev-1/mint-token", {
        method: "POST",
        headers: { Authorization: "Bearer broker-token" },
      })
    );
    expect(noBody.status).toBe(400);

    await SELF.fetch(mint("wrk-dev-1", "broker-token", "someone"));
    const rows = await env.DB.prepare(
      "SELECT type, agent_id, payload FROM events WHERE resource_id = 'agent:wrk-dev-1'"
    ).all<{ type: string; agent_id: string; payload: string }>();
    const mints = (rows.results ?? []).filter((r) => r.type === "token-mint");
    expect(mints.length).toBeGreaterThan(0);
    expect(mints[0]!.agent_id).toBe("portal-broker");
    expect(JSON.parse(mints[0]!.payload).requested_by).toBe("someone");
  });
});
