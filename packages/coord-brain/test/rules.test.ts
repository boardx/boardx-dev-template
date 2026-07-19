import { describe, expect, it } from "vitest";
import {
  decideAndonFreeze,
  decideDispatch,
  decideMergeReady,
  decidePrNudge,
  decideStaleLeaseReclaim,
  runShadowSopCycle,
} from "../src/rules";
import type { AndonSnapshot, IssueSnapshot, LeaseSnapshot, PrSnapshot } from "../src/types";
import { DEFAULT_THRESHOLDS } from "../src/types";

const NO_ANDON: AndonSnapshot = { active: false, andons: [] };
const ACTIVE_ANDON: AndonSnapshot = {
  active: true,
  andons: [{ scope: "repo", reason: "prod incident", raised_by: "usam", raised_at: "2026-07-19T00:00:00Z" }],
};

function greenPr(overrides: Partial<PrSnapshot> = {}): PrSnapshot {
  return {
    number: 1,
    head_sha: "abc123",
    mergeable: "MERGEABLE",
    merge_state: "CLEAN",
    opened_at: "2026-07-18T00:00:00Z",
    labels: [],
    ...overrides,
  };
}

describe("decideMergeReady — 全绿可合并判定", () => {
  it("全绿 + 无 andon → ready", () => {
    const d = decideMergeReady(greenPr(), NO_ANDON);
    expect(d.ready).toBe(true);
  });

  it("边界核心：andon 活跃时，即使 PR 全绿也必须翻转为 false", () => {
    const d = decideMergeReady(greenPr(), ACTIVE_ANDON);
    expect(d.ready).toBe(false);
    expect(d.reason).toBe("andon_active");
  });

  it("mergeable=CONFLICTING → false", () => {
    const d = decideMergeReady(greenPr({ mergeable: "CONFLICTING" }), NO_ANDON);
    expect(d.ready).toBe(false);
    expect(d.reason).toBe("mergeable_CONFLICTING");
  });

  it("merge_state=BEHIND（非 up-to-date）→ false", () => {
    const d = decideMergeReady(greenPr({ merge_state: "BEHIND" }), NO_ANDON);
    expect(d.ready).toBe(false);
    expect(d.reason).toBe("merge_state_BEHIND");
  });

  it("merge_state=BLOCKED（review 未齐/checks 未过）→ false", () => {
    const d = decideMergeReady(greenPr({ merge_state: "BLOCKED" }), NO_ANDON);
    expect(d.ready).toBe(false);
  });

  it("mergeable/merge_state 缺失（UNKNOWN）→ false，不误判为绿", () => {
    const d = decideMergeReady(greenPr({ mergeable: null, merge_state: null }), NO_ANDON);
    expect(d.ready).toBe(false);
    expect(d.reason).toBe("mergeable_unknown");
  });
});

describe("decideDispatch — ready-for-dev 派工判定", () => {
  const affinity = { "module:room": "agent-room-1" };
  const issue: IssueSnapshot = { number: 42, state: "open", labels: ["status:ready-for-dev", "module:room"], assignees: [] };

  it("无活跃租约 + 标签匹配 → 建议派工", () => {
    const d = decideDispatch(issue, [], affinity, "status:ready-for-dev");
    expect(d.shouldDispatch).toBe(true);
    expect(d.suggestedAssignee).toBe("agent-room-1");
  });

  it("已有活跃租约 → 不派工", () => {
    const leases: LeaseSnapshot[] = [
      { lease_id: "l1", resource_id: "issue:42", agent_id: "x", claimed_at: "t", last_heartbeat_at: "t", expires_at: "t2" },
    ];
    const d = decideDispatch(issue, leases, affinity, "status:ready-for-dev");
    expect(d.shouldDispatch).toBe(false);
    expect(d.reason).toBe("active_lease_exists");
  });

  it("缺 ready-for-dev 标签 → 不派工", () => {
    const d = decideDispatch({ ...issue, labels: ["module:room"] }, [], affinity, "status:ready-for-dev");
    expect(d.shouldDispatch).toBe(false);
    expect(d.reason).toBe("missing_ready_for_dev_label");
  });

  it("issue 已关闭 → 不派工", () => {
    const d = decideDispatch({ ...issue, state: "closed" }, [], affinity, "status:ready-for-dev");
    expect(d.shouldDispatch).toBe(false);
    expect(d.reason).toBe("issue_not_open");
  });

  it("无亲和表命中 → 不派工（宁可漏派不可乱派）", () => {
    const d = decideDispatch(issue, [], {}, "status:ready-for-dev");
    expect(d.shouldDispatch).toBe(false);
    expect(d.reason).toBe("no_affinity_match");
  });
});

