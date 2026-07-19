// 投影引擎表驱动测试（F06）：纯函数，无 IO。
// 覆盖：andon 对账（active 补投 / cleared 恢复）、lease→关联 PR 匹配、
// 无关事件忽略、同 sha 去重后者覆盖。
import { describe, expect, it } from "vitest";
import { project, type ActiveLease, type OpenPr, type ProjectionEvent, type AndonState } from "../src/engine";

const NOW = Date.parse("2026-07-18T04:00:00Z");

function ev(over: Partial<ProjectionEvent>): ProjectionEvent {
  return {
    event_id: "evt_01", type: "lease.claimed", resource_id: "issue:698",
    agent_id: "wrk-1", at: "2026-07-18T03:00:00Z", payload: {},
    ...over,
  };
}

function pr(over: Partial<OpenPr>): OpenPr {
  return { number: 700, title: "feat: something", body: null, head_sha: "aaa1111", ...over };
}

const noAndon: AndonState = { active: false, andons: [] };
const activeAndon: AndonState = {
  active: true,
  andons: [{ scope: "repo", reason: "main 挂了，停线（issue #999）", raised_by: "coord-main", raised_at: "2026-07-18T03:30:00Z" }],
};

describe("andon 投影对账", () => {
  it("andon active：所有含 head_sha 的 open PR 每 tick 补投 failure（含停线期间新 mirror 的 PR）", () => {
    const calls = project({
      events: [], // 没有新事件也要对账
      openPrs: [pr({ head_sha: "aaa1111" }), pr({ number: 701, head_sha: "bbb2222" }), pr({ number: 702, head_sha: null })],
      andon: activeAndon,
      now: NOW,
    });
    const statuses = calls.filter((c) => c.kind === "commit_status");
    expect(statuses).toHaveLength(2);
    for (const s of statuses) {
      expect(s.state).toBe("failure");
      expect(s.context).toBe("coord/andon");
      expect(s.description).toContain("main 挂了");
    }
  });

  it("andon.cleared 且状态已恢复：全部 open PR 置 success", () => {
    const calls = project({
      events: [ev({ type: "andon.cleared", resource_id: "repo", payload: { scope: "repo", reason: "已修复 #999" } })],
      openPrs: [pr({})],
      andon: noAndon,
      now: NOW,
    });
    expect(calls).toEqual([
      expect.objectContaining({ kind: "commit_status", sha: "aaa1111", state: "success", context: "coord/andon" }),
    ]);
  });

  it("无 andon 状态且无 cleared 事件：不产生任何 status 调用", () => {
    const calls = project({ events: [], openPrs: [pr({})], andon: noAndon, now: NOW });
    expect(calls).toHaveLength(0);
  });
});

