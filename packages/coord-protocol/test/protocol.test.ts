// coord/0.1 校验器测试：每种消息 合法样例 + 非法样例（F02 verification 锚点）
import { describe, expect, it } from "vitest";
import {
  validateClaimRequest,
  validateLease,
  validateReleaseRequest,
  validateEvidenceManifest,
  validateVerificationVerdict,
  validateEvent,
  validateAndonAction,
  validateIntentRequest,
  PROTOCOL,
  EVENT_TYPES,
  INTENT_TYPES,
} from "../src/index";

const T = "2026-07-18T03:00:00Z";

const claim = () => ({
  protocol: PROTOCOL,
  resource_id: "issue:698",
  resource_type: "issue",
  agent_id: "wrk-coord-1",
  ttl_seconds: 21600,
});

const lease = () => ({
  protocol: PROTOCOL,
  lease_id: "lse_01J",
  resource_id: "feature:p29/F02",
  resource_type: "feature",
  agent_id: "wrk-coord-1",
  status: "in_progress",
  claimed_at: T,
  last_heartbeat_at: T,
  ttl_seconds: 21600,
  expires_at: "2026-07-18T09:00:00Z",
});

const manifest = () => ({
  protocol: PROTOCOL,
  manifest_id: "evm_01J",
  resource_id: "feature:p29/F02",
  agent_id: "wrk-coord-1",
  head_sha: "ee921c09",
  attestations: [
    {
      command: "pnpm --filter @repo/coord-protocol test",
      exit_code: 0,
      output_digest: "sha256:ab12cd34",
      output_excerpt: "Tests  12 passed (12)",
      log_url: "phases/phase-p29-coord-platform/evidence/F02.verify.log",
    },
  ],
  attested_at: T,
});

const verdict = () => ({
  protocol: PROTOCOL,
  verdict_id: "vrd_01J",
  manifest_id: "evm_01J",
  resource_id: "feature:p29/F02",
  verifier: { kind: "independent-rerun", agent_id: "rev-e2e" },
  head_sha: "ee921c09",
  verified: true,
  checks: [{ command: "pnpm test", claimed_exit: 0, rerun_exit: 0, match: true }],
  notes: "",
  verified_at: T,
});

const event = (type: string, payload: Record<string, unknown> = {}) => ({
  protocol: PROTOCOL,
  event_id: "evt_01J",
  type,
  repo: "boardx/boardx-dev-template",
  resource_id: "issue:698",
  agent_id: "wrk-coord-1",
  at: T,
  payload,
});

describe("ClaimRequest", () => {
  it("合法样例通过", () => {
    expect(validateClaimRequest(claim())).toEqual({ ok: true, errors: [] });
  });
  it("ttl_seconds 可省略", () => {
    const { ttl_seconds: _drop, ...rest } = claim();
    expect(validateClaimRequest(rest).ok).toBe(true);
  });
  it("拒绝错误 protocol / 非法 resource_id / 超限 ttl", () => {
    expect(validateClaimRequest({ ...claim(), protocol: "coord/9.9" }).ok).toBe(false);
    expect(validateClaimRequest({ ...claim(), resource_id: "banana" }).ok).toBe(false);
    expect(validateClaimRequest({ ...claim(), ttl_seconds: 999999 }).ok).toBe(false);
  });
  it("拒绝非对象输入", () => {
    expect(validateClaimRequest("nope").ok).toBe(false);
    expect(validateClaimRequest(null).ok).toBe(false);
  });
});

describe("Lease", () => {
  it("合法样例通过", () => {
    expect(validateLease(lease())).toEqual({ ok: true, errors: [] });
  });
  it("拒绝未知 status / 非 ISO 时间", () => {
    expect(validateLease({ ...lease(), status: "zombie" }).ok).toBe(false);
    expect(validateLease({ ...lease(), claimed_at: "yesterday" }).ok).toBe(false);
  });
});

