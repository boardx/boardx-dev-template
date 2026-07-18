// 协议参考客户端单测：注入 mock fetch，覆盖 wire format 各分支 +
// 三态纪律（error 永不塌缩成 free/成功——ADR-006 判例，coord-service 死因之一）。
import { describe, expect, it } from "vitest";
import { PROTOCOL } from "../src/index";
import { createCoordClient, createCoordClientFromEnv } from "../src/client";
import type { Lease } from "../src/index";

const T = "2026-07-18T03:00:00Z";

function lease(overrides: Partial<Lease> = {}): Lease {
  return {
    protocol: PROTOCOL,
    lease_id: "lse_01JTEST",
    resource_id: "role:coord-main",
    resource_type: "coordinator-role",
    agent_id: "wrk-1",
    status: "in_progress",
    claimed_at: T,
    last_heartbeat_at: T,
    ttl_seconds: 21600,
    expires_at: "2026-07-18T09:00:00Z",
    ...overrides,
  };
}

interface Captured {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/** mock fetch：按序返回预置应答，并记录请求供断言。 */
function mockFetch(responses: Array<{ status: number; body?: unknown } | Error>) {
  const captured: Captured[] = [];
  let i = 0;
  const impl = (async (input: unknown, init?: RequestInit) => {
    const next = responses[i++];
    if (next === undefined) throw new Error("mock fetch：预置应答不够");
    captured.push({
      url: String(input),
      method: init?.method ?? "GET",
      headers: Object.fromEntries(
        Object.entries((init?.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]),
      ),
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    });
    if (next instanceof Error) throw next;
    return new Response(next.body === undefined ? "not json" : JSON.stringify(next.body), {
      status: next.status,
    });
  }) as typeof fetch;
  return { impl, captured };
}

function client(responses: Array<{ status: number; body?: unknown } | Error>, agentId?: string) {
  const { impl, captured } = mockFetch(responses);
  const c = createCoordClient({
    gatewayUrl: "https://gw.example/",
    token: "tok-secret",
    repo: "boardx/boardx-dev-template",
    agentId,
    fetchImpl: impl,
  });
  return { c, captured };
}

describe("createCoordClient / claim", () => {
  it("201 → acquired，请求打到 /api/coord/repos/:o/:r/claims 且带 bearer + protocol", async () => {
    const { c, captured } = client([{ status: 201, body: lease() }], "wrk-1");
    const out = await c.claim("role:coord-main", "coordinator-role", 21600);
    expect(out).toEqual({ kind: "acquired", lease: lease() });
    expect(captured[0]!.url).toBe("https://gw.example/api/coord/repos/boardx/boardx-dev-template/claims");
    expect(captured[0]!.method).toBe("POST");
    expect(captured[0]!.headers["authorization"]).toBe("Bearer tok-secret");
    expect(captured[0]!.body).toEqual({
      protocol: PROTOCOL,
      resource_id: "role:coord-main",
      resource_type: "coordinator-role",
      ttl_seconds: 21600,
      agent_id: "wrk-1",
    });
  });

  it("200 幂等（同 agent 重复 claim）→ already_yours", async () => {
    const { c } = client([{ status: 200, body: lease() }]);
    const out = await c.claim("role:coord-main", "coordinator-role");
    expect(out.kind).toBe("already_yours");
  });

  it("409 → conflict 且带 holder（撞车防护的用户可见形态）", async () => {
    const holder = {
      lease_id: "lse_01JOTHER",
      agent_id: "wrk-2",
      claimed_at: T,
      last_heartbeat_at: T,
      expires_at: "2026-07-18T09:00:00Z",
    };
    const { c } = client([{ status: 409, body: { protocol: PROTOCOL, error: "resource_claimed", holder } }]);
    const out = await c.claim("module:devportal", "module");
    expect(out).toEqual({ kind: "conflict", holder });
  });

  it("未配置 agentId（scoped token 路径）→ body 不带 agent_id，由网关注入在册身份", async () => {
    const { c, captured } = client([{ status: 201, body: lease() }]);
    await c.claim("module:devportal", "module");
    expect("agent_id" in (captured[0]!.body as Record<string, unknown>)).toBe(false);
  });

  it("5xx → {kind:'error'} 带 status，绝不塌缩成 conflict/acquired", async () => {
    const { c } = client([{ status: 503, body: { error: "boom" } }]);
    const out = await c.claim("role:coord-main", "coordinator-role");
    expect(out.kind).toBe("error");
    if (out.kind === "error") expect(out.status).toBe(503);
  });

  it("网络异常（fetch reject）→ {kind:'error'} 无 status，不抛出", async () => {
    const { c } = client([new Error("ECONNREFUSED")]);
    const out = await c.claim("role:coord-main", "coordinator-role");
    expect(out).toMatchObject({ kind: "error", message: "ECONNREFUSED" });
    expect((out as { status?: number }).status).toBeUndefined();
  });
});

describe("createCoordClient / heartbeat", () => {
  it("200 → ok + 刷新后的 lease", async () => {
    const fresh = lease({ last_heartbeat_at: "2026-07-18T04:00:00Z" });
    const { c, captured } = client([{ status: 200, body: fresh }], "wrk-1");
    const out = await c.heartbeat("lse_01JTEST");
    expect(out).toEqual({ kind: "ok", lease: fresh });
    expect(captured[0]!.url).toContain("/claims/lse_01JTEST/heartbeat");
    expect(captured[0]!.body).toEqual({ protocol: PROTOCOL, agent_id: "wrk-1" });
  });

  it("410（released/expired 租约）→ gone，防僵尸续命", async () => {
    const { c } = client([{ status: 410, body: { error: "lease_gone", status: "expired" } }]);
    const out = await c.heartbeat("lse_01JTEST");
    expect(out).toEqual({ kind: "gone", leaseStatus: "expired" });
  });

  it("403（非持有者）→ error 而非 gone/ok", async () => {
    const { c } = client([{ status: 403, body: { error: "not_lease_holder" } }]);
    const out = await c.heartbeat("lse_01JTEST");
    expect(out.kind).toBe("error");
    if (out.kind === "error") expect(out.status).toBe(403);
  });
});

describe("createCoordClient / release", () => {
  it("200 → ok；handoff_note 随 body 发送（类型层必填）", async () => {
    const released = lease({ status: "released", handoff_note: "F10 stage-1 已交，剩 stage-2 删除" });
    const { c, captured } = client([{ status: 200, body: released }], "wrk-1");
    const out = await c.release("lse_01JTEST", "F10 stage-1 已交，剩 stage-2 删除");
    expect(out).toEqual({ kind: "ok", lease: released });
    expect(captured[0]!.body).toEqual({
      protocol: PROTOCOL,
      agent_id: "wrk-1",
      handoff_note: "F10 stage-1 已交，剩 stage-2 删除",
    });
  });

  it("422（note 缺失/过短，服务端兜底）→ error 带 status 422", async () => {
    const { c } = client([{ status: 422, body: { error: "invalid_release_request", details: ["handoff_note 长度必须 ≥10"] } }]);
    const out = await c.release("lse_01JTEST", "太短");
    expect(out.kind).toBe("error");
    if (out.kind === "error") expect(out.status).toBe(422);
  });
});

describe("createCoordClient / queryActiveClaim 三态（ADR-006 判例）", () => {
  it("列表里有该 resource → held", async () => {
    const held = lease({ resource_id: "module:devportal", resource_type: "module" });
    const { c } = client([{ status: 200, body: { leases: [lease(), held] } }]);
    const out = await c.queryActiveClaim("module:devportal");
    expect(out).toEqual({ kind: "held", claim: held });
  });

  it("列表里没有该 resource → free", async () => {
    const { c } = client([{ status: 200, body: { leases: [lease()] } }]);
    const out = await c.queryActiveClaim("module:room");
    expect(out).toEqual({ kind: "free" });
  });

  it("非 200（401/5xx）→ error，绝不塌缩成 free——这是旧 fail-silent bug 的回归锚", async () => {
    for (const status of [401, 403, 429, 500]) {
      const { c } = client([{ status, body: { error: "x" } }]);
      const out = await c.queryActiveClaim("role:coord-main");
      expect(out.kind).toBe("error");
      if (out.kind === "error") expect(out.status).toBe(status);
    }
  });

  it("网络异常 → error，不抛出", async () => {
    const { c } = client([new Error("getaddrinfo ENOTFOUND")]);
    const out = await c.queryActiveClaim("role:coord-main");
    expect(out.kind).toBe("error");
  });

  it("200 但 body 不是 {leases:[...]} → error（格式异常不是 free）", async () => {
    const { c } = client([{ status: 200, body: { nope: true } }]);
    const out = await c.queryActiveClaim("role:coord-main");
    expect(out.kind).toBe("error");
  });
});

describe("createCoordClient / listActiveClaims", () => {
  it("200 → ok + leases", async () => {
    const { c } = client([{ status: 200, body: { leases: [lease()] } }]);
    const out = await c.listActiveClaims();
    expect(out).toEqual({ kind: "ok", leases: [lease()] });
  });

  it("5xx → error", async () => {
    const { c } = client([{ status: 500 }]);
    const out = await c.listActiveClaims();
    expect(out.kind).toBe("error");
  });
});

describe("createCoordClientFromEnv", () => {
  const KEYS = ["COORD_GATEWAY_URL", "COORD_API_TOKEN", "COORD_REPO", "COORD_AGENT_ID"] as const;

  function withEnv(env: Partial<Record<(typeof KEYS)[number], string>>, fn: () => void) {
    const saved = KEYS.map((k) => [k, process.env[k]] as const);
    for (const k of KEYS) delete process.env[k];
    Object.assign(process.env, env);
    try {
      fn();
    } finally {
      for (const [k, v] of saved) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  }

  it("三个必填 env 齐 → 返回客户端", () => {
    withEnv(
      { COORD_GATEWAY_URL: "https://gw.example", COORD_API_TOKEN: "t", COORD_REPO: "o/r" },
      () => expect(createCoordClientFromEnv()).not.toBeNull(),
    );
  });

  it("缺任一必填 env → null（单一降级开关）", () => {
    withEnv({ COORD_API_TOKEN: "t", COORD_REPO: "o/r" }, () => expect(createCoordClientFromEnv()).toBeNull());
    withEnv({ COORD_GATEWAY_URL: "https://gw.example", COORD_REPO: "o/r" }, () =>
      expect(createCoordClientFromEnv()).toBeNull(),
    );
    withEnv({ COORD_GATEWAY_URL: "https://gw.example", COORD_API_TOKEN: "t" }, () =>
      expect(createCoordClientFromEnv()).toBeNull(),
    );
  });
});
