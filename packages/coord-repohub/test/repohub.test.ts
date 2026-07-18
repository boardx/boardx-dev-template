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

describe("F06 andon 状态 + 投影游标", () => {
  const raise = {
    action: "raise", agent_id: "coord-main", severity: "stop-merge", scope: "module:devportal",
    reason: "devportal 部署事故，模块停线（issue #888）",
  };

  it("非法请求 422：短 reason / 坏 scope / raise 缺 stop-merge", async () => {
    expect((await post("/andon", { ...raise, reason: "太短" })).status).toBe(422);
    expect((await post("/andon", { ...raise, scope: "banana" })).status).toBe(422);
    expect((await post("/andon", { ...raise, severity: "warn" })).status).toBe(422);
    expect((await post("/andon", { ...raise, action: "pause" })).status).toBe(422);
  });

  it("raise → 状态 active + andon.raised 事件；重复 raise 409；clear → 恢复 + andon.cleared", async () => {
    expect((await post("/andon", raise)).status).toBe(200);
    const state = await (await SELF.fetch(`${BASE}/andon`)).json<{ active: boolean; andons: Array<Record<string, unknown>> }>();
    expect(state.active).toBe(true);
    expect(state.andons[0]).toMatchObject({ scope: "module:devportal", severity: "stop-merge" });

    expect((await post("/andon", raise)).status).toBe(409); // 已停线不重复停

    const clear = { action: "clear", agent_id: "coord-main", scope: "module:devportal", reason: "事故已恢复（issue #888）" };
    expect((await post("/andon", clear)).status).toBe(200);
    const after = await (await SELF.fetch(`${BASE}/andon`)).json<{ active: boolean }>();
    expect(after.active).toBe(false);
    expect((await post("/andon", clear)).status).toBe(409); // 未停线无可清

    const events = await (await SELF.fetch(`${BASE}/events?limit=500`)).json<{ events: Array<Record<string, unknown>> }>();
    const raised = events.events.filter((e) => e["type"] === "andon.raised" && e["resource_id"] === "module:devportal");
    const cleared = events.events.filter((e) => e["type"] === "andon.cleared" && e["resource_id"] === "module:devportal");
    expect(raised).toHaveLength(1); // 409 的重复 raise 不产生事件
    expect(cleared).toHaveLength(1);
    expect((raised[0]!["payload"] as Record<string, unknown>)["severity"]).toBe("stop-merge");
  });

  it("投影游标：初始 null → PUT 后可读回；坏 cursor 422", async () => {
    const empty = await (await SELF.fetch(`${BASE}/projector/cursor`)).json<{ cursor: string | null }>();
    expect(empty.cursor).toBeNull();
    const put = await SELF.fetch(`${BASE}/projector/cursor`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cursor: "evt_01ABC" }),
    });
    expect(put.status).toBe(200);
    const got = await (await SELF.fetch(`${BASE}/projector/cursor`)).json<{ cursor: string | null }>();
    expect(got.cursor).toBe("evt_01ABC");
    const bad = await SELF.fetch(`${BASE}/projector/cursor`, { method: "PUT", body: JSON.stringify({ cursor: 42 }) });
    expect(bad.status).toBe(422);
  });
});

