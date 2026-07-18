import {
  HARNESS_PROTOCOL,
  RUN_EVENT_TYPES,
  type ValidationResult,
} from "./types";

type Obj = Record<string, unknown>;

const ACCEPTANCE_KINDS = new Set(["command", "test", "review", "policy"]);
const ARTIFACT_KINDS = new Set(["log", "trace", "report", "snapshot", "patch", "other"]);
const EVENT_TYPES = new Set<string>(RUN_EVENT_TYPES);
const RESULTS = new Set(["passed", "failed"]);
const RUN_STATUSES = new Set(["pending", "running", "waiting", "completed", "failed", "cancelled"]);
const STEP_KINDS = new Set(["model", "tool", "human", "evaluation", "system"]);
const STEP_STATUSES = new Set(["pending", "running", "completed", "failed", "cancelled"]);
const EVALUATION_STATUSES = new Set(["passed", "failed", "error", "skipped"]);
const SHA_RE = /^[0-9a-f]{7,64}$/i;
const DIGEST_RE = /^sha256:[0-9a-f]{64}$/i;

function isObject(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function result(errors: string[]): ValidationResult {
  return { ok: errors.length === 0, errors };
}

function requireObject(value: unknown, path: string, errors: string[]): Obj | null {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return null;
  }
  return value;
}

function requireString(
  value: unknown,
  path: string,
  errors: string[],
  message = `${path} must be a non-empty string`,
): value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(message);
    return false;
  }
  return true;
}

function requireInteger(
  value: unknown,
  path: string,
  errors: string[],
  minimum: number,
): value is number {
  if (!Number.isInteger(value) || (value as number) < minimum) {
    errors.push(`${path} must be an integer >= ${minimum}`);
    return false;
  }
  return true;
}

function requireProtocol(value: unknown, errors: string[]): void {
  if (value !== HARNESS_PROTOCOL) {
    errors.push(`protocol must be "${HARNESS_PROTOCOL}"`);
  }
}

function requireCommit(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "string" || !SHA_RE.test(value)) {
    errors.push(`${path} must be a 7-64 character hexadecimal commit SHA`);
  }
}

function requireDigest(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "string" || !DIGEST_RE.test(value)) {
    errors.push(`${path} must be a sha256 digest`);
  }
}

function requireIsoDate(value: unknown, path: string, errors: string[]): void {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    Number.isNaN(Date.parse(value))
  ) {
    errors.push(`${path} must be an ISO 8601 timestamp`);
  }
}

function validateFeatureRef(value: unknown, errors: string[], path: string): void {
  const feature = requireObject(value, path, errors);
  if (!feature) return;
  requireString(feature["id"], `${path}.id`, errors);
  requireInteger(feature["revision"], `${path}.revision`, errors, 1);
  requireDigest(feature["spec_digest"], `${path}.spec_digest`, errors);
}

function validateAcceptance(value: unknown, errors: string[]): void {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push("acceptance must contain at least one criterion");
    return;
  }

  value.forEach((entry, index) => {
    const path = `acceptance[${index}]`;
    const criterion = requireObject(entry, path, errors);
    if (!criterion) return;
    requireString(criterion["criterion_id"], `${path}.criterion_id`, errors);
    if (typeof criterion["kind"] !== "string" || !ACCEPTANCE_KINDS.has(criterion["kind"])) {
      errors.push(`${path}.kind must be command, test, review, or policy`);
    }
    requireString(criterion["description"], `${path}.description`, errors);
    if (
      criterion["target"] !== undefined &&
      (typeof criterion["target"] !== "string" || criterion["target"].trim().length === 0)
    ) {
      errors.push(`${path}.target must be a non-empty string when provided`);
    }
  });
}

function validateArtifact(value: unknown, errors: string[], path: string): void {
  const artifact = requireObject(value, path, errors);
  if (!artifact) return;
  requireString(artifact["artifact_id"], `${path}.artifact_id`, errors);
  if (typeof artifact["kind"] !== "string" || !ARTIFACT_KINDS.has(artifact["kind"])) {
    errors.push(`${path}.kind must be a supported artifact kind`);
  }
  requireDigest(artifact["digest"], `${path}.digest`, errors);
  requireString(artifact["uri"], `${path}.uri`, errors);
  requireString(artifact["media_type"], `${path}.media_type`, errors);
  if (
    artifact["size_bytes"] !== undefined &&
    (!Number.isInteger(artifact["size_bytes"]) || (artifact["size_bytes"] as number) < 0)
  ) {
    errors.push(`${path}.size_bytes must be an integer >= 0 when provided`);
  }
}

