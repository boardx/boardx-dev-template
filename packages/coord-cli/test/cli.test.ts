// coord CLI 单测：fetch 注入 mock，不打真网、不碰真家目录。
// 重点覆盖：参数解析、resource_type 推断、409 撞车输出（持有者 + 新鲜度）、
// release 缺 note 的引导文案、config 缺失引导。
import { describe, expect, it } from "vitest";
import {
  main,
  parseArgs,
  inferResourceType,
  freshness,
  type Deps,
} from "../src/cli.js";

interface Call {
  url: string;
  method: string;
  body?: unknown;
}

function makeDeps(opts: {
  responses?: Array<{ status: number; body: unknown }>;
  config?: string | null;
  env?: Record<string, string>;
}): { deps: Deps; out: string[]; err: string[]; calls: Call[]; written: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  const calls: Call[] = [];
  const written: string[] = [];
  const responses = [...(opts.responses ?? [])];
  const deps: Deps = {
    fetchImpl: (async (url: unknown, init?: RequestInit) => {
      calls.push({
        url: String(url),
        method: init?.method ?? "GET",
        body: init?.body ? JSON.parse(init.body as string) : undefined,
      });
      const r = responses.shift() ?? { status: 200, body: {} };
      return new Response(JSON.stringify(r.body), { status: r.status });
    }) as typeof fetch,
    env: opts.env ?? {},
    stdout: (l) => out.push(l),
    stderr: (l) => err.push(l),
    configPath: "/fake/.coord/config.json",
    readConfigFile: () => opts.config ?? null,
    writeConfigFile: (c) => written.push(c),
    now: () => Date.parse("2026-07-18T10:00:00Z"),
  };
  return { deps, out, err, calls, written };
}

const CONFIG = JSON.stringify({
  gateway_url: "https://gw.example",
  repo: "boardx/boardx-dev-template",
  token: "tkn-1",
});

describe("parseArgs / inferResourceType / freshness", () => {
  it("解析位置参数与 --flag 值", () => {
    expect(parseArgs(["issue:1", "--agent", "wrk-1", "--ttl", "3600"])).toEqual({
      positional: ["issue:1"],
      flags: { agent: "wrk-1", ttl: "3600" },
    });
  });
  it("resource_id 前缀 → resource_type（role → coordinator-role）", () => {
    expect(inferResourceType("issue:698")).toBe("issue");
    expect(inferResourceType("feature:p29/F07")).toBe("feature");
    expect(inferResourceType("role:coord-main")).toBe("coordinator-role");
    expect(inferResourceType("banana")).toBeNull();
  });
  it("freshness 说人话", () => {
    const now = Date.parse("2026-07-18T10:00:00Z");
    expect(freshness(now, "2026-07-18T09:59:30Z")).toBe("30 秒前");
    expect(freshness(now, "2026-07-18T09:45:00Z")).toBe("15 分钟前");
    expect(freshness(now, "2026-07-18T04:00:00Z")).toBe("6.0 小时前");
  });
});

describe("connect", () => {
  it("token 从 env 读，healthz 通过后写配置", async () => {
    const { deps, out, calls, written } = makeDeps({
      env: { COORD_API_TOKEN: "tkn-env" },
      responses: [{ status: 200, body: { ok: true } }],
    });
    const code = await main(["connect", "https://gw.example", "boardx/boardx-dev-template"], deps);
    expect(code).toBe(0);
    expect(calls[0]!.url).toBe("https://gw.example/api/coord/healthz");
    expect(JSON.parse(written[0]!)).toEqual({
      gateway_url: "https://gw.example",
      repo: "boardx/boardx-dev-template",
      token: "tkn-env",
    });
    expect(out.join("\n")).toContain("已接入");
  });

  it("缺 COORD_API_TOKEN → 报错且不写配置", async () => {
    const { deps, err, written } = makeDeps({ env: {} });
    expect(await main(["connect", "https://gw.example", "o/r"], deps)).toBe(1);
    expect(err.join("\n")).toContain("COORD_API_TOKEN");
    expect(written).toHaveLength(0);
  });
});