describe("F07 evidence 提交", () => {
  const manifest = (id: string, resource = "feature:p29/F07") => ({
    protocol: PROTOCOL,
    manifest_id: id,
    resource_id: resource,
    agent_id: "wrk-ev-1",
    head_sha: "abc1234",
    attestations: [{
      command: "pnpm --filter coord-gateway test",
      exit_code: 0,
      output_digest: "sha256:deadbeef",
      output_excerpt: "Tests 12 passed (12)",
      log_url: "phases/phase-p29-coord-platform/evidence/F07.verify.log",
    }],
    attested_at: "2026-07-18T04:00:00Z",
  });

  it("合法 manifest → 201 + evidence.submitted 事件（payload 含 manifest_id/head_sha）；重复提交幂等 200", async () => {
    const r = await post("/evidence", manifest("evm_test_01"));
    expect(r.status).toBe(201);
    const dup = await post("/evidence", manifest("evm_test_01"));
    expect(dup.status).toBe(200);
    expect((await dup.json<Record<string, unknown>>())["duplicate"]).toBe(true);

    const events = await (await SELF.fetch(`${BASE}/events?limit=500`)).json<{ events: Array<Record<string, unknown>> }>();
    const submitted = events.events.filter((e) => e["type"] === "evidence.submitted");
    expect(submitted).toHaveLength(1); // 幂等：重复提交不产生第二条事件
    const payload = submitted[0]!["payload"] as Record<string, unknown>;
    expect(payload["manifest_id"]).toBe("evm_test_01");
    expect(payload["head_sha"]).toBe("abc1234");
  });

  it("非法 manifest → 422 拒收（exit_code 非 0 / 缺 head_sha 都不构成有效声明）", async () => {
    const failedCmd = manifest("evm_test_bad");
    failedCmd.attestations[0]!.exit_code = 1;
    expect((await post("/evidence", failedCmd)).status).toBe(422);
    const { head_sha: _drop, ...noSha } = manifest("evm_test_bad2");
    expect((await post("/evidence", noSha)).status).toBe(422);
  });

  it("GET /evidence?resource_id= 查询存档原文", async () => {
    await post("/evidence", manifest("evm_test_02", "feature:p29/F08"));
    const got = await (
      await SELF.fetch(`${BASE}/evidence?resource_id=feature:p29/F08`)
    ).json<{ manifests: Array<Record<string, unknown>> }>();
    expect(got.manifests).toHaveLength(1);
    expect(got.manifests[0]!["manifest_id"]).toBe("evm_test_02");
    expect(got.manifests[0]!["head_sha"]).toBe("abc1234");
    // 原文保真：manifest 字段完整回读
    const body = got.manifests[0]!["manifest"] as Record<string, unknown>;
    expect((body["attestations"] as unknown[]).length).toBe(1);
    // 不匹配的 resource_id 查不到
    const none = await (
      await SELF.fetch(`${BASE}/evidence?resource_id=feature:p29/F99`)
    ).json<{ manifests: unknown[] }>();
    expect(none.manifests).toHaveLength(0);
  });
});

describe("F08 agent tokens（按仓 scoped token 权威表）", () => {
  async function sha256Hex(s: string): Promise<string> {
    const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  it("mint → verify 生命周期：明文只出现在 mint 响应；hash 可验证；revoke 后 401", async () => {
    const minted = await (
      await post("/tokens/mint", { agent_id: "wrk-tok-1", owner: "usam.shen@gmail.com" })
    ).json<Record<string, string>>();
    expect(minted["token"]).toMatch(/^coordtk_[0-9a-f]{64}$/);
    const hash = await sha256Hex(minted["token"]!);
    expect(minted["token_hash_prefix"]).toBe(hash.slice(0, 8));

    // verify：在册未吊销 → 200 + 身份回传
    const ok = await post("/tokens/verify", { token_hash: hash });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true, agent_id: "wrk-tok-1", owner: "usam.shen@gmail.com" });

    // 列表：不含明文、不含完整 hash（只露前 8 位）
    const list = await (await SELF.fetch(`${BASE}/tokens`)).json<{ tokens: Array<Record<string, unknown>> }>();
    const row = list.tokens.find((t) => t["agent_id"] === "wrk-tok-1")!;
    expect(JSON.stringify(list)).not.toContain(minted["token"]);
    expect(JSON.stringify(list)).not.toContain(hash);
    expect(row["token_hash_prefix"]).toBe(hash.slice(0, 8));
    expect(row["revoked_at"]).toBeNull();

    // revoke（前缀定位）→ verify 立即 401（无缓存），revoke 幂等
    expect((await post("/tokens/revoke", { token_hash_prefix: hash.slice(0, 8) })).status).toBe(200);
    const revoked = await post("/tokens/verify", { token_hash: hash });
    expect(revoked.status).toBe(401);
    expect((await revoked.json<Record<string, unknown>>())["reason"]).toBe("revoked");
    const again = await post("/tokens/revoke", { token_hash: hash });
    expect(again.status).toBe(200);
    expect((await again.json<Record<string, unknown>>())["already_revoked"]).toBe(true);
  });

  it("verify 查无 hash → 404（跨仓/伪造 token 的判定基础）；坏参数 422", async () => {
    expect((await post("/tokens/verify", { token_hash: "f".repeat(64) })).status).toBe(404);
    expect((await post("/tokens/verify", { token_hash: "短的" })).status).toBe(422);
    expect((await post("/tokens/revoke", {})).status).toBe(422);
    expect((await post("/tokens/revoke", { token_hash: "e".repeat(64) })).status).toBe(404);
    expect((await post("/tokens/mint", { agent_id: "", owner: "" })).status).toBe(422);
  });
});