function validateSubject(value: unknown, errors: string[], path: string): void {
  const subject = requireObject(value, path, errors);
  if (!subject) return;
  requireString(subject["feature_id"], `${path}.feature_id`, errors);
  requireInteger(subject["feature_revision"], `${path}.feature_revision`, errors, 1);
  requireCommit(subject["commit_sha"], `${path}.commit_sha`, errors);
}

function requireClosedSet(
  value: unknown,
  allowed: Set<string>,
  path: string,
  errors: string[],
  message: string,
): void {
  if (typeof value !== "string" || !allowed.has(value)) {
    errors.push(`${path} ${message}`);
  }
}

function validateTimeOrder(
  started: unknown,
  completed: unknown,
  path: string,
  errors: string[],
): void {
  if (
    typeof started === "string" &&
    typeof completed === "string" &&
    !Number.isNaN(Date.parse(started)) &&
    !Number.isNaN(Date.parse(completed)) &&
    Date.parse(completed) < Date.parse(started)
  ) {
    errors.push(`${path} must not be earlier than the start time`);
  }
}

export function validateTaskSpec(input: unknown): ValidationResult {
  const errors: string[] = [];
  const task = requireObject(input, "task", errors);
  if (!task) return result(errors);

  requireProtocol(task["protocol"], errors);
  requireString(task["task_id"], "task_id", errors);
  validateFeatureRef(task["feature"], errors, "feature");
  requireString(task["goal"], "goal", errors);
  validateAcceptance(task["acceptance"], errors);
  requireCommit(task["base_commit"], "base_commit", errors);
  requireIsoDate(task["created_at"], "created_at", errors);
  if (task["metadata"] !== undefined && !isObject(task["metadata"])) {
    errors.push("metadata must be an object when provided");
  }

  return result(errors);
}

export function validateRunEvent(input: unknown): ValidationResult {
  const errors: string[] = [];
  const event = requireObject(input, "event", errors);
  if (!event) return result(errors);

  requireProtocol(event["protocol"], errors);
  requireString(event["event_id"], "event_id", errors);
  requireString(event["run_id"], "run_id", errors);
  requireString(event["task_id"], "task_id", errors);
  requireInteger(event["sequence"], "sequence", errors, 0);
  if (typeof event["type"] !== "string" || !EVENT_TYPES.has(event["type"])) {
    errors.push("type must be a supported run event type");
  }
  requireIsoDate(event["at"], "at", errors);
  requireString(event["idempotency_key"], "idempotency_key", errors);
  requireObject(event["payload"], "payload", errors);

  return result(errors);
}

export function validateRun(input: unknown): ValidationResult {
  const errors: string[] = [];
  const run = requireObject(input, "run", errors);
  if (!run) return result(errors);

  requireProtocol(run["protocol"], errors);
  requireString(run["run_id"], "run_id", errors);
  requireString(run["task_id"], "task_id", errors);
  requireInteger(run["attempt"], "attempt", errors, 1);
  requireClosedSet(
    run["status"],
    RUN_STATUSES,
    "status",
    errors,
    "must be a supported run status",
  );
  requireCommit(run["base_commit"], "base_commit", errors);
  if (run["head_commit"] !== undefined) {
    requireCommit(run["head_commit"], "head_commit", errors);
  }
  if (run["workspace_id"] !== undefined) {
    requireString(run["workspace_id"], "workspace_id", errors);
  }
  requireIsoDate(run["created_at"], "created_at", errors);
  requireIsoDate(run["updated_at"], "updated_at", errors);
  validateTimeOrder(run["created_at"], run["updated_at"], "updated_at", errors);

  return result(errors);
}

export function validateStep(input: unknown): ValidationResult {
  const errors: string[] = [];
  const step = requireObject(input, "step", errors);
  if (!step) return result(errors);

  requireString(step["step_id"], "step_id", errors);
  requireString(step["run_id"], "run_id", errors);
  requireInteger(step["sequence"], "sequence", errors, 0);
  requireClosedSet(step["kind"], STEP_KINDS, "kind", errors, "must be a supported step kind");
  requireClosedSet(
    step["status"],
    STEP_STATUSES,
    "status",
    errors,
    "must be a supported step status",
  );
  requireIsoDate(step["started_at"], "started_at", errors);
  if (step["completed_at"] !== undefined) {
    requireIsoDate(step["completed_at"], "completed_at", errors);
    validateTimeOrder(step["started_at"], step["completed_at"], "completed_at", errors);
  }
  if (step["error"] !== undefined && !isObject(step["error"])) {
    errors.push("error must be an object when provided");
  }

  return result(errors);
}

