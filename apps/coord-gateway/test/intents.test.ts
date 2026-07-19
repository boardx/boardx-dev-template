// p30/F09 意图消息面网关测试（真 workerd）：GET 聚合读（scoped/ops）、POST 分层鉴权——
// intent.decide 要求 COORD_ADMIN_TOKEN（scoped/ops 一律拒），其余五类走 scoped token +
// agent_id 强绑定（#721 同模式）。DO 层 payload 校验见 coord-repohub/coord-protocol 测试。
import { SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

const REPO = "boardx/boardx-dev-template";
const API = (sub: string) => `https://gw.test/api/coord/repos/${REPO}${sub}`;
const ADMIN = { authorization: "Bearer test-admin-token", "content-type": "application/json" };
const OPS = { authorization: "Bearer test-api-token", "content-type": "application/json" };

// 吸收 vitest-pool-workers singleWorker 跨文件 transform 造成的一次性 DO 失效（同 gateway.test.ts）
beforeAll(async () => {
  for (let i = 0; i < 2; i++) {
    const r = await SELF.fetch(API("/claims"), { headers: { authorization: "Bearer test-api-token" } }).catch(
      () => null,
    );
    if (r?.ok) break;
  }
});

async function mint(agentId: string): Promise<string> {
  const r = await SELF.fetch(API("/tokens/mint"), {
    method: "POST",
    headers: ADMIN,
    body: JSON.stringify({ agent_id: agentId, owner: "usam.shen@gmail.com" }),
  });
  expect(r.status).toBe(201);
  return (await r.json<{ token: string }>()).token;
}

describe("p30/F09 意图消息面（gateway 路由 + 鉴权分层）", () => {
  it("scoped token 可发 assign/accept/progress/blocker/escalate，agent_id 强绑定同其它端点", async () => {
    const token = await mint("wrk-intent-1");
    const bearer = { authorization: `Bearer ${token}`, "content-type": "application/json" };

    const ok = await SELF.fetch(API("/intents"), {
      method: "POST", headers: bearer,
      body: JSON.stringify({
        type: "intent.progress", resource_id: "issue:950", payload: { summary: "推进中" },
        // 缺省 agent_id → 注入 token 身份
      }),
    });
    expect(ok.status).toBe(201);
    const created = await ok.json<{ event: Record<string, unknown> }>();
    expect(created.event["agent_id"]).toBe("wrk-intent-1");

    // 冒充他人 agent_id → 403（与 claims/mcp 同一强绑定语义）
    const forged = await SELF.fetch(API("/intents"), {
      method: "POST", headers: bearer,
      body: JSON.stringify({
        type: "intent.progress", resource_id: "issue:950", agent_id: "someone-else",
        payload: { summary: "冒充" },
      }),
    });
    expect(forged.status).toBe(403);
    expect((await forged.json<Record<string, unknown>>())["error"]).toBe("token_agent_mismatch");
  });

  it("intent.decide 要求 COORD_ADMIN_TOKEN：scoped/ops token 一律 401/403（防伪造拍板）", async () => {
    const token = await mint("wrk-intent-2");
    const scoped = { authorization: `Bearer ${token}`, "content-type": "application/json" };
    const decideBody = JSON.stringify({
      type: "intent.decide", resource_id: "issue:951", agent_id: "usam",
      payload: { reason: "按方案 A 拍板通过", issue_ref: "#951", decision: "approved" },
    });

    const byScoped = await SELF.fetch(API("/intents"), { method: "POST", headers: scoped, body: decideBody });
    expect(byScoped.status).toBe(401); // requireAdmin：非 admin bearer 一律 401

    const byOps = await SELF.fetch(API("/intents"), { method: "POST", headers: OPS, body: decideBody });
    expect(byOps.status).toBe(401); // ops 万能钥匙也不是 admin token，同样拒

    const byAdmin = await SELF.fetch(API("/intents"), { method: "POST", headers: ADMIN, body: decideBody });
    expect(byAdmin.status).toBe(201);
    const created = await byAdmin.json<{ event: Record<string, unknown> }>();
    expect(created.event["type"]).toBe("intent.decide");
  });

  it("GET /intents?resource_id= 聚合读：scoped/ops 均可读；无 bearer 401", async () => {
    await SELF.fetch(API("/intents"), {
      method: "POST", headers: OPS,
      body: JSON.stringify({
        type: "intent.assign", resource_id: "issue:952", agent_id: "coord-main",
        payload: { target_agent_id: "wrk-intent-3", target_resource_id: "issue:952", note: null },
      }),
    });
    const r = await SELF.fetch(API("/intents?resource_id=issue:952"), { headers: OPS });
    expect(r.status).toBe(200);
    const body = await r.json<{ resource_id: string; thread_status: string; events: unknown[] }>();
    expect(body.resource_id).toBe("issue:952");
    expect(body.events).toHaveLength(1);

    expect((await SELF.fetch(API("/intents?resource_id=issue:952"))).status).toBe(401);
  });

  it("非法 payload 透传 422（DO 校验单一出口）", async () => {
    const r = await SELF.fetch(API("/intents"), {
      method: "POST", headers: OPS,
      body: JSON.stringify({ type: "intent.progress", resource_id: "issue:953", payload: { summary: "" } }),
    });
    expect(r.status).toBe(422);
  });
});
