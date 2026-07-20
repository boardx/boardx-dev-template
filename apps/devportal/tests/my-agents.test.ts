// p30/F07 单测：/api/portal/my-agents* 编排层——真实 API 编排逻辑（非纯静态 mock）。
// 策略：mock 两处外部依赖（lib/session 的登录态 + 全局 fetch 代表 coord-gateway），
// 断言本层的编排/鉴权/映射逻辑；gateway 自身的鉴权矩阵已在 coord-gateway 包测试覆盖。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV = {
  COORD_GATEWAY_URL: "https://gw.test",
  COORD_API_TOKEN: "api-token",
  COORD_GATEWAY_ADMIN_TOKEN: "admin-token",
  GITHUB_REPO: "boardx/boardx-dev-template",
};

vi.mock("@/lib/session", () => ({
  getSessionUser: vi.fn(),
}));

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  for (const [k, v] of Object.entries(ENV)) process.env[k] = v;
});

afterEach(() => {
  for (const k of Object.keys(ENV)) delete process.env[k];
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("GET /api/portal/my-agents", () => {
  it("未登录 → 401", async () => {
    const { getSessionUser } = await import("@/lib/session");
    vi.mocked(getSessionUser).mockResolvedValue(null);
    const { GET } = await import("../app/api/portal/my-agents/route");
    const res = await GET(new Request("https://x/api/portal/my-agents"));
    expect(res.status).toBe(401);
  });

  it("gateway 未配置 → configured:false（诚实降级，非 500）", async () => {
    delete process.env["COORD_API_TOKEN"];
    const { getSessionUser } = await import("@/lib/session");
    vi.mocked(getSessionUser).mockResolvedValue({ login: "usamshen", email: null, name: null, avatarUrl: null, via: "oauth" });
    const { GET } = await import("../app/api/portal/my-agents/route");
    const res = await GET(new Request("https://x/api/portal/my-agents"));
    const body = (await res.json()) as { configured: boolean };
    expect(body.configured).toBe(false);
  });

  it("按 owner.handle 过滤 + 交叉 token 健康态（active token→健康，全部吊销→已吊销，未 mint→未发放）", async () => {
    const { getSessionUser } = await import("@/lib/session");
    vi.mocked(getSessionUser).mockResolvedValue({ login: "usamshen", email: null, name: null, avatarUrl: null, via: "oauth" });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/directory/agents")) {
          return jsonRes(200, {
            agents: [
              { agent_id: "agt_1", name: "healthy", identifier: "@usamshen/healthy", owner: { engineer_id: "e1", handle: "usamshen", github_login: "usamshen" }, parent: null, projects: [], capabilities: ["Claude Code"], lifecycle: "active", last_heartbeat_at: new Date().toISOString(), created_at: "x", updated_at: "x" },
              { agent_id: "agt_2", name: "revoked", identifier: "@usamshen/revoked", owner: { engineer_id: "e1", handle: "usamshen", github_login: "usamshen" }, parent: null, projects: [], capabilities: ["Codex"], lifecycle: "active", last_heartbeat_at: null, created_at: "x", updated_at: "x" },
              { agent_id: "agt_3", name: "not-mine", identifier: "@other/not-mine", owner: { engineer_id: "e2", handle: "other", github_login: "other" }, parent: null, projects: [], capabilities: [], lifecycle: "active", last_heartbeat_at: null, created_at: "x", updated_at: "x" },
            ],
          });
        }
        if (url.includes("/tokens")) {
          return jsonRes(200, {
            tokens: [
              { token_hash_prefix: "aaaaaaaa", agent_id: "agt_1", owner: "usamshen", created_at: "x", revoked_at: null },
              { token_hash_prefix: "bbbbbbbb", agent_id: "agt_2", owner: "usamshen", created_at: "x", revoked_at: "y" },
            ],
          });
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );

    const { GET } = await import("../app/api/portal/my-agents/route");
    const res = await GET(new Request("https://x/api/portal/my-agents"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { fleet: Array<{ agentId: string; tokenStatus: string; heartbeat: string }> };
    expect(body.fleet).toHaveLength(2); // agt_3 过滤掉（不属于 usamshen）
    const healthy = body.fleet.find((a) => a.agentId === "agt_1")!;
    expect(healthy.tokenStatus).toBe("健康");
    expect(healthy.heartbeat).toBe("fresh");
    const revoked = body.fleet.find((a) => a.agentId === "agt_2")!;
    expect(revoked.tokenStatus).toBe("已吊销");
    expect(revoked.heartbeat).toBe("none");
  });
});

describe("POST /api/portal/my-agents/enroll", () => {
  it("未登录 401；非法名字 422", async () => {
    const { getSessionUser } = await import("@/lib/session");
    vi.mocked(getSessionUser).mockResolvedValue(null);
    const { POST } = await import("../app/api/portal/my-agents/enroll/route");
    const res = await POST(new Request("https://x", { method: "POST", body: JSON.stringify({ name: "x" }) }));
    expect(res.status).toBe(401);

    vi.mocked(getSessionUser).mockResolvedValue({ login: "usamshen", email: null, name: null, avatarUrl: null, via: "oauth" });
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes(200, {})));
    const res2 = await POST(new Request("https://x", { method: "POST", body: JSON.stringify({ name: "A" }) }));
    expect(res2.status).toBe(422);
  });

  it("命名空间冲突：Directory 409 → err-ns-dup（服务端唯一索引是判定权威）", async () => {
    const { getSessionUser } = await import("@/lib/session");
    vi.mocked(getSessionUser).mockResolvedValue({ login: "usamshen", email: null, name: null, avatarUrl: null, via: "oauth" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/directory/engineers")) return jsonRes(200, { engineer: {} });
        if (url.includes("/directory/agents")) return jsonRes(409, { error: "agent_name_taken" });
        throw new Error(`unexpected: ${url}`);
      }),
    );
    const { POST } = await import("../app/api/portal/my-agents/enroll/route");
    const res = await POST(new Request("https://x", { method: "POST", body: JSON.stringify({ name: "taken", runtime: "Claude Code" }) }));
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe("err-ns-dup");
  });

  it("成功路径：登记 + mint-on-reveal，返回一次性明文 token", async () => {
    const { getSessionUser } = await import("@/lib/session");
    vi.mocked(getSessionUser).mockResolvedValue({ login: "usamshen", email: null, name: "Usam", avatarUrl: null, via: "oauth" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes("/directory/engineers")) return jsonRes(200, { engineer: {} });
        if (url.includes("/directory/agents")) {
          return jsonRes(201, { agent: { agent_id: "agt_new", identifier: "@usamshen/my-implementer" } });
        }
        if (url.includes("/tokens/mint")) {
          const body = JSON.parse(init?.body as string) as { agent_id: string; owner: string };
          expect(body.agent_id).toBe("agt_new");
          expect(body.owner).toBe("usamshen");
          return jsonRes(201, { token: "coordtk_deadbeef" });
        }
        throw new Error(`unexpected: ${url}`);
      }),
    );
    const { POST } = await import("../app/api/portal/my-agents/enroll/route");
    const res = await POST(new Request("https://x", { method: "POST", body: JSON.stringify({ name: "my-implementer", runtime: "Claude Code" }) }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; agentId: string; identifier: string };
    expect(body.token).toBe("coordtk_deadbeef");
    expect(body.agentId).toBe("agt_new");
    expect(body.identifier).toBe("@usamshen/my-implementer");
  });
});