describe("ReleaseRequest（handoff note 纪律）", () => {
  it("带充分交接说明的释放通过", () => {
    const r = validateReleaseRequest({
      protocol: PROTOCOL,
      agent_id: "wrk-coord-1",
      handoff_note: "F02 规格三份已落盘，测试 12 通过；剩 CHANGELOG 未写。",
    });
    expect(r.ok).toBe(true);
  });
  it("缺失或过短的 handoff_note 被拒（没有交接就不能放手）", () => {
    expect(
      validateReleaseRequest({ protocol: PROTOCOL, agent_id: "a" }).ok,
    ).toBe(false);
    expect(
      validateReleaseRequest({ protocol: PROTOCOL, agent_id: "a", handoff_note: "done" }).ok,
    ).toBe(false);
  });
});

describe("EvidenceManifest（证据纪律）", () => {
  it("合法样例通过", () => {
    expect(validateEvidenceManifest(manifest())).toEqual({ ok: true, errors: [] });
  });
  it("空 attestations 被拒（没有证据 = 没有完成）", () => {
    expect(validateEvidenceManifest({ ...manifest(), attestations: [] }).ok).toBe(false);
  });
  it("非零 exit_code 不构成有效声明", () => {
    const m = manifest();
    m.attestations[0]!.exit_code = 1;
    expect(validateEvidenceManifest(m).ok).toBe(false);
  });
  it("缺 head_sha 锚点被拒（P23 postmortem 铁律）", () => {
    expect(validateEvidenceManifest({ ...manifest(), head_sha: "" }).ok).toBe(false);
    expect(validateEvidenceManifest({ ...manifest(), head_sha: "not-a-sha!" }).ok).toBe(false);
  });
});

describe("VerificationVerdict", () => {
  it("合法样例通过", () => {
    expect(validateVerificationVerdict(verdict())).toEqual({ ok: true, errors: [] });
  });
  it("verified=false 时 notes 必填", () => {
    expect(validateVerificationVerdict({ ...verdict(), verified: false }).ok).toBe(false);
    expect(
      validateVerificationVerdict({
        ...verdict(),
        verified: false,
        notes: "第 1 条 rerun_exit=1 与声明不符",
      }).ok,
    ).toBe(true);
  });
  it("未知 verifier.kind 被拒", () => {
    expect(
      validateVerificationVerdict({ ...verdict(), verifier: { kind: "trust-me", agent_id: "x" } })
        .ok,
    ).toBe(false);
  });
});

const legalIntentPayload = (t: string): Record<string, unknown> => {
  switch (t) {
    case "intent.assign":
      return { target_agent_id: "wrk-t1", target_resource_id: "issue:698", note: null };
    case "intent.accept":
      return { note: "收到，开始处理" };
    case "intent.progress":
      return { summary: "F09 协议扩展已写完，跑测试中" };
    case "intent.blocker":
      return { reason: "CI 环境缺依赖，阻塞验证（issue #700）" };
    case "intent.escalate":
      return { reason: "需要人类确认拍板范围（issue #700）", escalated_to: "usam" };
    case "intent.decide":
      return { reason: "按方案 A 拍板通过", issue_ref: "#700", decision: "approved" };
    default:
      return {};
  }
};

