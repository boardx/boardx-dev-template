// 目录面隔离矩阵（p30/F01，真 workerd）：
//   读面 GET  → ops token 200 / scoped token 200 / 无 token 401 / 假 token 401
//   写面 POST → admin token 放行 / ops token 401 / 无 token 401
//   allowlist 之外的子路径 404（不暴露 DO 内部面）
import { SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

const GW = "https://gw.test/api/coord";

type Obj = Record<string, unknown>;

// 同 gateway.test.ts：预热吸收 vitest-pool-workers singleWorker 的一次性 DO 失效
beforeAll(async () => {
  for (let i = 0; i < 2; i++) {
    const r = await SELF.fetch(`${GW}/directory/projects`, {
      headers: { authorization: "Bearer test-api-token" },
    }).catch(() => null);
    if (r?.ok) break;
  }
  // 也预热 scoped verify 路径（会打 RepoHub DO stub）——假 token 应稳定 401
  for (let i = 0; i < 2; i++) {
    const r = await SELF.fetch(`${GW}/directory/projects`, {
      headers: { authorization: "Bearer warmup-fake-token" },
    }).catch(() => null);
    if (r && r.status < 500) break;
  }
});

function call(method: string, path: string, token: string | null, body?: unknown): Promise<Response> {
  return SELF.fetch(`${GW}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "content-type": "application/json",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe("目录读面（scoped/ops 可达）", () => {
  it("ops token（COORD_API_TOKEN）GET projects/engineers/agents 全部 200，形状正确", async () => {
    for (const sub of ["projects", "engineers", "agents"]) {
      const r = await call("GET", `/directory/${sub}`, "test-api-token");
      expect(r.status, sub).toBe(200);
      const body = await r.json<Obj>();
      expect(Array.isArray(body[sub]), sub).toBe(true);
    }
  });

  it("无 token / 假 token → 401（fail-closed）", async () => {
    expect((await call("GET", "/directory/projects", null)).status).toBe(401);
    expect((await call("GET", "/directory/projects", "wrong-token")).status).toBe(401);
  });

  it("按仓 scoped token（RepoHub mint）可读目录", async () => {
    // 用 admin 面在已接入仓（PROJECTION_REPOS）mint 一个 scoped token
    const mint = await SELF.fetch(`${GW}/repos/boardx/boardx-dev-template/tokens/mint`, {
      method: "POST",
      headers: { authorization: "Bearer test-admin-token", "content-type": "application/json" },
      body: JSON.stringify({ agent_id: "wrk-dir-1", owner: "usam" }),
    });
    expect(mint.status).toBe(201);
    const { token } = await mint.json<{ token: string }>();
    const r = await call("GET", "/directory/agents", token);
    expect(r.status).toBe(200);
  });
});

describe("目录写面（仅 COORD_ADMIN_TOKEN）", () => {
  it("admin token 全链写通：engineer → project → membership 审批 → agent enroll → enrollment", async () => {
    const e = await call("POST", "/directory/engineers", "test-admin-token", { handle: "gw-eng", github_login: "gw-eng-gh" });
    expect(e.status).toBe(201);
    const p = await call("POST", "/directory/projects", "test-admin-token", { slug: "gw-proj" });
    expect(p.status).toBe(201);
    const m = await call("POST", "/directory/memberships", "test-admin-token", {
      project: "gw-proj", engineer: "@gw-eng", role: "owner",
    });
    expect(m.status).toBe(201);
    const mid = ((await m.json<Obj>())["membership"] as Obj)["membership_id"];
    const ap = await call("POST", `/directory/memberships/${mid}/transition`, "test-admin-token", { action: "approve" });
    expect(ap.status).toBe(200);
    const a = await call("POST", "/directory/agents", "test-admin-token", { owner: "gw-eng", name: "gw-worker" });
    expect(a.status).toBe(201);
    const agentId = ((await a.json<Obj>())["agent"] as Obj)["agent_id"];
    const en = await call("POST", "/directory/enrollments", "test-admin-token", {
      agent_id: agentId, project: "gw-proj",
    });
    expect(en.status).toBe(201);

    // 读面回读三答：项目归属 + owner + parent
    const rows = ((await (await call("GET", "/directory/agents", "test-api-token")).json<Obj>())["agents"]) as Obj[];
    const row = rows.find((x) => x["agent_id"] === agentId)!;
    expect((row["owner"] as Obj)["handle"]).toBe("gw-eng");
    expect(row["projects"]).toEqual(["gw-proj"]);
    expect(row["parent"]).toBeNull();
  });

  it("写路径对普通 ops token / scoped token / 无 token 一律 401", async () => {
    for (const token of ["test-api-token", null, "fake"]) {
      const r = await call("POST", "/directory/projects", token, { slug: "sneaky" });
      expect(r.status, String(token)).toBe(401);
    }
  });

  it("状态机违规经网关同样被拒（409 透传）", async () => {
    const m = await call("POST", "/directory/memberships", "test-admin-token", {
      project: "gw-proj", engineer: "gw-eng", role: "contributor",
    });
    expect(m.status).toBe(409); // 上个测试已建 membership：重复成员
  });
});

describe("agent 心跳自证（p30/F07：scoped token 自打心跳 + 真实 WS 转发）", () => {
  it("admin token 心跳仍放行（保留运维/dispatcher 直打通道）", async () => {
    const a = await call("POST", "/directory/agents", "test-admin-token", { owner: "gw-eng", name: "hb-admin" });
    const agentId = ((await a.json<Obj>())["agent"] as Obj)["agent_id"] as string;
    const r = await call("POST", `/directory/agents/${agentId}/heartbeat`, "test-admin-token", {});
    expect(r.status).toBe(200);
  });

  it("agent 自己的 scoped token 打心跳 → 200，且事件真实转发进本仓 RepoHub 事件流（非 mock 定时器）", async () => {
    const a = await call("POST", "/directory/agents", "test-admin-token", { owner: "gw-eng", name: "hb-self" });
    const agentId = ((await a.json<Obj>())["agent"] as Obj)["agent_id"] as string;

    const mint = await SELF.fetch(`${GW}/repos/boardx/boardx-dev-template/tokens/mint`, {
      method: "POST",
      headers: { authorization: "Bearer test-admin-token", "content-type": "application/json" },
      body: JSON.stringify({ agent_id: agentId, owner: "gw-eng" }),
    });
    const { token } = await mint.json<{ token: string }>();

    const hb = await call("POST", `/directory/agents/${agentId}/heartbeat`, token, {});
    expect(hb.status).toBe(200);

    const events = await SELF.fetch(`${GW}/repos/boardx/boardx-dev-template/events?limit=500`, {
      headers: { authorization: "Bearer test-api-token" },
    });
    const body = await events.json<Obj>();
    const hit = (body["events"] as Obj[]).find(
      (e) => e["type"] === "directory.agent.heartbeat" && (e["payload"] as Obj)["agent_id"] === agentId,
    );
    expect(hit, "心跳事件应转发进 RepoHub 事件流").toBeTruthy();
  });

  it("scoped token 冒充给别的 agent 打心跳 → 403（agent_id 强绑定，防越权点亮他人 fleet-row）", async () => {
    const a1 = await call("POST", "/directory/agents", "test-admin-token", { owner: "gw-eng", name: "hb-victim" });
    const a2 = await call("POST", "/directory/agents", "test-admin-token", { owner: "gw-eng", name: "hb-attacker" });
    const victimId = ((await a1.json<Obj>())["agent"] as Obj)["agent_id"] as string;
    const attackerId = ((await a2.json<Obj>())["agent"] as Obj)["agent_id"] as string;

    const mint = await SELF.fetch(`${GW}/repos/boardx/boardx-dev-template/tokens/mint`, {
      method: "POST",
      headers: { authorization: "Bearer test-admin-token", "content-type": "application/json" },
      body: JSON.stringify({ agent_id: attackerId, owner: "gw-eng" }),
    });
    const { token } = await mint.json<{ token: string }>();

    const r = await call("POST", `/directory/agents/${victimId}/heartbeat`, token, {});
    expect(r.status).toBe(403);
  });

  it("无 token / 假 token 打心跳 → 401", async () => {
    const a = await call("POST", "/directory/agents", "test-admin-token", { owner: "gw-eng", name: "hb-anon" });
    const agentId = ((await a.json<Obj>())["agent"] as Obj)["agent_id"] as string;
    expect((await call("POST", `/directory/agents/${agentId}/heartbeat`, null, {})).status).toBe(401);
    expect((await call("POST", `/directory/agents/${agentId}/heartbeat`, "fake", {})).status).toBe(401);
  });
});

describe("agent 生命周期写面（p30/F07：仅 COORD_ADMIN_TOKEN）", () => {
  it("admin token pause/resume 200；ops token / 无 token 401", async () => {
    const a = await call("POST", "/directory/agents", "test-admin-token", { owner: "gw-eng", name: "lc-gw" });
    const agentId = ((await a.json<Obj>())["agent"] as Obj)["agent_id"] as string;

    const pause = await call("POST", `/directory/agents/${agentId}/lifecycle`, "test-admin-token", { action: "pause" });
    expect(pause.status).toBe(200);
    expect(((await pause.json<Obj>())["agent"] as Obj)["lifecycle"]).toBe("paused");

    for (const token of ["test-api-token", null]) {
      const r = await call("POST", `/directory/agents/${agentId}/lifecycle`, token, { action: "resume" });
      expect(r.status, String(token)).toBe(401);
    }
  });
});

describe("目录面 allowlist", () => {
  it("未知子路径 / 内部端点样式路径 404", async () => {
    expect((await call("GET", "/directory/internal", "test-api-token")).status).toBe(404);
    expect((await call("POST", "/directory/agents/agt_X/steal", "test-admin-token", {})).status).toBe(404);
    expect((await call("DELETE", "/directory/projects", "test-admin-token")).status).toBe(404);
  });
});
