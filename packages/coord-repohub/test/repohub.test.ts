// RepoHub DO 测试：真 workerd（vitest-pool-workers）。
// 覆盖 F05（原子租约/心跳/释放/过期回收）与 F04（镜像 upsert + realtime 读）。
import { SELF, env, runInDurableObject, runDurableObjectAlarm } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { PROTOCOL } from "@repo/coord-protocol";

const BASE = "https://repohub.test/repos/boardx/boardx-dev-template";

function claimBody(agent: string, resource = "issue:698", ttl = 3600) {
  return {
    protocol: PROTOCOL,
    resource_id: resource,
    resource_type: "issue",
    agent_id: agent,
    ttl_seconds: ttl,
  };
}

async function post(path: string, body: unknown): Promise<Response> {
  return SELF.fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("F05 原子租约", () => {
  it("并发 20 个 claim 同一资源：恰好 1×201，其余 19×409（撞车防护核心断言）", async () => {
    const rs = await Promise.all(
      Array.from({ length: 20 }, (_, i) => post("/claims", claimBody(`agent-${i}`, "issue:100"))),
    );
    const codes = rs.map((r) => r.status);
    expect(codes.filter((c) => c === 201)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(19);
    const conflict = await rs.find((r) => r.status === 409)!.json<Record<string, unknown>>();
    expect(conflict["error"]).toBe("resource_claimed");
    expect((conflict["holder"] as Record<string, unknown>)["agent_id"]).toMatch(/^agent-/);
  });

  it("同 agent 重复 claim 幂等返回 200 + 同一 lease", async () => {
    const a = await post("/claims", claimBody("wrk-1", "issue:101"));
    expect(a.status).toBe(201);
    const first = await a.json<Record<string, unknown>>();
    const b = await post("/claims", claimBody("wrk-1", "issue:101"));
    expect(b.status).toBe(200);
    expect((await b.json<Record<string, unknown>>())["lease_id"]).toBe(first["lease_id"]);
  });

  it("非法请求 422：坏 resource_id / 超限 ttl", async () => {
    expect((await post("/claims", { ...claimBody("a"), resource_id: "banana" })).status).toBe(422);
    expect((await post("/claims", { ...claimBody("a"), ttl_seconds: 999999 })).status).toBe(422);
  });

  it("heartbeat 只允许持有者，且推进 expires_at", async () => {
    const lease = await (await post("/claims", claimBody("wrk-2", "issue:102"))).json<Record<string, unknown>>();
    const id = lease["lease_id"] as string;
    const stranger = await post(`/claims/${id}/heartbeat`, { protocol: PROTOCOL, agent_id: "evil" });
    expect(stranger.status).toBe(403);
    const ok = await post(`/claims/${id}/heartbeat`, { protocol: PROTOCOL, agent_id: "wrk-2" });
    expect(ok.status).toBe(200);
    const refreshed = await ok.json<Record<string, unknown>>();
    expect(Date.parse(refreshed["expires_at"] as string)).toBeGreaterThanOrEqual(
      Date.parse(lease["expires_at"] as string),
    );
  });

  it("release 强制 handoff note（≥10 字符），成功后资源可再认领，僵尸心跳 410", async () => {
    const lease = await (await post("/claims", claimBody("wrk-3", "issue:103"))).json<Record<string, unknown>>();
    const id = lease["lease_id"] as string;
    const noNote = await post(`/claims/${id}/release`, { protocol: PROTOCOL, agent_id: "wrk-3" });
    expect(noNote.status).toBe(422);
    const short = await post(`/claims/${id}/release`, { protocol: PROTOCOL, agent_id: "wrk-3", handoff_note: "done" });
    expect(short.status).toBe(422);
    const ok = await post(`/claims/${id}/release`, {
      protocol: PROTOCOL,
      agent_id: "wrk-3",
      handoff_note: "issue:103 已完成一半，剩余步骤见 PR #999 描述。",
    });
    expect(ok.status).toBe(200);
    // 资源回到可认领
    expect((await post("/claims", claimBody("wrk-4", "issue:103"))).status).toBe(201);
    // 已终态租约不能续命
    const zombie = await post(`/claims/${id}/heartbeat`, { protocol: PROTOCOL, agent_id: "wrk-3" });
    expect(zombie.status).toBe(410);
  });

  it("TTL 过期由 alarm 机械回收：状态 expired + 服务端 handoff note + lease.expired 事件 + 可再认领", async () => {
    const lease = await (await post("/claims", claimBody("wrk-5", "issue:104"))).json<Record<string, unknown>>();
    const id = env.REPOHUB.idFromName("boardx/boardx-dev-template");
    const stub = env.REPOHUB.get(id);
    // 把 expires_at 拨回过去，模拟 TTL 到期（协议下限 60s，测试不真等）
    // 只回拨 expires_at；claim 时已排好的 alarm 由 runDurableObjectAlarm 立即执行
    await runInDurableObject(stub, async (_instance: unknown, state: DurableObjectState) => {
      state.storage.sql.exec(
        `UPDATE leases SET expires_at='2000-01-01T00:00:00Z' WHERE lease_id=?`,
        lease["lease_id"],
      );
    });
    const ran = await runDurableObjectAlarm(stub);
    expect(ran).toBe(true);

    const active = await (await SELF.fetch(`${BASE}/claims`)).json<{ leases: Array<Record<string, unknown>> }>();
    expect(active.leases.find((l) => l["lease_id"] === lease["lease_id"])).toBeUndefined();

    const events = await (await SELF.fetch(`${BASE}/events?limit=500`)).json<{ events: Array<Record<string, unknown>> }>();
    const expired = events.events.filter((e) => e["type"] === "lease.expired");
    expect(expired.length).toBeGreaterThanOrEqual(1);
    expect(
      ((expired.at(-1)!["payload"] as Record<string, unknown>)["handoff_note"] as string).startsWith("[expired]"),
    ).toBe(true);
    // 回收后资源可再认领
    expect((await post("/claims", claimBody("wrk-6", "issue:104"))).status).toBe(201);
  });
});

describe("Events 流", () => {
  it("事件 ULID 严格递增，since 续传不重不漏", async () => {
    await post("/claims", claimBody("wrk-7", "issue:105"));
    const all = await (await SELF.fetch(`${BASE}/events?limit=500`)).json<{ events: Array<Record<string, unknown>> }>();
    const ids = all.events.map((e) => e["event_id"] as string);
    expect([...ids].sort()).toEqual(ids); // 字典序 == 时间序（ULID）
    const mid = ids[Math.floor(ids.length / 2)]!;
    const tail = await (await SELF.fetch(`${BASE}/events?since=${mid}&limit=500`)).json<{ events: Array<Record<string, unknown>> }>();
    expect(tail.events.map((e) => e["event_id"])).toEqual(ids.slice(ids.indexOf(mid) + 1));
  });
});

describe("F04 镜像", () => {
  it("upsert 幂等 + realtime 读带 mirrored_at 新鲜度与 PR 关键字段（mergeable/head_sha）", async () => {
    const pr = {
      number: 698,
      state: "open",
      title: "feat(p29/F01): 开源就绪",
      head_sha: "ee921c09",
      mergeable: "MERGEABLE",
      merge_state: "CLEAN",
      labels: ["status:in-review"],
      assignees: ["coord-platform"],
    };
    expect((await post("/mirror/upsert", { kind: "pr", data: pr })).status).toBe(200);
    // 状态变化再 upsert（webhook 增量语义）
    expect((await post("/mirror/upsert", { kind: "pr", data: { ...pr, state: "merged", merge_state: "UNKNOWN" } })).status).toBe(200);

    const got = await (await SELF.fetch(`${BASE}/realtime/prs/698`)).json<Record<string, unknown>>();
    expect(got["state"]).toBe("merged");
    expect(got["head_sha"]).toBe("ee921c09");
    expect(got["mergeable"]).toBe("MERGEABLE");
    expect(typeof got["mirrored_at"]).toBe("string"); // 新鲜度锚点必带
    expect(got["labels"]).toEqual(["status:in-review"]);

    const list = await (await SELF.fetch(`${BASE}/realtime/prs`)).json<{ items: Array<Record<string, unknown>> }>();
    expect(list.items.some((i) => i["number"] === 698)).toBe(true);
    expect((await SELF.fetch(`${BASE}/realtime/prs/99999`)).status).toBe(404);
    expect((await post("/mirror/upsert", { kind: "banana", data: pr })).status).toBe(422);
  });

  it("不同仓库的 DO 互不可见（issue:100 的租约不跨仓）", async () => {
    const other = "https://repohub.test/repos/other/repo";
    const r = await fetchClaim(other, "agent-x", "issue:100");
    expect(r.status).toBe(201); // 本仓 issue:100 已被占，但 other/repo 是独立 DO
  });
});

async function fetchClaim(base: string, agent: string, resource: string): Promise<Response> {
  return SELF.fetch(`${base}/claims`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(claimBody(agent, resource)),
  });
}