describe("CoordEvent", () => {
  it("全部封闭集合类型均可通过（andon/task/workspace/intent 用合法 payload）", () => {
    for (const t of EVENT_TYPES) {
      const payload = t.startsWith("andon.")
        ? { scope: "repo", reason: "main 基础验证挂了，停线（issue #123）", severity: "stop-merge" }
        : t === "task.dispatched"
          ? { task_id: 1, assignee: "wrk-1", priority: "normal", deadline: null, note: null }
          : t.startsWith("task.")
            ? { task_id: 1 }
            : t === "requirement.advanced"
              ? { requirement_id: "req_01ABC", status: "analyzing" }
              : t.startsWith("requirement.")
                ? { requirement_id: "req_01ABC" }
                : t === "sprint.upserted"
                  ? { sprint: "p30/01", item_id: "F04" }
                  : t === "talk.posted"
                    ? { message_id: "tlk_01ABC" }
                    : t.startsWith("intent.")
                      ? legalIntentPayload(t)
                      : {};
      expect(validateEvent(event(t, payload)).ok, t).toBe(true);
    }
  });
  it("workspace 事件 payload 强校验（coord/0.1.3）：缺锚定字段/坏 status 被拒", () => {
    expect(validateEvent(event("requirement.submitted", {})).ok).toBe(false);
    expect(validateEvent(event("requirement.advanced", { requirement_id: "req_1" })).ok).toBe(false);
    expect(
      validateEvent(event("requirement.advanced", { requirement_id: "req_1", status: "shipped" })).ok,
    ).toBe(false);
    expect(
      validateEvent(event("requirement.advanced", { requirement_id: "req_1", status: "in_review" })).ok,
    ).toBe(true);
    expect(validateEvent(event("requirement.dispatched", { requirement_id: "req_1", issue: 42 })).ok).toBe(true);
    expect(validateEvent(event("sprint.upserted", { sprint: "p30/01" })).ok).toBe(false);
    expect(validateEvent(event("talk.posted", {})).ok).toBe(false);
    expect(validateEvent(event("talk.posted", { message_id: "tlk_1", needs_human: true })).ok).toBe(true);
  });
  it("task.* 缺 task_id / task.dispatched 缺 assignee 或坏 priority 被拒（coord/0.1.1）", () => {
    expect(validateEvent(event("task.acked", {})).ok).toBe(false);
    expect(validateEvent(event("task.completed", { task_id: 0 })).ok).toBe(false);
    expect(validateEvent(event("task.recalled", { task_id: 7 })).ok).toBe(true);
    expect(validateEvent(event("task.dispatched", { task_id: 1, priority: "normal" })).ok).toBe(false);
    expect(
      validateEvent(event("task.dispatched", { task_id: 1, assignee: "wrk-1", priority: "urgent" })).ok,
    ).toBe(false);
    expect(
      validateEvent(event("task.dispatched", { task_id: 1, assignee: "wrk-1", priority: "high" })).ok,
    ).toBe(true);
  });
  it("拒绝未知事件类型 / 非法 repo", () => {
    expect(validateEvent(event("lease.stolen")).ok).toBe(false);
    expect(validateEvent({ ...event("merge.completed"), repo: "not-a-repo" }).ok).toBe(false);
  });
  it("validateAndonAction（#723-3 单一出口）：与事件分支同一套 andon 规则", () => {
    const good = {
      action: "raise", agent_id: "coord-main", scope: "module:devportal",
      reason: "devportal 构建挂了，停线（issue #712）", severity: "stop-merge",
    };
    expect(validateAndonAction(good).ok).toBe(true);
    // clear 不要求 severity
    expect(validateAndonAction({ ...good, action: "clear", severity: undefined }).ok).toBe(true);
    expect(validateAndonAction({ ...good, action: "pause" }).ok).toBe(false);
    expect(validateAndonAction({ ...good, agent_id: "" }).ok).toBe(false);
    expect(validateAndonAction({ ...good, reason: "太短" }).ok).toBe(false);
    expect(validateAndonAction({ ...good, scope: "everywhere" }).ok).toBe(false);
    expect(validateAndonAction({ ...good, severity: "warn" }).ok).toBe(false);
    expect(validateAndonAction(null).ok).toBe(false);
  });

  it("andon.raised 缺 reason/scope/severity 被拒（停线要能追责）", () => {
    expect(validateEvent(event("andon.raised", { scope: "repo" })).ok).toBe(false);
    expect(
      validateEvent(
        event("andon.raised", { scope: "everywhere", reason: "长度足够的理由（#1）", severity: "stop-merge" }),
      ).ok,
    ).toBe(false);
    expect(
      validateEvent(
        event("andon.raised", { scope: "module:devportal", reason: "长度足够的理由（#1）", severity: "stop-merge" }),
      ).ok,
    ).toBe(true);
  });
});

