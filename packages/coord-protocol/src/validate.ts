// coord/0.1 运行时校验器。零依赖（工作区惯例），返回结构化错误而非抛异常——
// 网关层直接把 errors 映射为 4xx body。
import {
  PROTOCOL,
  EVENT_TYPES,
  INTENT_TYPES,
  LEASE_TTL_MAX_SECONDS,
  HANDOFF_NOTE_MIN_LENGTH,
  REQUIREMENT_STATUSES,
  type ValidationResult,
  type EventType,
  type IntentType,
} from "./types";

type Obj = Record<string, unknown>;

const RESOURCE_TYPES = new Set(["feature", "issue", "coordinator-role", "module", "custom"]);
const LEASE_STATUSES = new Set(["in_progress", "released", "expired"]);
const VERIFIER_KINDS = new Set(["independent-rerun", "reviewer-attest", "ci"]);
const TASK_PRIORITIES = new Set(["high", "normal", "low"]);
const EVENT_TYPE_SET = new Set<string>(EVENT_TYPES);
const REQUIREMENT_STATUS_SET = new Set<string>(REQUIREMENT_STATUSES);
const INTENT_TYPE_SET = new Set<string>(INTENT_TYPES);
const INTENT_DECISIONS = new Set(["approved", "rejected", "changes_requested"]);