describe("POST /api/portal/my-agents/:id/rotate", () => {
  it("非本人 agent → 403（防越权吊销他人 token）", async () => {
    const { getSessionUser } = await import("@/lib/session");
    vi.mocked(getSessionUser).mockResolvedValue({ login: "attacker", email: null, name: null, avatarUrl: null, via: "oauth" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/directory/agents/agt_victim"))
          return jsonRes(200, { agent: { agent_id: "agt_victim", owner: { engineer_id: "e1", handle: "victim", github_login: "victim" } } });
        throw new Error(`unexpected: ${url}`);
      }),
    );
    const { POST } = await import("../app/api/portal/my-agents/[agentId]/rotate/route");
    const res = await POST(new Request("https://x", { method: "POST" }), { params: { agentId: "agt_victim" } });
    expect(res.status).toBe(403);
  });

  // 身份混淆回归（p30/F06 #798 同款漏洞类）：诱饵场景——登录者的 login 恰好等于
  // 目标 agent owner 的 handle（展示用自然键），但 github_login（认证锚点）是完全
  // 不同的人。若判定退回按 handle 比较，这里会被误判成"是我自己的 agent"，
  // 拿到 200 并成功轮换/吊销受害者的 token——这正是写路径权限提升。
  it("身份混淆回归：login 恰好等于受害者 agent 的 handle（诱饵）→ 仍然 403，不能按 handle 顶替", async () => {
    const { getSessionUser } = await import("@/lib/session");
    // 攻击者的真实 GitHub 身份是 attacker-real；victim agent 的 owner.handle 恰好是 "attacker-real"
    // （两者字符串相同），但 owner.github_login 是完全不同的 victim-real。
    vi.mocked(getSessionUser).mockResolvedValue({ login: "attacker-real", email: null, name: null, avatarUrl: null, via: "oauth" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/directory/agents/agt_victim2"))
          return jsonRes(200, {
            agent: { agent_id: "agt_victim2", owner: { engineer_id: "e9", handle: "attacker-real", github_login: "victim-real" } },
          });
        throw new Error(`unexpected: ${url}`);
      }),
    );
    const { POST } = await import("../app/api/portal/my-agents/[agentId]/rotate/route");
    const res = await POST(new Request("https://x", { method: "POST" }), { params: { agentId: "agt_victim2" } });
    expect(res.status).toBe(403);
  });

  it("成功：吊销全部在役 token 后 mint 新的", async () => {
    const { getSessionUser } = await import("@/lib/session");
    vi.mocked(getSessionUser).mockResolvedValue({ login: "usamshen", email: null, name: null, avatarUrl: null, via: "oauth" });
    const revoked: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes("/directory/agents/agt_1"))
          return jsonRes(200, { agent: { agent_id: "agt_1", owner: { engineer_id: "e1", handle: "usamshen", github_login: "usamshen" } } });
        if (url.endsWith("/tokens") && (!init || init.method === undefined || init.method === "GET")) {
          return jsonRes(200, {
            tokens: [
              { token_hash_prefix: "aaaaaaaa", agent_id: "agt_1", owner: "usamshen", created_at: "x", revoked_at: null },
              { token_hash_prefix: "cccccccc", agent_id: "agt_1", owner: "usamshen", created_at: "x", revoked_at: "already" },
            ],
          });
        }
        if (url.includes("/tokens/revoke")) {
          revoked.push(JSON.parse(init?.body as string)["token_hash_prefix"]);
          return jsonRes(200, { ok: true });
        }
        if (url.includes("/tokens/mint")) return jsonRes(201, { token: "coordtk_newone" });
        throw new Error(`unexpected: ${url}`);
      }),
    );
    const { POST } = await import("../app/api/portal/my-agents/[agentId]/rotate/route");
    const res = await POST(new Request("https://x", { method: "POST" }), { params: { agentId: "agt_1" } });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { token: string }).token).toBe("coordtk_newone");
    expect(revoked).toEqual(["aaaaaaaa"]); // 只吊销在役的那枚，已吊销的不重复调用
  });
});