describe("F09 WS 实时流", () => {
  type WireEvent = { protocol: string; event_id: string; type: string; resource_id: string; payload: Record<string, unknown> };

  function openWs(query = "", headers: Record<string, string> = { "x-coord-stream-auth": "bearer" }) {
    return SELF.fetch(`${BASE}/stream${query}`, { headers: { upgrade: "websocket", ...headers } });
  }

  function collect(ws: WebSocket): WireEvent[] {
    const msgs: WireEvent[] = [];
    ws.accept();
    ws.addEventListener("message", (m) => msgs.push(JSON.parse(m.data as string) as WireEvent));
    return msgs;
  }

  async function waitFor(pred: () => boolean, ms = 2000): Promise<void> {
    const deadline = Date.now() + ms;
    while (!pred()) {
      if (Date.now() > deadline) throw new Error("waitFor 超时");
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  it("连接先补发积压再进实时；广播信封与 events.md 一致", async () => {
    await post("/claims", claimBody("wrk-ws-1", "issue:200"));
    const res = await openWs();
    expect(res.status).toBe(101);
    const msgs = collect(res.webSocket!);
    await waitFor(() => msgs.some((e) => e.resource_id === "issue:200")); // 积压补发
    // 实时：新 emit 立即推给活跃连接
    await post("/claims", claimBody("wrk-ws-2", "issue:201"));
    await waitFor(() => msgs.some((e) => e.type === "lease.claimed" && e.resource_id === "issue:201"));
    const live = msgs.find((e) => e.resource_id === "issue:201")!;
    expect(live.protocol).toBe(PROTOCOL);
    expect(live.event_id).toMatch(/^evt_/);
    expect((live.payload as { ttl_seconds?: number }).ttl_seconds).toBe(3600);
    res.webSocket!.close();
  });

  it("since 续传：只补发 since 之后的事件，不重不漏", async () => {
    await post("/claims", claimBody("wrk-ws-3", "issue:202"));
    const full = await openWs();
    const all = collect(full.webSocket!);
    await waitFor(() => all.some((e) => e.resource_id === "issue:202"));
    full.webSocket!.close();
    const ids = all.map((e) => e.event_id);
    const mid = ids[Math.floor(ids.length / 2)]!;
    const tail = await openWs(`?since=${mid}`);
    const tailMsgs = collect(tail.webSocket!);
    await waitFor(() => tailMsgs.length >= ids.length - ids.indexOf(mid) - 1);
    expect(tailMsgs.map((e) => e.event_id)).toEqual(ids.slice(ids.indexOf(mid) + 1));
    tail.webSocket!.close();
  });

  it("ticket 鉴权：一次性 + 过期即废；无凭证 401；非 upgrade 426", async () => {
    expect((await openWs("", {})).status).toBe(401); // 无 ticket 无 bearer 标
    expect((await SELF.fetch(`${BASE}/stream`)).status).toBe(426); // 非 WS 升级

    const minted = await (await SELF.fetch(`${BASE}/stream/ticket`, { method: "POST" })).json<{ ticket: string; expires_at: string }>();
    expect(minted.ticket).toMatch(/^stk_/);
    expect(Date.parse(minted.expires_at)).toBeGreaterThan(Date.now());
    const ok = await openWs(`?ticket=${minted.ticket}`, {});
    expect(ok.status).toBe(101);
    ok.webSocket!.accept();
    ok.webSocket!.close();
    // 一次性：同 ticket 复用 → 401
    expect((await openWs(`?ticket=${minted.ticket}`, {})).status).toBe(401);

    // 过期即废：mint 后把 expires_at 拨回过去
    const stale = await (await SELF.fetch(`${BASE}/stream/ticket`, { method: "POST" })).json<{ ticket: string }>();
    const stub = env.REPOHUB.get(env.REPOHUB.idFromName("boardx/boardx-dev-template"));
    await runInDurableObject(stub, async (_i: unknown, state: DurableObjectState) => {
      state.storage.sql.exec(`UPDATE stream_tickets SET expires_at='2000-01-01T00:00:00Z' WHERE ticket=?`, stale.ticket);
    });
    expect((await openWs(`?ticket=${stale.ticket}`, {})).status).toBe(401);
  });
});

async function fetchClaim(base: string, agent: string, resource: string): Promise<Response> {
  return SELF.fetch(`${base}/claims`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(claimBody(agent, resource)),
  });
}