export function validateArtifactRef(input: unknown): ValidationResult {
  const errors: string[] = [];
  validateArtifact(input, errors, "artifact");
  return result(errors);
}

export function validateEvaluationResult(input: unknown): ValidationResult {
  const errors: string[] = [];
  const evaluation = requireObject(input, "evaluation", errors);
  if (!evaluation) return result(errors);

  requireProtocol(evaluation["protocol"], errors);
  requireString(evaluation["evaluation_id"], "evaluation_id", errors);
  requireString(evaluation["run_id"], "run_id", errors);
  validateSubject(evaluation["subject"], errors, "subject");

  const evaluator = requireObject(evaluation["evaluator"], "evaluator", errors);
  if (evaluator) {
    requireString(evaluator["name"], "evaluator.name", errors);
    requireString(evaluator["version"], "evaluator.version", errors);
  }

  requireClosedSet(
    evaluation["status"],
    EVALUATION_STATUSES,
    "status",
    errors,
    "must be a supported evaluation status",
  );

  const checks = evaluation["checks"];
  if (!Array.isArray(checks)) {
    errors.push("checks must be an array");
  } else {
    checks.forEach((value, index) => {
      const path = `checks[${index}]`;
      const check = requireObject(value, path, errors);
      if (!check) return;
      requireString(check["check_id"], `${path}.check_id`, errors);
      requireClosedSet(
        check["status"],
        EVALUATION_STATUSES,
        `${path}.status`,
        errors,
        "must be a supported evaluation status",
      );
      if (
        check["duration_ms"] !== undefined &&
        (!Number.isInteger(check["duration_ms"]) || (check["duration_ms"] as number) < 0)
      ) {
        errors.push(`${path}.duration_ms must be an integer >= 0 when provided`);
      }
      if (check["artifact_refs"] !== undefined) {
        if (!Array.isArray(check["artifact_refs"])) {
          errors.push(`${path}.artifact_refs must be an array when provided`);
        } else {
          check["artifact_refs"].forEach((artifact, artifactIndex) =>
            validateArtifact(artifact, errors, `${path}.artifact_refs[${artifactIndex}]`),
          );
        }
      }
    });
  }

  const artifacts = evaluation["artifact_refs"];
  if (!Array.isArray(artifacts)) {
    errors.push("artifact_refs must be an array");
  } else {
    artifacts.forEach((artifact, index) =>
      validateArtifact(artifact, errors, `artifact_refs[${index}]`),
    );
  }

  requireIsoDate(evaluation["started_at"], "started_at", errors);
  requireIsoDate(evaluation["completed_at"], "completed_at", errors);
  validateTimeOrder(
    evaluation["started_at"],
    evaluation["completed_at"],
    "completed_at",
    errors,
  );

  return result(errors);
}

export function validateEvaluationAttestation(input: unknown): ValidationResult {
  const errors: string[] = [];
  const attestation = requireObject(input, "attestation", errors);
  if (!attestation) return result(errors);

  requireProtocol(attestation["protocol"], errors);
  requireString(attestation["attestation_id"], "attestation_id", errors);
  requireString(attestation["evaluation_id"], "evaluation_id", errors);
  requireString(attestation["run_id"], "run_id", errors);
  validateSubject(attestation["subject"], errors, "subject");

  const attestationResult = attestation["result"];
  if (typeof attestationResult !== "string" || !RESULTS.has(attestationResult)) {
    errors.push("result must be passed or failed");
  }

  const environment = requireObject(attestation["environment"], "environment", errors);
  if (environment) {
    requireString(environment["name"], "environment.name", errors);
    requireDigest(environment["digest"], "environment.digest", errors);
  }

  const verifier = requireObject(attestation["verifier"], "verifier", errors);
  if (verifier) {
    requireString(verifier["name"], "verifier.name", errors);
    requireString(verifier["version"], "verifier.version", errors);
  }

  const artifacts = attestation["artifact_refs"];
  if (!Array.isArray(artifacts)) {
    errors.push("artifact_refs must be an array");
  } else {
    if (attestationResult === "passed" && artifacts.length === 0) {
      errors.push("artifact_refs must contain at least one artifact when result is passed");
    }
    artifacts.forEach((artifact, index) =>
      validateArtifact(artifact, errors, `artifact_refs[${index}]`),
    );
  }

  requireIsoDate(attestation["issued_at"], "issued_at", errors);
  return result(errors);
}