describe("POST /api/portal/my-agents/:id/retire", () => {
  it("成功：吊销 token + Directory 生命周期置 retired", async () => {
    const { getSessionUser } = await import("@/lib/session");
    vi.mocked(getSessionUser).mockResolvedValue({ login: "usamshen", email: null, name: null, avatarUrl: null, via: "oauth" });
    let lifecycleAction: string | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes("/lifecycle")) {
          lifecycleAction = (JSON.parse(init?.body as string) as { action: string }).action;
          return jsonRes(200, { agent: { lifecycle: "retired" } });
        }
        if (url.includes("/directory/agents/agt_1"))
          return jsonRes(200, { agent: { agent_id: "agt_1", owner: { engineer_id: "e1", handle: "usamshen", github_login: "usamshen" } } });
        if (url.endsWith("/tokens")) return jsonRes(200, { tokens: [{ token_hash_prefix: "aaaaaaaa", agent_id: "agt_1", owner: "usamshen", created_at: "x", revoked_at: null }] });
        if (url.includes("/tokens/revoke")) return jsonRes(200, { ok: true });
        throw new Error(`unexpected: ${url}`);
      }),
    );
    const { POST } = await import("../app/api/portal/my-agents/[agentId]/retire/route");
    const res = await POST(new Request("https://x", { method: "POST" }), { params: { agentId: "agt_1" } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; revokedTokens: number };
    expect(body.ok).toBe(true);
    expect(body.revokedTokens).toBe(1);
    expect(lifecycleAction).toBe("retire");
  });
});

describe("POST /api/portal/my-agents/:id/lifecycle", () => {
  it("非法 action → 422", async () => {
    const { getSessionUser } = await import("@/lib/session");
    vi.mocked(getSessionUser).mockResolvedValue({ login: "usamshen", email: null, name: null, avatarUrl: null, via: "oauth" });
    const { POST } = await import("../app/api/portal/my-agents/[agentId]/lifecycle/route");
    const res = await POST(new Request("https://x", { method: "POST", body: JSON.stringify({ action: "retire" }) }), { params: { agentId: "agt_1" } });
    expect(res.status).toBe(422); // retire 走独立端点，这里只认 pause/resume
  });

  it("pause 成功：转发 action 并回传新 lifecycle", async () => {
    const { getSessionUser } = await import("@/lib/session");
    vi.mocked(getSessionUser).mockResolvedValue({ login: "usamshen", email: null, name: null, avatarUrl: null, via: "oauth" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/lifecycle")) return jsonRes(200, { agent: { lifecycle: "paused" } });
        if (url.includes("/directory/agents/agt_1"))
          return jsonRes(200, { agent: { agent_id: "agt_1", owner: { engineer_id: "e1", handle: "usamshen", github_login: "usamshen" } } });
        throw new Error(`unexpected: ${url}`);
      }),
    );
    const { POST } = await import("../app/api/portal/my-agents/[agentId]/lifecycle/route");
    const res = await POST(new Request("https://x", { method: "POST", body: JSON.stringify({ action: "pause" }) }), { params: { agentId: "agt_1" } });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { lifecycle: string }).lifecycle).toBe("paused");
  });
});