describe("Intents（coord/0.1.3，p30/F09）", () => {
  it("intent.assign 缺 target_agent_id / 坏 target_resource_id 被拒", () => {
    expect(validateEvent(event("intent.assign", { note: null })).ok).toBe(false);
    expect(
      validateEvent(
        event("intent.assign", { target_agent_id: "wrk-t1", target_resource_id: "banana", note: null }),
      ).ok,
    ).toBe(false);
    expect(
      validateEvent(
        event("intent.assign", { target_agent_id: "wrk-t1", target_resource_id: "issue:698", note: null }),
      ).ok,
    ).toBe(true);
  });
  it("intent.accept 无强制字段：空 payload 也合法", () => {
    expect(validateEvent(event("intent.accept", {})).ok).toBe(true);
  });
  it("intent.progress 缺 summary 被拒", () => {
    expect(validateEvent(event("intent.progress", {})).ok).toBe(false);
    expect(validateEvent(event("intent.progress", { summary: "" })).ok).toBe(false);
    expect(validateEvent(event("intent.progress", { summary: "推进中" })).ok).toBe(true);
  });
  it("intent.blocker/escalate 的 reason 必须 ≥10 字符（与 andon 同规格）", () => {
    expect(validateEvent(event("intent.blocker", { reason: "太短" })).ok).toBe(false);
    expect(validateEvent(event("intent.blocker", { reason: "CI 环境缺依赖，阻塞验证（#700）" })).ok).toBe(true);
    expect(validateEvent(event("intent.escalate", { reason: "太短" })).ok).toBe(false);
    expect(
      validateEvent(event("intent.escalate", { reason: "需要人类确认拍板范围（#700）", escalated_to: null })).ok,
    ).toBe(true);
  });
  it("intent.decide 要求 reason≥10 + issue_ref 可查证锚点；decision 非法值被拒", () => {
    expect(validateEvent(event("intent.decide", { reason: "理由已经充分说明清楚且长度达标", issue_ref: "" })).ok).toBe(false);
    expect(
      validateEvent(event("intent.decide", { reason: "理由已经充分说明清楚且长度达标", issue_ref: "not-a-ref" })).ok,
    ).toBe(false);
    expect(
      validateEvent(
        event("intent.decide", { reason: "理由已经充分说明清楚且长度达标", issue_ref: "#700", decision: "maybe" }),
      ).ok,
    ).toBe(false);
    expect(
      validateEvent(
        event("intent.decide", {
          reason: "理由已经充分说明清楚且长度达标",
          issue_ref: "boardx/boardx-dev-template#700",
          decision: "approved",
        }),
      ).ok,
    ).toBe(true);
  });

  it("INTENT_TYPES 是 EVENT_TYPES 的子集（六类意图消息均已注册为事件类型）", () => {
    for (const t of INTENT_TYPES) expect(EVENT_TYPES).toContain(t);
    expect(INTENT_TYPES).toHaveLength(6);
  });

  const intentReq = (over: Record<string, unknown> = {}) => ({
    type: "intent.progress",
    resource_id: "issue:698",
    agent_id: "wrk-t1",
    payload: { summary: "推进中" },
    ...over,
  });

  it("validateIntentRequest：合法样例通过", () => {
    expect(validateIntentRequest(intentReq()).ok).toBe(true);
  });
  it("validateIntentRequest：未知 type / 缺 resource_id·agent_id / 非法 payload 被拒", () => {
    expect(validateIntentRequest(intentReq({ type: "intent.unknown" })).ok).toBe(false);
    expect(validateIntentRequest({ ...intentReq(), resource_id: undefined }).ok).toBe(false);
    expect(validateIntentRequest({ ...intentReq(), agent_id: "" }).ok).toBe(false);
    expect(validateIntentRequest(intentReq({ payload: { summary: "" } })).ok).toBe(false);
    expect(validateIntentRequest(intentReq({ payload: "not-an-object" })).ok).toBe(false);
    expect(validateIntentRequest(null).ok).toBe(false);
  });
  it("validateIntentRequest：intent.decide 的 issue_ref/reason 规则同 validateEvent 分支（单一出口）", () => {
    expect(
      validateIntentRequest(
        intentReq({
          type: "intent.decide",
          payload: { reason: "太短", issue_ref: "#1" },
        }),
      ).ok,
    ).toBe(false);
    expect(
      validateIntentRequest(
        intentReq({
          type: "intent.decide",
          payload: { reason: "理由已经充分说明清楚且长度达标", issue_ref: "#700", decision: "approved" },
        }),
      ).ok,
    ).toBe(true);
  });
});
