// coord/0.1 运行时校验器。零依赖（工作区惯例），返回结构化错误而非抛异常——
// 网关层直接把 errors 映射为 4xx body。
import {
  PROTOCOL,
  EVENT_TYPES,
  LEASE_TTL_MAX_SECONDS,
  HANDOFF_NOTE_MIN_LENGTH,
  type ValidationResult,
  type EventType,
} from "./types";

type Obj = Record<string, unknown>;

const RESOURCE_TYPES = new Set(["feature", "issue", "coordinator-role", "module", "custom"]);
const LEASE_STATUSES = new Set(["in_progress", "released", "expired"]);
const VERIFIER_KINDS = new Set(["independent-rerun", "reviewer-attest", "ci"]);
const TASK_PRIORITIES = new Set(["high", "normal", "low"]);
const EVENT_TYPE_SET = new Set<string>(EVENT_TYPES);

const RESOURCE_ID_RE = /^(feature:[\w.-]+\/F\d{2,}|issue:\d+|role:[\w-]+|module:[\w-]+|custom:[\w:./-]+)$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const SHA_RE = /^[0-9a-f]{7,40}$/;
const DIGEST_RE = /^sha256:[0-9a-f]{8,64}$/;
const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

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

  // andon 特权事件的 payload 强校验（events.md §Andon）
  const type = o["type"] as EventType;
  if ((type === "andon.raised" || type === "andon.cleared") && isObj(o["payload"])) {
    const p = o["payload"] as Obj;
    const pc = new Check(p).str("reason", { min: 10 });
    const scope = p["scope"];
    if (typeof scope !== "string" || !(scope === "repo" || /^module:[\w-]+$/.test(scope)))
      pc.errors.push("scope 必须是 repo 或 module:<name>");
    if (type === "andon.raised" && p["severity"] !== "stop-merge")
      pc.errors.push('severity 必须是 "stop-merge"');
    pc.errors.forEach((e) => r.errors.push(`payload.${e}`));
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
  return r.result();
}