const RESOURCE_ID_RE = /^(feature:[\w.-]+\/F\d{2,}|issue:\d+|role:[\w-]+|module:[\w-]+|custom:[\w:./-]+)$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const SHA_RE = /^[0-9a-f]{7,40}$/;
const DIGEST_RE = /^sha256:[0-9a-f]{8,64}$/;
const REPO_RE = /^[\w.-]+\/[\w.-]+$/;
// decide 的可查证锚点：#123（仓内）或 owner/repo#123（跨仓引用）
const ISSUE_REF_RE = /^(#\d+|[\w.-]+\/[\w.-]+#\d+)$/;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

class Check {
  errors: string[] = [];
  constructor(private o: Obj) {}

  protocol(): this {
    if (this.o["protocol"] !== PROTOCOL) this.errors.push(`protocol 必须是 "${PROTOCOL}"`);
    return this;
  }
  str(field: string, opts: { min?: number; re?: RegExp; reHint?: string } = {}): this {
    const v = this.o[field];
    if (typeof v !== "string" || v.length === 0) {
      this.errors.push(`${field} 必须是非空字符串`);
      return this;
    }
    if (opts.min !== undefined && v.length < opts.min)
      this.errors.push(`${field} 长度必须 ≥${opts.min}`);
    if (opts.re && !opts.re.test(v))
      this.errors.push(`${field} 格式非法${opts.reHint ? `（${opts.reHint}）` : ""}`);
    return this;
  }
  oneOf(field: string, allowed: Set<string>): this {
    const v = this.o[field];
    if (typeof v !== "string" || !allowed.has(v))
      this.errors.push(`${field} 必须是 ${[...allowed].join(" | ")} 之一`);
    return this;
  }
  int(field: string, opts: { min?: number; max?: number; optional?: boolean } = {}): this {
    const v = this.o[field];
    if (v === undefined) {
      if (!opts.optional) this.errors.push(`${field} 必填`);
      return this;
    }
    if (typeof v !== "number" || !Number.isInteger(v)) {
      this.errors.push(`${field} 必须是整数`);
      return this;
    }
    if (opts.min !== undefined && v < opts.min) this.errors.push(`${field} 必须 ≥${opts.min}`);
    if (opts.max !== undefined && v > opts.max) this.errors.push(`${field} 必须 ≤${opts.max}`);
    return this;
  }
  bool(field: string): this {
    if (typeof this.o[field] !== "boolean") this.errors.push(`${field} 必须是布尔值`);
    return this;
  }
  result(): ValidationResult {
    return { ok: this.errors.length === 0, errors: this.errors };
  }
}

function guard(input: unknown): [Check | null, ValidationResult | null] {
  if (!isObj(input)) return [null, { ok: false, errors: ["消息必须是 JSON 对象"] }];
  return [new Check(input), null];
}

// ---- andon 规则单一出口（events.md §Andon 是语义权威）----
// reason≥10（须含可查证锚点）、scope ∈ repo|module:<name>、raise 时 severity
// 必须 stop-merge。validateEvent 的 andon 分支与 RepoHub DO 的 /andon 请求
// 校验（validateAndonAction）都走这里——曾经两处手写同一套规则（#723-3），
// 现在只许在此改。
function andonRuleErrors(o: Obj, requireSeverity: boolean): string[] {
  const errors: string[] = [];
  const reason = o["reason"];
  if (typeof reason !== "string" || reason.length < 10)
    errors.push("reason 长度必须 ≥10（须含可查证锚点）");
  const scope = o["scope"];
  if (typeof scope !== "string" || !(scope === "repo" || /^module:[\w-]+$/.test(scope)))
    errors.push("scope 必须是 repo 或 module:<name>");
  if (requireSeverity && o["severity"] !== "stop-merge")
    errors.push('severity 必须是 "stop-merge"');
  return errors;
}

// RepoHub DO `/andon` 动作请求（{action, agent_id, reason, scope[, severity]}）
// 的校验单一出口。与事件 payload 的差异仅在信封字段（action/agent_id）。
export function validateAndonAction(input: unknown): ValidationResult {
  if (!isObj(input)) return { ok: false, errors: ["消息必须是 JSON 对象"] };
  const o = input as Obj;
  const errors: string[] = [];
  const action = o["action"];
  if (action !== "raise" && action !== "clear") errors.push('action 必须是 "raise" | "clear"');
  if (typeof o["agent_id"] !== "string" || o["agent_id"].length === 0)
    errors.push("agent_id 必须是非空字符串");
  errors.push(...andonRuleErrors(o, action === "raise"));
  return { ok: errors.length === 0, errors };
}

// ---- intent.* payload 规则单一出口（events.md §Intents 是语义权威）----
// 与 andonRuleErrors 同模式：validateEvent 的 intent 分支与 validateIntentRequest
// （RepoHub POST /intents 的请求体校验）都走这里，只许在此改一处。
function intentPayloadErrors(type: string, p: Obj): string[] {
  const c = new Check(p);
  switch (type as IntentType) {
    case "intent.assign":
      c.str("target_agent_id").str("target_resource_id", {
        re: RESOURCE_ID_RE,
        reHint: "见 lease.md 资源命名",
      });
      break;
    case "intent.accept":
      break; // 无强制字段；note 可选
    case "intent.progress":
      c.str("summary", { min: 1 });
      break;
    case "intent.blocker":
    case "intent.escalate":
      // reason 规格与 andon 同（≥10 字符，须含可查证锚点）；不复用 andonRuleErrors——
      // 那是 andon 专属出口（scope/severity 字段与本类型不同），此处保持 intent 自己的
      // 单一出口，字段集不同不应共享校验函数。
      c.str("reason", { min: 10 });
      break;
    case "intent.decide":
      c.str("reason", { min: 10 }).str("issue_ref", {
        re: ISSUE_REF_RE,
        reHint: "如 #123 或 owner/repo#123",
      });
      if (typeof p["decision"] === "string" && !INTENT_DECISIONS.has(p["decision"]))
        c.errors.push("decision 必须是 approved | rejected | changes_requested 之一（或省略）");
      break;
  }
  return c.errors;
}

/** RepoHub DO `POST /intents` 请求体（{type, resource_id, agent_id, payload}）校验单一出口。
 *  与事件 payload 的差异仅在信封字段（缺 protocol/event_id/at——由 DO emit 时生成）。 */
export function validateIntentRequest(input: unknown): ValidationResult {
  if (!isObj(input)) return { ok: false, errors: ["消息必须是 JSON 对象"] };
  const o = input as Obj;
  const type = o["type"];
  if (typeof type !== "string" || !INTENT_TYPE_SET.has(type))
    return { ok: false, errors: [`type 必须是 ${[...INTENT_TYPE_SET].join(" | ")} 之一`] };
  const c = new Check(o)
    .str("resource_id", { re: RESOURCE_ID_RE, reHint: "见 lease.md 资源命名" })
    .str("agent_id");
  if (!isObj(o["payload"])) {
    c.errors.push("payload 必须是对象");
  } else {
    intentPayloadErrors(type, o["payload"] as Obj).forEach((e) => c.errors.push(`payload.${e}`));
  }
  return c.result();
}

export function validateClaimRequest(input: unknown): ValidationResult {
  const [c, bad] = guard(input);
  if (!c) return bad!;
  return c
    .protocol()
    .str("resource_id", { re: RESOURCE_ID_RE, reHint: "见 lease.md 资源命名" })
    .oneOf("resource_type", RESOURCE_TYPES)
    .str("agent_id")
    .int("ttl_seconds", { min: 60, max: LEASE_TTL_MAX_SECONDS, optional: true })
    .result();
}

export function validateLease(input: unknown): ValidationResult {
  const [c, bad] = guard(input);
  if (!c) return bad!;
  return c
    .protocol()
    .str("lease_id")
    .str("resource_id", { re: RESOURCE_ID_RE })
    .oneOf("resource_type", RESOURCE_TYPES)
    .str("agent_id")
    .oneOf("status", LEASE_STATUSES)
    .str("claimed_at", { re: ISO_RE, reHint: "ISO 8601" })
    .str("last_heartbeat_at", { re: ISO_RE, reHint: "ISO 8601" })
    .int("ttl_seconds", { min: 60, max: LEASE_TTL_MAX_SECONDS })
    .str("expires_at", { re: ISO_RE, reHint: "ISO 8601" })
    .result();
}

export function validateReleaseRequest(input: unknown): ValidationResult {
  const [c, bad] = guard(input);
  if (!c) return bad!;
  return c
    .protocol()
    .str("agent_id")
    .str("handoff_note", { min: HANDOFF_NOTE_MIN_LENGTH })
    .result();
}

export function validateEvidenceManifest(input: unknown): ValidationResult {
  const [c, bad] = guard(input);
  if (!c) return bad!;
  const r = c
    .protocol()
    .str("manifest_id")
    .str("resource_id", { re: RESOURCE_ID_RE })
    .str("agent_id")
    .str("head_sha", { re: SHA_RE, reHint: "7-40 位十六进制 commit SHA" })
    .str("attested_at", { re: ISO_RE, reHint: "ISO 8601" });
  const atts = (input as Obj)["attestations"];
  if (!Array.isArray(atts) || atts.length === 0) {
    r.errors.push("attestations 必须是非空数组");
  } else {
    atts.forEach((a, i) => {
      if (!isObj(a)) {
        r.errors.push(`attestations[${i}] 必须是对象`);
        return;
      }
      const ac = new Check(a)
        .str("command")
        .int("exit_code", { min: 0, max: 255 })
        .str("output_digest", { re: DIGEST_RE, reHint: "sha256:<hex>" })
        .str("output_excerpt", { min: 1 })
        .str("log_url");
      ac.errors.forEach((e) => r.errors.push(`attestations[${i}].${e}`));
      if (typeof a["exit_code"] === "number" && a["exit_code"] !== 0)
        r.errors.push(`attestations[${i}].exit_code 必须为 0 才构成有效声明`);
    });
  }
  return r.result();
}

export function validateVerificationVerdict(input: unknown): ValidationResult {
  const [c, bad] = guard(input);
  if (!c) return bad!;
  const o = input as Obj;
  const r = c
    .protocol()
    .str("verdict_id")
    .str("manifest_id")
    .str("resource_id", { re: RESOURCE_ID_RE })
    .str("head_sha", { re: SHA_RE })
    .bool("verified")
    .str("verified_at", { re: ISO_RE, reHint: "ISO 8601" });
  if (!isObj(o["verifier"])) {
    r.errors.push("verifier 必须是对象");
  } else {
    const vc = new Check(o["verifier"] as Obj).oneOf("kind", VERIFIER_KINDS).str("agent_id");
    vc.errors.forEach((e) => r.errors.push(`verifier.${e}`));
  }
  if (!Array.isArray(o["checks"])) r.errors.push("checks 必须是数组");
  if (o["verified"] === false) {
    const notes = o["notes"];
    if (typeof notes !== "string" || notes.length === 0)
      r.errors.push("verified=false 时 notes 必填");
  }
  return r.result();
}

export function validateEvent(input: unknown): ValidationResult {
  const [c, bad] = guard(input);
  if (!c) return bad!;
  const o = input as Obj;
  const r = c
    .protocol()
    .str("event_id")
    .oneOf("type", EVENT_TYPE_SET)
    .str("repo", { re: REPO_RE, reHint: "owner/name" })
    .str("resource_id")
    .str("agent_id")
    .str("at", { re: ISO_RE, reHint: "ISO 8601" });
  if (!isObj(o["payload"])) r.errors.push("payload 必须是对象");

  // andon 特权事件的 payload 强校验（规则单一出口：andonRuleErrors）
  const type = o["type"] as EventType;
  if ((type === "andon.raised" || type === "andon.cleared") && isObj(o["payload"])) {
    andonRuleErrors(o["payload"] as Obj, type === "andon.raised")
      .forEach((e) => r.errors.push(`payload.${e}`));
  }

  // task.* 事件的 payload 强校验（coord/0.1.1，events.md §Tasks）
  if (type.startsWith("task.") && isObj(o["payload"])) {
    const p = o["payload"] as Obj;
    const pc = new Check(p).int("task_id", { min: 1 });
    if (type === "task.dispatched") {
      pc.str("assignee").oneOf("priority", TASK_PRIORITIES);
    }
    pc.errors.forEach((e) => r.errors.push(`payload.${e}`));
  }

  // 工作区分片事件的 payload 强校验（coord/0.1.3，events.md §Workspace，p30/F04）
  if (isObj(o["payload"])) {
    const p = o["payload"] as Obj;
    if (type.startsWith("requirement.")) {
      const pc = new Check(p).str("requirement_id");
      if (type === "requirement.advanced") pc.oneOf("status", REQUIREMENT_STATUS_SET);
      pc.errors.forEach((e) => r.errors.push(`payload.${e}`));
    }
    if (type === "sprint.upserted") {
      const pc = new Check(p).str("sprint").str("item_id");
      pc.errors.forEach((e) => r.errors.push(`payload.${e}`));
    }
    if (type === "talk.posted") {
      const pc = new Check(p).str("message_id");
      pc.errors.forEach((e) => r.errors.push(`payload.${e}`));
    }
  }

  // intent.* 事件的 payload 强校验（coord/0.1.4，events.md §Intents，单一出口 intentPayloadErrors）
  if (type.startsWith("intent.") && isObj(o["payload"])) {
    intentPayloadErrors(type, o["payload"] as Obj).forEach((e) => r.errors.push(`payload.${e}`));
  }
  return r.result();
}