describe("lease → 关联 PR 的 coord/lease check", () => {
  const prs = [
    pr({ number: 700, title: "feat(p29/F06): 投影", body: "Closes #698", head_sha: "aaa1111" }),
    pr({ number: 701, title: "fix: 无关 PR", body: null, head_sha: "bbb2222" }),
    pr({ number: 702, title: "docs: 提到 #6981 的 PR", body: null, head_sha: "ccc3333" }), // 词边界：#698 不得命中 #6981
  ];

  it("lease.claimed(issue:698) → 仅 body 含 #698 的 PR 得到 success check（title 含持有者与 TTL 剩余）", () => {
    const calls = project({
      events: [ev({ payload: { ttl_seconds: 7200, lease_id: "lse_1" } })], // at 03:00 + 2h = 05:00，now 04:00 → 剩 60m
      openPrs: prs,
      andon: noAndon,
      now: NOW,
    });
    expect(calls).toHaveLength(1);
    const c = calls[0]!;
    expect(c).toMatchObject({ kind: "check_run", head_sha: "aaa1111", name: "coord/lease", conclusion: "success" });
    if (c.kind === "check_run") {
      expect(c.title).toContain("wrk-1");
      expect(c.title).toContain("60m");
    }
  });

  it("lease.released / lease.expired → neutral check，summary 带交接说明", () => {
    for (const [type, note] of [
      ["lease.released", "F06 做完了，剩 e2e 等 secrets"],
      ["lease.expired", "[expired] last_heartbeat_at=2026-07-18T02:00:00Z"],
    ] as const) {
      const calls = project({
        events: [ev({ type, payload: { handoff_note: note } })],
        openPrs: prs,
        andon: noAndon,
        now: NOW,
      });
      expect(calls).toHaveLength(1);
      const c = calls[0]!;
      expect(c).toMatchObject({ kind: "check_run", conclusion: "neutral" });
      if (c.kind === "check_run") expect(c.summary).toContain(note);
    }
  });

  it("同一 PR 多个 lease 事件：后者覆盖前者（released 覆盖 claimed）", () => {
    const calls = project({
      events: [
        ev({ event_id: "evt_01", type: "lease.claimed", payload: { ttl_seconds: 3600 } }),
        ev({ event_id: "evt_02", type: "lease.released", payload: { handoff_note: "交接：已完成一半" } }),
      ],
      openPrs: prs,
      andon: noAndon,
      now: NOW,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ kind: "check_run", conclusion: "neutral" });
  });

  it("对账补投（#723-2）：事件已被游标消费（上轮 apply 失败），下 tick 无事件也按活跃租约快照重投 success check", () => {
    // 场景：lease.claimed 事件那轮 applyCalls 失败但游标已推进——事件不会重来。
    // 下 tick events 为空，靠 leases 快照对账补投。
    const lease: ActiveLease = {
      lease_id: "lse_1", resource_id: "issue:698", agent_id: "wrk-1",
      claimed_at: "2026-07-18T03:00:00Z", expires_at: "2026-07-18T05:00:00Z", // now 04:00 → 剩 60m
    };
    const calls = project({ events: [], openPrs: prs, andon: noAndon, leases: [lease], now: NOW });
    expect(calls).toHaveLength(1);
    const c = calls[0]!;
    expect(c).toMatchObject({ kind: "check_run", head_sha: "aaa1111", name: "coord/lease", conclusion: "success" });
    if (c.kind === "check_run") {
      expect(c.title).toContain("wrk-1");
      expect(c.title).toContain("60m");
      expect(c.summary).toContain("lse_1");
    }
  });

  it("对账快照覆盖批内 stale 事件；租约已结束（快照为空）时结束态事件不被回退", () => {
    // 批内 released 事件 + 快照显示已被 wrk-2 重新认领 → 快照（当前真值）胜出
    const reclaimed: ActiveLease = {
      lease_id: "lse_2", resource_id: "issue:698", agent_id: "wrk-2",
      claimed_at: "2026-07-18T03:50:00Z", expires_at: "2026-07-18T05:00:00Z",
    };
    const overwritten = project({
      events: [ev({ type: "lease.released", payload: { handoff_note: "交接给下家" } })],
      openPrs: prs, andon: noAndon, leases: [reclaimed], now: NOW,
    });
    expect(overwritten).toHaveLength(1);
    expect(overwritten[0]).toMatchObject({ kind: "check_run", conclusion: "success" });
    if (overwritten[0]!.kind === "check_run") expect(overwritten[0]!.title).toContain("wrk-2");

    // 快照为空（租约真的结束了）→ released 事件的 neutral check 保持
    const kept = project({
      events: [ev({ type: "lease.released", payload: { handoff_note: "交接给下家" } })],
      openPrs: prs, andon: noAndon, leases: [], now: NOW,
    });
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ kind: "check_run", conclusion: "neutral" });
  });

  it("非 issue 资源（feature:/role:）与无关事件类型全部忽略", () => {
    const calls = project({
      events: [
        ev({ resource_id: "feature:p29/F06" }),
        ev({ resource_id: "role:coord-main" }),
        ev({ type: "lease.heartbeat" }),
        ev({ type: "mirror.updated", resource_id: "pr:700" }),
        ev({ type: "evidence.submitted" }),
      ],
      openPrs: prs,
      andon: noAndon,
      now: NOW,
    });
    expect(calls).toHaveLength(0);
  });
});

describe("intent.* → GitHub issue 双写（p30/F09）", () => {
  it("issue:N 锚定的 intent 事件 → 该 issue 一条 issue_comment 调用（每条独立，不去重覆盖）", () => {
    const calls = project({
      events: [
        ev({
          event_id: "evt_i1", type: "intent.assign", resource_id: "issue:900", agent_id: "coord-main",
          payload: { target_agent_id: "wrk-i1", target_resource_id: "issue:900", note: null },
        }),
        ev({
          event_id: "evt_i2", type: "intent.progress", resource_id: "issue:900", agent_id: "wrk-i1",
          payload: { summary: "开工了" },
        }),
      ],
      openPrs: [],
      andon: noAndon,
      now: NOW,
    });
    const comments = calls.filter((c) => c.kind === "issue_comment");
    expect(comments).toHaveLength(2); // 同一 issue 两条独立评论，不是 1 条（与 andon/lease 的覆盖式去重不同）
    expect(comments[0]).toMatchObject({ kind: "issue_comment", issue_number: 900 });
    if (comments[0]!.kind === "issue_comment") {
      expect(comments[0]!.body).toContain("intent.assign");
      expect(comments[0]!.body).toContain("wrk-i1");
      expect(comments[0]!.body).toContain("evt_i1");
    }
    if (comments[1]!.kind === "issue_comment") expect(comments[1]!.body).toContain("开工了");
  });

  it("非 issue 锚定（feature:/module:/custom:）的 intent 事件不双写（无 issue 可评论）", () => {
    const calls = project({
      events: [
        ev({ type: "intent.progress", resource_id: "feature:p30/F09", payload: { summary: "推进中" } }),
        ev({ type: "intent.blocker", resource_id: "module:devportal", payload: { reason: "被阻塞了（issue #1）" } }),
      ],
      openPrs: [],
      andon: noAndon,
      now: NOW,
    });
    expect(calls.filter((c) => c.kind === "issue_comment")).toHaveLength(0);
  });

  it("payload 中 null/undefined/空字符串字段不出现在评论正文里", () => {
    const calls = project({
      events: [
        ev({
          type: "intent.assign", resource_id: "issue:901",
          payload: { target_agent_id: "wrk-i2", target_resource_id: "issue:901", note: null },
        }),
      ],
      openPrs: [],
      andon: noAndon,
      now: NOW,
    });
    const c = calls.find((x) => x.kind === "issue_comment");
    if (c?.kind === "issue_comment") expect(c.body).not.toContain("note");
  });
});