describe("decidePrNudge — PR 超时催办判定", () => {
  const now = Date.parse("2026-07-19T12:00:00Z");

  it("等待超过阈值 → 催办", () => {
    const pr = greenPr({ opened_at: "2026-07-18T00:00:00Z" }); // 36h ago
    const d = decidePrNudge(pr, now, DEFAULT_THRESHOLDS.prNudgeMs);
    expect(d.shouldNudge).toBe(true);
  });

  it("等待未超阈值 → 不催办", () => {
    const pr = greenPr({ opened_at: "2026-07-19T06:00:00Z" }); // 6h ago
    const d = decidePrNudge(pr, now, DEFAULT_THRESHOLDS.prNudgeMs);
    expect(d.shouldNudge).toBe(false);
    expect(d.reason).toBe("within_threshold");
  });

  it("边界：恰好等于阈值 → 催办（>=）", () => {
    const pr = greenPr({ opened_at: new Date(now - DEFAULT_THRESHOLDS.prNudgeMs).toISOString() });
    const d = decidePrNudge(pr, now, DEFAULT_THRESHOLDS.prNudgeMs);
    expect(d.shouldNudge).toBe(true);
  });

  it("draft PR → 不催办", () => {
    const pr = greenPr({ merge_state: "DRAFT", opened_at: "2026-07-01T00:00:00Z" });
    const d = decidePrNudge(pr, now, DEFAULT_THRESHOLDS.prNudgeMs);
    expect(d.shouldNudge).toBe(false);
    expect(d.reason).toBe("draft_pr");
  });

  it("缺 opened_at → 不可判定，fail-closed 不催办", () => {
    const pr = greenPr({ opened_at: null });
    const d = decidePrNudge(pr, now, DEFAULT_THRESHOLDS.prNudgeMs);
    expect(d.shouldNudge).toBe(false);
    expect(d.reason).toBe("opened_at_unknown");
  });
});

describe("decideStaleLeaseReclaim — stale 租约回收判定", () => {
  const now = Date.parse("2026-07-19T12:00:00Z");

  it("心跳新鲜 + 未到期 → 不回收", () => {
    const lease: LeaseSnapshot = {
      lease_id: "l1", resource_id: "issue:1", agent_id: "a",
      claimed_at: "2026-07-19T11:00:00Z", last_heartbeat_at: "2026-07-19T11:58:00Z",
      expires_at: "2026-07-19T13:00:00Z",
    };
    const d = decideStaleLeaseReclaim(lease, now, DEFAULT_THRESHOLDS.staleHeartbeatMs);
    expect(d.shouldReclaim).toBe(false);
  });

  it("心跳静默超阈值 → 回收（软预警）", () => {
    const lease: LeaseSnapshot = {
      lease_id: "l2", resource_id: "issue:2", agent_id: "a",
      claimed_at: "2026-07-19T11:00:00Z", last_heartbeat_at: "2026-07-19T11:40:00Z", // 20min stale > 10min 阈值
      expires_at: "2026-07-19T14:00:00Z",
    };
    const d = decideStaleLeaseReclaim(lease, now, DEFAULT_THRESHOLDS.staleHeartbeatMs);
    expect(d.shouldReclaim).toBe(true);
    expect(d.reason).toBe("heartbeat_stale");
  });

  it("已过硬 TTL 到期时刻 → 回收（即使心跳看似新鲜）", () => {
    const lease: LeaseSnapshot = {
      lease_id: "l3", resource_id: "issue:3", agent_id: "a",
      claimed_at: "2026-07-19T09:00:00Z", last_heartbeat_at: "2026-07-19T11:59:00Z",
      expires_at: "2026-07-19T11:59:30Z",
    };
    const d = decideStaleLeaseReclaim(lease, now, DEFAULT_THRESHOLDS.staleHeartbeatMs);
    expect(d.shouldReclaim).toBe(true);
    expect(d.reason).toBe("past_hard_ttl_expiry");
  });
});

describe("decideAndonFreeze — andon 冻结判定", () => {
  it("未停线 → 不冻结", () => {
    expect(decideAndonFreeze(NO_ANDON).frozen).toBe(false);
  });

  it("停线中 → 冻结，reason 带 scope+reason", () => {
    const d = decideAndonFreeze(ACTIVE_ANDON);
    expect(d.frozen).toBe(true);
    expect(d.reason).toBe("repo:prod incident");
  });
});

describe("runShadowSopCycle — 汇总一次 tick", () => {
  it("andon 活跃时，全绿 PR 的 merge_ready 决策仍必须是 false（跨规则一致性）", () => {
    const decisions = runShadowSopCycle({
      prs: [greenPr()],
      issues: [],
      leases: [],
      andon: ACTIVE_ANDON,
      affinity: {},
      now: Date.parse("2026-07-19T12:00:00Z"),
    });
    const mergeDecision = decisions.find((d) => d.rule === "merge_ready" && d.subject_id === "pr:1");
    const freezeDecision = decisions.find((d) => d.rule === "andon_freeze");
    expect(mergeDecision?.decision).toBe(false);
    expect(freezeDecision?.decision).toBe(true);
  });

  it("覆盖全部五类规则各至少产出一条决策", () => {
    const decisions = runShadowSopCycle({
      prs: [greenPr()],
      issues: [{ number: 1, state: "open", labels: ["status:ready-for-dev", "module:room"], assignees: [] }],
      leases: [
        { lease_id: "l1", resource_id: "issue:2", agent_id: "a", claimed_at: "2026-07-19T00:00:00Z", last_heartbeat_at: "2026-07-19T00:00:00Z", expires_at: "2026-07-19T01:00:00Z" },
      ],
      andon: NO_ANDON,
      affinity: { "module:room": "agent-room-1" },
      now: Date.parse("2026-07-19T12:00:00Z"),
    });
    const rules = new Set(decisions.map((d) => d.rule));
    expect(rules).toEqual(new Set(["andon_freeze", "merge_ready", "pr_nudge", "dispatch_suggested", "stale_lease_reclaim"]));
  });
});