describe("claim", () => {
  it("201：打 claims 端点（带推断的 resource_type + bearer），打印 lease", async () => {
    const { deps, out, calls } = makeDeps({
      config: CONFIG,
      responses: [{
        status: 201,
        body: { lease_id: "lse_1", expires_at: "2026-07-18T16:00:00Z" },
      }],
    });
    expect(await main(["claim", "issue:698", "--agent", "wrk-1", "--ttl", "3600"], deps)).toBe(0);
    expect(calls[0]!.url).toBe("https://gw.example/api/coord/repos/boardx/boardx-dev-template/claims");
    expect(calls[0]!.body).toMatchObject({
      protocol: "coord/0.1",
      resource_id: "issue:698",
      resource_type: "issue",
      agent_id: "wrk-1",
      ttl_seconds: 3600,
    });
    expect(out.join("\n")).toContain("lse_1");
  });

  it("409 撞车：打印持有者、心跳新鲜度、过期时间（撞车防护 UX 核心断言）", async () => {
    const { deps, err } = makeDeps({
      config: CONFIG,
      responses: [{
        status: 409,
        body: {
          error: "resource_claimed",
          holder: {
            lease_id: "lse_9", agent_id: "wrk-other",
            claimed_at: "2026-07-18T09:00:00Z",
            last_heartbeat_at: "2026-07-18T09:45:00Z",
            expires_at: "2026-07-18T15:00:00Z",
          },
        },
      }],
    });
    expect(await main(["claim", "issue:698", "--agent", "wrk-1"], deps)).toBe(1);
    const text = err.join("\n");
    expect(text).toContain("wrk-other");
    expect(text).toContain("15 分钟前"); // 新鲜度说人话
    expect(text).toContain("2026-07-18T15:00:00Z");
    expect(text).toContain("别硬抢");
  });

  it("非法前缀本地拦截，不打网", async () => {
    const { deps, err, calls } = makeDeps({ config: CONFIG });
    expect(await main(["claim", "banana", "--agent", "wrk-1"], deps)).toBe(1);
    expect(calls).toHaveLength(0);
    expect(err.join("\n")).toContain("前缀");
  });
});

describe("status", () => {
  it("汇总活跃租约 + ready work（排除已被认领的 issue）", async () => {
    const { deps, out } = makeDeps({
      config: CONFIG,
      responses: [
        {
          status: 200,
          body: { leases: [{ resource_id: "issue:810", agent_id: "wrk-a", last_heartbeat_at: "2026-07-18T09:59:00Z", expires_at: "2026-07-18T15:00:00Z" }] },
        },
        {
          status: 200,
          body: { items: [
            { number: 810, title: "被认领的", state: "open", labels: ["status:ready-for-dev"] },
            { number: 811, title: "可认领的", state: "open", labels: ["status:ready-for-dev"] },
            { number: 812, title: "无标签的", state: "open", labels: [] },
          ] },
        },
      ],
    });
    expect(await main(["status"], deps)).toBe(0);
    const text = out.join("\n");
    expect(text).toContain("issue:810  ← wrk-a");
    expect(text).toContain("issue:811");
    expect(text).not.toContain("无标签的");
    expect(text).toContain("共 1"); // 810 被排除后只剩 811
  });
});

describe("release / events", () => {
  it("release 422：打印引导文案（没有交接就不能放手）", async () => {
    const { deps, err } = makeDeps({
      config: CONFIG,
      responses: [{ status: 422, body: { details: ["handoff_note 长度必须 ≥10"] } }],
    });
    expect(await main(["release", "lse_1", "--agent", "wrk-1", "--note", "done"], deps)).toBe(1);
    expect(err.join("\n")).toContain("没有交接就不能放手");
  });

  it("release 缺 --note 本地拦截", async () => {
    const { deps, calls } = makeDeps({ config: CONFIG });
    expect(await main(["release", "lse_1", "--agent", "wrk-1"], deps)).toBe(1);
    expect(calls).toHaveLength(0);
  });

  it("events --since 透传且打印续传提示", async () => {
    const { deps, out, calls } = makeDeps({
      config: CONFIG,
      responses: [{
        status: 200,
        body: { events: [
          { event_id: "evt_2", type: "lease.claimed", resource_id: "issue:1", agent_id: "a", at: "2026-07-18T09:00:00Z", payload: {} },
        ] },
      }],
    });
    expect(await main(["events", "--since", "evt_1"], deps)).toBe(0);
    expect(calls[0]!.url).toContain("since=evt_1");
    expect(out.join("\n")).toContain("--since evt_2");
  });
});

describe("公共失败路径", () => {
  it("未 connect 直接 claim → 引导先 connect", async () => {
    const { deps, err } = makeDeps({ config: null });
    expect(await main(["claim", "issue:1", "--agent", "a"], deps)).toBe(1);
    expect(err.join("\n")).toContain("coord connect");
  });

  it("无命令打 usage 退出 1；未知命令退出 1", async () => {
    const a = makeDeps({});
    expect(await main([], a.deps)).toBe(1);
    expect(a.out.join("\n")).toContain("coord connect");
    const b = makeDeps({ config: CONFIG });
    expect(await main(["dance"], b.deps)).toBe(1);
  });
});
