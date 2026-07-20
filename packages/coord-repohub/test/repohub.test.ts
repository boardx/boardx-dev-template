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

  it("不带 since 时 limit 截到最新 N 条，而不是最旧 N 条（#813）", async () => {
    for (let i = 0; i < 5; i += 1) {
      await post("/claims", claimBody(`wrk-events-${i}`, `issue:${200 + i}`));
    }
    const all = await (await SELF.fetch(`${BASE}/events?limit=500`)).json<{ events: Array<Record<string, unknown>> }>();
    const totalCount = all.events.length;
    expect(totalCount).toBeGreaterThan(3);

    const capped = await (await SELF.fetch(`${BASE}/events?limit=3`)).json<{ events: Array<Record<string, unknown>> }>();
    expect(capped.events.map((e) => e["event_id"])).toEqual(all.events.slice(-3).map((e) => e["event_id"]));
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

describe("平台目录事件转发（p30/F07：/relay/event）", () => {
  it("directory.* 前缀放行：落库 + 可通过 /events 查到", async () => {
    const r = await post("/relay/event", {
      type: "directory.agent.heartbeat",
      resource_id: "agent:agt_relay1",
      agent_id: "agt_relay1",
      payload: { agent_id: "agt_relay1", at: "2026-07-19T00:00:00Z" },
    });
    expect(r.status).toBe(202);
    const events = await (await SELF.fetch(`${BASE}/events?limit=500`)).json<{ events: Array<Record<string, unknown>> }>();
    const hit = events.events.find(
      (e) => e["type"] === "directory.agent.heartbeat" && e["resource_id"] === "agent:agt_relay1",
    );
    expect(hit).toBeTruthy();
    expect((hit!["payload"] as Record<string, unknown>)["agent_id"]).toBe("agt_relay1");
  });

  it("非 directory.* 前缀 / 缺字段 → 422（防误用把本仓变成任意事件注入口）", async () => {
    expect((await post("/relay/event", { type: "lease.claimed", resource_id: "x", agent_id: "y", payload: {} })).status).toBe(422);
    expect((await post("/relay/event", { type: "directory.agent.heartbeat", agent_id: "y", payload: {} })).status).toBe(422);
    expect((await post("/relay/event", { type: "directory.agent.heartbeat", resource_id: "x", payload: {} })).status).toBe(422);
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

describe("F10-pre tasks 收件箱（迁自 coord-service #614/#631）", () => {
  type Task = { id: number; issue: number; assignee: string; priority: string; status: string; note: string | null; deadline: string | null; created_by: string; acked_at: string | null };
  const dispatch = (over: Record<string, unknown> = {}) =>
    post("/tasks", { issue: 601, assignee: "wrk-t1", created_by: "devportal-broker", ...over });
  async function events(type: string): Promise<Array<Record<string, unknown>>> {
    const all = await (await SELF.fetch(`${BASE}/events?limit=500`)).json<{ events: Array<Record<string, unknown>> }>();
    return all.events.filter((e) => e["type"] === type);
  }

  it("派工 → 201 pending + task.dispatched 事件（payload 含 task_id/assignee/priority）", async () => {
    const r = await dispatch({ note: "先修 CI 再动手", deadline: "2026-07-19T00:00:00Z", priority: "high" });
    expect(r.status).toBe(201);
    const { task } = await r.json<{ task: Task }>();
    expect(task).toMatchObject({ issue: 601, assignee: "wrk-t1", priority: "high", status: "pending", created_by: "devportal-broker" });
    expect(task.deadline).toBe("2026-07-19T00:00:00.000Z"); // 归一存储
    const evs = await events("task.dispatched");
    expect(evs).toHaveLength(1);
    expect(evs[0]!["resource_id"]).toBe("issue:601");
    expect(evs[0]!["agent_id"]).toBe("devportal-broker");
    expect(evs[0]!["payload"]).toMatchObject({ task_id: task.id, assignee: "wrk-t1", priority: "high" });
  });

  it("派工校验 400：坏 issue / 空 assignee / 坏 priority / 脏 deadline / 超长 note", async () => {
    expect((await dispatch({ issue: "n" })).status).toBe(400);
    expect((await dispatch({ issue: -1 })).status).toBe(400);
    expect((await dispatch({ assignee: "" })).status).toBe(400);
    expect((await dispatch({ priority: "urgent" })).status).toBe(400);
    expect((await dispatch({ deadline: "明天吧" })).status).toBe(400);
    expect((await dispatch({ note: "x".repeat(2001) })).status).toBe(400);
  });

  it("收件箱查询：按 assignee / status 过滤；assignee=* 列全队；缺 assignee 400", async () => {
    await dispatch({ issue: 602, assignee: "wrk-t2" });
    const mine = await (await SELF.fetch(`${BASE}/tasks?assignee=wrk-t2`)).json<{ tasks: Task[] }>();
    expect(mine.tasks.every((t) => t.assignee === "wrk-t2")).toBe(true);
    expect(mine.tasks.length).toBeGreaterThanOrEqual(1);
    const all = await (await SELF.fetch(`${BASE}/tasks?assignee=*`)).json<{ tasks: Task[] }>();
    expect(new Set(all.tasks.map((t) => t.assignee)).size).toBeGreaterThanOrEqual(2);
    const pending = await (await SELF.fetch(`${BASE}/tasks?assignee=*&status=pending`)).json<{ tasks: Task[] }>();
    expect(pending.tasks.every((t) => t.status === "pending")).toBe(true);
    expect((await SELF.fetch(`${BASE}/tasks`)).status).toBe(400);
    expect((await SELF.fetch(`${BASE}/tasks?assignee=*&status=banana`)).status).toBe(400);
  });

  it("ack：非 assignee 403；本人 → acked + acked_at + task.acked 事件；重复 ack 409 不重复发事件", async () => {
    const { task } = await (await dispatch({ issue: 603, assignee: "wrk-t3" })).json<{ task: Task }>();
    expect((await post(`/tasks/${task.id}/ack`, { agent_id: "evil" })).status).toBe(403);
    expect((await post(`/tasks/${task.id}/ack`, {})).status).toBe(400); // 缺 agent_id
    const ok = await post(`/tasks/${task.id}/ack`, { agent_id: "wrk-t3" });
    expect(ok.status).toBe(200);
    const acked = (await ok.json<{ task: Task }>()).task;
    expect(acked.status).toBe("acked");
    expect(typeof acked.acked_at).toBe("string");
    const dup = await post(`/tasks/${task.id}/ack`, { agent_id: "wrk-t3" });
    expect(dup.status).toBe(409);
    expect((await dup.json<Record<string, unknown>>())["error"]).toBe("invalid_transition:acked->acked");
    expect((await events("task.acked")).filter((e) => (e["payload"] as { task_id: number }).task_id === task.id)).toHaveLength(1);
  });

  it("complete：pending 可直接 done（跳过 ack，D1 现行为）；done 后 ack/complete/recall 全 409", async () => {
    const { task } = await (await dispatch({ issue: 604, assignee: "wrk-t4" })).json<{ task: Task }>();
    const done = await post(`/tasks/${task.id}/complete`, { agent_id: "wrk-t4" });
    expect(done.status).toBe(200);
    expect((await done.json<{ task: Task }>()).task.status).toBe("done");
    expect((await post(`/tasks/${task.id}/ack`, { agent_id: "wrk-t4" })).status).toBe(409);
    expect((await post(`/tasks/${task.id}/complete`, { agent_id: "wrk-t4" })).status).toBe(409);
    expect((await post(`/tasks/${task.id}/recall`, {})).status).toBe(409);
    expect((await events("task.completed")).filter((e) => (e["payload"] as { task_id: number }).task_id === task.id)).toHaveLength(1);
  });

  it("recall：空 body 可撤（admin 面无身份，actor 记 admin）；acked 也可撤；撤后 ack 409", async () => {
    const { task } = await (await dispatch({ issue: 605, assignee: "wrk-t5" })).json<{ task: Task }>();
    await post(`/tasks/${task.id}/ack`, { agent_id: "wrk-t5" });
    const r = await SELF.fetch(`${BASE}/tasks/${task.id}/recall`, { method: "POST" }); // 无 body
    expect(r.status).toBe(200);
    expect((await r.json<{ task: Task }>()).task.status).toBe("recalled");
    const evs = (await events("task.recalled")).filter((e) => (e["payload"] as { task_id: number }).task_id === task.id);
    expect(evs).toHaveLength(1);
    expect(evs[0]!["agent_id"]).toBe("admin");
    expect((await post(`/tasks/${task.id}/ack`, { agent_id: "wrk-t5" })).status).toBe(409);
    expect((await SELF.fetch(`${BASE}/tasks/99999/recall`, { method: "POST" })).status).toBe(404);
  });

  it("import：保留原 id 幂等导入，重跑 skipped，不产生事件；新派工不撞导入的 id", async () => {
    const rows = [
      { id: 9001, issue: 700, assignee: "wrk-old-1", priority: "normal", deadline: null, note: "[派工人 a@b.c] 存量", status: "done", created_by: "portal-broker", created_at: "2026-07-14T00:00:00Z", acked_at: "2026-07-14T01:00:00Z", updated_at: "2026-07-14T02:00:00Z" },
      { id: 9002, issue: 701, assignee: "wrk-old-2", priority: "high", deadline: null, note: null, status: "pending", created_by: "coord-main", created_at: "2026-07-15T00:00:00Z", acked_at: null, updated_at: "2026-07-15T00:00:00Z" },
    ];
    const evBefore = (await events("task.dispatched")).length;
    const first = await post("/tasks/import", { tasks: rows });
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true, imported: 2, skipped: 0 });
    const rerun = await post("/tasks/import", { tasks: rows });
    expect(await rerun.json()).toEqual({ ok: true, imported: 0, skipped: 2 });
    expect((await events("task.dispatched")).length).toBe(evBefore); // 导入不产事件
    // 存量字段保真（status/acked_at/created_by 原样）
    const old = await (await SELF.fetch(`${BASE}/tasks?assignee=wrk-old-1`)).json<{ tasks: Task[] }>();
    expect(old.tasks[0]).toMatchObject({ id: 9001, status: "done", created_by: "portal-broker", acked_at: "2026-07-14T01:00:00Z" });
    // AUTOINCREMENT 序列被显式 id 推进：新派工 id > 9002
    const fresh = await (await dispatch({ issue: 702, assignee: "wrk-new" })).json<{ task: Task }>();
    expect(fresh.task.id).toBeGreaterThan(9002);
    // 坏行整体 422
    expect((await post("/tasks/import", { tasks: [{ id: 1 }] })).status).toBe(422);
    expect((await post("/tasks/import", { tasks: "x" })).status).toBe(422);
  });

  it("import 内容一致性（coord-main #732 复核）：同 id 同内容幂等 skipped；同 id 不同内容 409 列出冲突字段", async () => {
    const row = {
      id: 9101, issue: 710, assignee: "wrk-consist", priority: "normal", deadline: null,
      note: "原始内容", status: "pending", created_by: "coord-main",
      created_at: "2026-07-16T00:00:00Z", acked_at: null, updated_at: "2026-07-16T00:00:00Z",
    };
    expect(await (await post("/tasks/import", { tasks: [row] })).json()).toEqual({ ok: true, imported: 1, skipped: 0 });
    // 同 id 同内容重跑 = 幂等 skipped
    expect(await (await post("/tasks/import", { tasks: [row] })).json()).toEqual({ ok: true, imported: 0, skipped: 1 });
    // 同 id 不同内容 = 两个来源在讲不同历史 → 409 大声失败，列出冲突 id 与差异字段
    const drifted = { ...row, assignee: "wrk-other", status: "done" };
    const conflict = await post("/tasks/import", { tasks: [drifted] });
    expect(conflict.status).toBe(409);
    const body = await conflict.json<{ error: string; task_id: number; mismatched_fields: string[] }>();
    expect(body.error).toBe("import_conflict");
    expect(body.task_id).toBe(9101);
    expect(body.mismatched_fields.sort()).toEqual(["assignee", "status"]);
    // 409 后存量行未被覆盖（导入绝不静默改写历史）
    const kept = await (await SELF.fetch(`${BASE}/tasks?assignee=wrk-consist`)).json<{ tasks: Task[] }>();
    expect(kept.tasks[0]).toMatchObject({ id: 9101, assignee: "wrk-consist", status: "pending" });
  });
});

describe("deliveries 保留窗口清理（#712）", () => {
  it("alarm 顺带删 30 天前的 deliveries 行；30 天内的保留（幂等）", async () => {
    const id = env.REPOHUB.idFromName("boardx/boardx-dev-template");
    const stub = env.REPOHUB.get(id);
    // 先 claim 一个租约让 alarm 有排（清理搭 lease alarm 的便车）
    expect((await post("/claims", claimBody("ttl-agent", "issue:712"))).status).toBe(201);

    const old = new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString();
    const fresh = new Date().toISOString();
    await runInDurableObject(stub, async (_i: unknown, state: DurableObjectState) => {
      state.storage.sql.exec(`INSERT INTO deliveries (delivery_id, at) VALUES ('dlv-old', ?)`, old);
      state.storage.sql.exec(`INSERT INTO deliveries (delivery_id, at) VALUES ('dlv-fresh', ?)`, fresh);
    });

    expect(await runDurableObjectAlarm(stub)).toBe(true);

    await runInDurableObject(stub, async (_i: unknown, state: DurableObjectState) => {
      const rows = [...state.storage.sql.exec(`SELECT delivery_id FROM deliveries`)];
      const ids = rows.map((r) => r["delivery_id"]);
      expect(ids).not.toContain("dlv-old");
      expect(ids).toContain("dlv-fresh");
    });

    // 幂等：再跑一轮 alarm 不报错、fresh 仍在
    await runDurableObjectAlarm(stub);
    await runInDurableObject(stub, async (_i: unknown, state: DurableObjectState) => {
      const rows = [...state.storage.sql.exec(`SELECT delivery_id FROM deliveries`)];
      expect(rows.map((r) => r["delivery_id"])).toContain("dlv-fresh");
    });
  });
});

describe("p30/F09 三层意图消息协议", () => {
  const intent = (over: Record<string, unknown> = {}) =>
    post("/intents", {
      type: "intent.progress",
      resource_id: "issue:900",
      agent_id: "wrk-i1",
      payload: { summary: "推进中" },
      ...over,
    });

  it("非法请求 422：未知 type / 缺字段 / 坏 payload", async () => {
    expect((await intent({ type: "intent.unknown" })).status).toBe(422);
    expect((await intent({ resource_id: undefined })).status).toBe(422);
    expect((await intent({ payload: { summary: "" } })).status).toBe(422);
  });

  it("合法请求 201 + 落 append-only events（GET /events 可见）", async () => {
    const r = await intent();
    expect(r.status).toBe(201);
    const body = await r.json<{ ok: boolean; event: Record<string, unknown> }>();
    expect(body.ok).toBe(true);
    expect(body.event["type"]).toBe("intent.progress");
    const all = await (await SELF.fetch(`${BASE}/events?limit=500`)).json<{ events: Array<Record<string, unknown>> }>();
    expect(all.events.some((e) => e["event_id"] === body.event["event_id"])).toBe(true);
  });

  it("GET /intents?resource_id= 聚合返回该资源的意图消息链（按 event_id 排序）", async () => {
    await post("/intents", {
      type: "intent.assign", resource_id: "issue:901", agent_id: "coord-main",
      payload: { target_agent_id: "wrk-i2", target_resource_id: "issue:901", note: null },
    });
    await post("/intents", {
      type: "intent.progress", resource_id: "issue:901", agent_id: "wrk-i2",
      payload: { summary: "开工" },
    });
    const r = await SELF.fetch(`${BASE}/intents?resource_id=issue:901`);
    expect(r.status).toBe(200);
    const body = await r.json<{ resource_id: string; thread_status: string; events: Array<Record<string, unknown>> }>();
    expect(body.resource_id).toBe("issue:901");
    expect(body.events.map((e) => e["type"])).toEqual(["intent.assign", "intent.progress"]);
    expect(body.thread_status).toBe("open"); // 未 escalate/decide/accept 过
  });

  it("GET /intents 缺 resource_id → 400", async () => {
    expect((await SELF.fetch(`${BASE}/intents`)).status).toBe(400);
  });

  it("上行链：blocker→escalate 后 thread_status = awaiting_decision（等待拍板）", async () => {
    await post("/intents", {
      type: "intent.blocker", resource_id: "issue:902", agent_id: "wrk-i3",
      payload: { reason: "依赖服务挂了，卡住了（issue #902）" },
    });
    await post("/intents", {
      type: "intent.escalate", resource_id: "issue:902", agent_id: "module-coord",
      payload: { reason: "需要人类确认降级方案（issue #902）", escalated_to: "usam" },
    });
    const r = await (await SELF.fetch(`${BASE}/intents?resource_id=issue:902`)).json<{ thread_status: string }>();
    expect(r.thread_status).toBe("awaiting_decision");
  });

  it("安全回归（独立审 #772 阻断修复）：escalate 之后任何人发 intent.accept 都不能解除 awaiting_decision——只有 intent.decide 能", async () => {
    await post("/intents", {
      type: "intent.escalate", resource_id: "issue:904", agent_id: "module-coord",
      payload: { reason: "需要人类确认降级方案（issue #904）", escalated_to: "usam" },
    });
    const beforeAccept = await (await SELF.fetch(`${BASE}/intents?resource_id=issue:904`)).json<{ thread_status: string }>();
    expect(beforeAccept.thread_status).toBe("awaiting_decision");

    // scoped agent（无 admin token）发的 accept 不得伪造成"已拍板"——绕过 decide 的 admin 门禁
    const accepted = await post("/intents", {
      type: "intent.accept", resource_id: "issue:904", agent_id: "wrk-attacker",
      payload: { note: "我自己批准了" },
    });
    expect(accepted.status).toBe(201);
    const afterAccept = await (await SELF.fetch(`${BASE}/intents?resource_id=issue:904`)).json<{ thread_status: string }>();
    expect(afterAccept.thread_status).toBe("awaiting_decision"); // 关键断言：accept 不解除等待拍板

    // 只有真正的 decide 才能解除
    await post("/intents", {
      type: "intent.decide", resource_id: "issue:904", agent_id: "usam",
      payload: { reason: "按方案 A 拍板通过", issue_ref: "#904", decision: "approved" },
    });
    const afterDecide = await (await SELF.fetch(`${BASE}/intents?resource_id=issue:904`)).json<{ thread_status: string }>();
    expect(afterDecide.thread_status).toBe("closed");
  });

  it("下行链：人拍板 decide 后 thread_status = closed（已闭环）；再 assign 广播不回退闭环判定", async () => {
    await post("/intents", {
      type: "intent.escalate", resource_id: "issue:903", agent_id: "module-coord",
      payload: { reason: "需要人类确认拍板范围（issue #903）", escalated_to: "usam" },
    });
    const decided = await post("/intents", {
      type: "intent.decide", resource_id: "issue:903", agent_id: "usam",
      payload: { reason: "按方案 A 拍板通过", issue_ref: "#903", decision: "approved" },
    });
    expect(decided.status).toBe(201);
    const afterDecide = await (await SELF.fetch(`${BASE}/intents?resource_id=issue:903`)).json<{ thread_status: string }>();
    expect(afterDecide.thread_status).toBe("closed");

    // 广播 assign（下行→module→sub 自动继续）不是「新一轮 escalate」，闭环判定不回退
    await post("/intents", {
      type: "intent.assign", resource_id: "issue:903", agent_id: "coord-main",
      payload: { target_agent_id: "wrk-i4", target_resource_id: "issue:903", note: "按拍板结果继续" },
    });
    const afterAssign = await (await SELF.fetch(`${BASE}/intents?resource_id=issue:903`)).json<{ thread_status: string }>();
    expect(afterAssign.thread_status).toBe("closed");
  });
});

async function fetchClaim(base: string, agent: string, resource: string): Promise<Response> {
  return SELF.fetch(`${base}/claims`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(claimBody(agent, resource)),
  });
}

describe("p30/F04 工作区分片：需求流水线 / sprint 面板 / talk 对话流", () => {
  const j = <T>(r: Response) => r.json<T>();

  it("需求五态 happy path：提交→分析→审核→下发，每步 emit 对应事件", async () => {
    const created = await j<{ requirement: Record<string, unknown> }>(
      await post("/requirements", { title: "需要 backlog 独立视图", body: "详见 use-cases UC-07", agent_id: "wrk-req-1" }),
    );
    const id = created.requirement["id"] as string;
    expect(id).toMatch(/^req_/);
    expect(created.requirement["status"]).toBe("submitted");

    // submitted → analyzing（可附分析产出）
    let r = await post(`/requirements/${id}/advance`, { agent_id: "wrk-req-1", analysis: "拆 2 个 feature" });
    expect(r.status).toBe(200);
    expect((await j<{ requirement: Record<string, unknown> }>(r)).requirement["status"]).toBe("analyzing");
    // analyzing → in_review
    r = await post(`/requirements/${id}/advance`, { agent_id: "wrk-req-1" });
    expect((await j<{ requirement: Record<string, unknown> }>(r)).requirement["status"]).toBe("in_review");
    // in_review 不能再 advance（审核结论走 review 面）
    expect((await post(`/requirements/${id}/advance`, { agent_id: "wrk-req-1" })).status).toBe(409);
    // 审核通过 → dispatched + 关联 issue
    r = await post(`/requirements/${id}/review`, { action: "approve", issue: 901, agent_id: "coord-main" });
    expect(r.status).toBe(200);
    const done = (await j<{ requirement: Record<string, unknown> }>(r)).requirement;
    expect(done["status"]).toBe("dispatched");
    expect(done["issue"]).toBe(901);
    expect(done["analysis"]).toBe("拆 2 个 feature");
    // 终态不可再审
    expect((await post(`/requirements/${id}/review`, { action: "reject" })).status).toBe(409);

    const events = await j<{ events: Array<Record<string, unknown>> }>(await SELF.fetch(`${BASE}/events?limit=500`));
    const mine = events.events.filter((e) => e["resource_id"] === `requirement:${id}`);
    expect(mine.map((e) => e["type"])).toEqual([
      "requirement.submitted", "requirement.advanced", "requirement.advanced", "requirement.dispatched",
    ]);
  });

  it("需求审核拒绝 → rejected 终态；非法入参 422；状态过滤查询", async () => {
    const { requirement } = await j<{ requirement: Record<string, unknown> }>(
      await post("/requirements", { title: "越权需求", body: "", agent_id: "wrk-req-2" }),
    );
    const id = requirement["id"] as string;
    await post(`/requirements/${id}/advance`, { agent_id: "wrk-req-2" });
    await post(`/requirements/${id}/advance`, { agent_id: "wrk-req-2" });
    const r = await post(`/requirements/${id}/review`, { action: "reject", review_note: "范围过大，拆分后重提" });
    expect(r.status).toBe(200);
    expect((await j<{ requirement: Record<string, unknown> }>(r)).requirement["status"]).toBe("rejected");
    // 拒绝后不能推进
    expect((await post(`/requirements/${id}/advance`, { agent_id: "wrk-req-2" })).status).toBe(409);

    expect((await post("/requirements", { title: "", body: "", agent_id: "a" })).status).toBe(422);
    expect((await post("/requirements", { title: "缺 body", agent_id: "a" })).status).toBe(422);
    expect((await post("/requirements", { title: "缺 agent", body: "" })).status).toBe(422);
    expect((await post(`/requirements/${id}/review`, { action: "postpone" })).status).toBe(422);
    expect((await SELF.fetch(`${BASE}/requirements?status=banana`)).status).toBe(400);

    const rejected = await j<{ requirements: Array<Record<string, unknown>> }>(
      await SELF.fetch(`${BASE}/requirements?status=rejected`),
    );
    expect(rejected.requirements.map((x) => x["id"])).toContain(id);
    expect((await SELF.fetch(`${BASE}/requirements/req_NOPE`)).status).toBe(404);
  });

  it("sprint 面板 upsert 幂等更新 + 按 sprint 过滤 + emit sprint.upserted", async () => {
    const item = { sprint: "p30/01", item_id: "F04", title: "工作区分片", status: "in_progress", assignee: "wrk-1", data: { area: "coord" } };
    expect((await post("/sprint-items/upsert", item)).status).toBe(200);
    expect((await post("/sprint-items/upsert", { ...item, status: "review", assignee: null })).status).toBe(200);
    expect((await post("/sprint-items/upsert", { sprint: "p31/01", item_id: "F01", title: "别的 sprint", status: "not_started" })).status).toBe(200);
    expect((await post("/sprint-items/upsert", { sprint: "p30/01" })).status).toBe(422);

    const cur = await j<{ items: Array<Record<string, unknown>> }>(await SELF.fetch(`${BASE}/sprint-items?sprint=p30%2F01`));
    expect(cur.items).toHaveLength(1);
    expect(cur.items[0]).toMatchObject({ item_id: "F04", status: "review", assignee: null });
    expect((cur.items[0]!["data"] as Record<string, unknown>)["area"]).toBe("coord");

    const events = await j<{ events: Array<Record<string, unknown>> }>(await SELF.fetch(`${BASE}/events?limit=500`));
    expect(events.events.filter((e) => e["type"] === "sprint.upserted").length).toBeGreaterThanOrEqual(3);
  });

  it("talk append-only：ULID 时间序 + since 续传 + needs_human + 长度上限 422", async () => {
    const a = await j<{ message: Record<string, unknown> }>(
      await post("/talk", { agent_id: "wrk-t1", body: "第一条：开工" }),
    );
    const b = await j<{ message: Record<string, unknown> }>(
      await post("/talk", { agent_id: "wrk-t2", body: "第二条：需要人类拍板", needs_human: true }),
    );
    expect(a.message["message_id"]).toMatch(/^tlk_/);
    expect((a.message["message_id"] as string) < (b.message["message_id"] as string)).toBe(true);

    const all = await j<{ messages: Array<Record<string, unknown>> }>(await SELF.fetch(`${BASE}/talk`));
    const ids = all.messages.map((m) => m["message_id"] as string);
    expect(ids).toEqual([...ids].sort());
    expect(all.messages.find((m) => m["message_id"] === b.message["message_id"])!["needs_human"]).toBe(true);

    const tail = await j<{ messages: Array<Record<string, unknown>> }>(
      await SELF.fetch(`${BASE}/talk?since=${a.message["message_id"] as string}`),
    );
    expect(tail.messages.map((m) => m["message_id"])).toContain(b.message["message_id"]);
    expect(tail.messages.map((m) => m["message_id"])).not.toContain(a.message["message_id"]);

    expect((await post("/talk", { agent_id: "wrk-t1", body: "" })).status).toBe(422);
    expect((await post("/talk", { agent_id: "wrk-t1", body: "x".repeat(4001) })).status).toBe(422);
    expect((await post("/talk", { body: "缺 agent_id" })).status).toBe(422);
  });

  it("【隔离核心断言】两个项目命名空间互不可见：boardx/boardx-dev-template vs agentic-harness/agentic-harness-template", async () => {
    const A = BASE; // boardx/boardx-dev-template
    const B = "https://repohub.test/repos/agentic-harness/agentic-harness-template";
    const postTo = (base: string, path: string, body: unknown) =>
      SELF.fetch(`${base}${path}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });

    // 并发向两命名空间各写 talk + requirement（N3：互不阻塞、互不串线）
    const [ta, tb, ra, rb] = await Promise.all([
      postTo(A, "/talk", { agent_id: "wrk-a", body: "A 项目内部讨论" }),
      postTo(B, "/talk", { agent_id: "wrk-b", body: "B 项目内部讨论" }),
      postTo(A, "/requirements", { title: "A 的需求", body: "", agent_id: "wrk-a" }),
      postTo(B, "/requirements", { title: "B 的需求", body: "", agent_id: "wrk-b" }),
    ]);
    for (const r of [ta, tb, ra, rb]) expect(r.status).toBe(201);
    const msgA = (await ta.json<{ message: { message_id: string } }>()).message.message_id;
    const msgB = (await tb.json<{ message: { message_id: string } }>()).message.message_id;
    const reqA = (await ra.json<{ requirement: { id: string } }>()).requirement.id;
    const reqB = (await rb.json<{ requirement: { id: string } }>()).requirement.id;

    // 交叉读：A 的数据在 B 不可见（404/不在列表），反之亦然
    const talkB = await j<{ messages: Array<{ message_id: string }> }>(await SELF.fetch(`${B}/talk`));
    expect(talkB.messages.map((m) => m.message_id)).not.toContain(msgA);
    expect(talkB.messages.map((m) => m.message_id)).toContain(msgB);
    const talkA = await j<{ messages: Array<{ message_id: string }> }>(await SELF.fetch(`${A}/talk`));
    expect(talkA.messages.map((m) => m.message_id)).not.toContain(msgB);

    expect((await SELF.fetch(`${B}/requirements/${reqA}`)).status).toBe(404);
    expect((await SELF.fetch(`${A}/requirements/${reqB}`)).status).toBe(404);

    // sprint 面板同理：A 写入的条目 B 查不到
    await postTo(A, "/sprint-items/upsert", { sprint: "p30/01", item_id: "ISO-1", title: "A 独有", status: "done" });
    const sprintB = await j<{ items: Array<{ item_id: string }> }>(await SELF.fetch(`${B}/sprint-items?sprint=p30%2F01`));
    expect(sprintB.items.map((i) => i.item_id)).not.toContain("ISO-1");

    // 事件流也分片：B 的事件流不含 A 的资源
    const evB = await j<{ events: Array<{ resource_id: string }> }>(await SELF.fetch(`${B}/events?limit=500`));
    expect(evB.events.map((e) => e.resource_id)).not.toContain(`talk:${msgA}`);
    expect(evB.events.map((e) => e.resource_id)).toContain(`talk:${msgB}`);
  });
});
