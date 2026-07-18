export const HARNESS_PROTOCOL = "harness/2.0" as const;

export const RUN_EVENT_TYPES = [
  "run.created",
  "run.started",
  "step.started",
  "tool.called",
  "tool.completed",
  "artifact.recorded",
  "checkpoint.saved",
  "run.waiting",
  "run.resumed",
  "run.completed",
  "run.failed",
  "run.cancelled",
  "evaluation.completed",
] as const;

export type RunEventType = (typeof RUN_EVENT_TYPES)[number];
export type RunStatus =
  | "pending"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled";
export type StepKind = "model" | "tool" | "human" | "evaluation" | "system";
export type StepStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type AcceptanceKind = "command" | "test" | "review" | "policy";
export type ArtifactKind = "log" | "trace" | "report" | "snapshot" | "patch" | "other";
export type EvaluationStatus = "passed" | "failed" | "error" | "skipped";

export interface ValidationResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

export interface FeatureRef {
  readonly id: string;
  readonly revision: number;
  readonly spec_digest: string;
}

export interface AcceptanceCriterion {
  readonly criterion_id: string;
  readonly kind: AcceptanceKind;
  readonly description: string;
  readonly target?: string;
}

export interface TaskSpec {
  readonly protocol: typeof HARNESS_PROTOCOL;
  readonly task_id: string;
  readonly feature: FeatureRef;
  readonly goal: string;
  readonly acceptance: readonly AcceptanceCriterion[];
  readonly base_commit: string;
  readonly created_at: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface Run {
  readonly protocol: typeof HARNESS_PROTOCOL;
  readonly run_id: string;
  readonly task_id: string;
  readonly attempt: number;
  readonly status: RunStatus;
  readonly base_commit: string;
  readonly workspace_id?: string;
  readonly head_commit?: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface Step {
  readonly step_id: string;
  readonly run_id: string;
  readonly sequence: number;
  readonly kind: StepKind;
  readonly status: StepStatus;
  readonly started_at: string;
  readonly completed_at?: string;
  readonly input?: unknown;
  readonly output?: unknown;
  readonly error?: Readonly<Record<string, unknown>>;
}

export interface ArtifactRef {
  readonly artifact_id: string;
  readonly kind: ArtifactKind;
  readonly digest: string;
  readonly uri: string;
  readonly media_type: string;
  readonly size_bytes?: number;
}

export interface EvaluationSubject {
  readonly feature_id: string;
  readonly feature_revision: number;
  readonly commit_sha: string;
}

export interface EvaluationCheck {
  readonly check_id: string;
  readonly status: EvaluationStatus;
  readonly duration_ms?: number;
  readonly artifact_refs?: readonly ArtifactRef[];
}

export interface EvaluationResult {
  readonly protocol: typeof HARNESS_PROTOCOL;
  readonly evaluation_id: string;
  readonly run_id: string;
  readonly subject: EvaluationSubject;
  readonly evaluator: {
    readonly name: string;
    readonly version: string;
  };
  readonly status: EvaluationStatus;
  readonly checks: readonly EvaluationCheck[];
  readonly artifact_refs: readonly ArtifactRef[];
  readonly started_at: string;
  readonly completed_at: string;
}

export interface EvaluationAttestation {
  readonly protocol: typeof HARNESS_PROTOCOL;
  readonly attestation_id: string;
  readonly evaluation_id: string;
  readonly run_id: string;
  readonly subject: EvaluationSubject;
  readonly result: "passed" | "failed";
  readonly environment: {
    readonly name: string;
    readonly digest: string;
  };
  readonly verifier: {
    readonly name: string;
    readonly version: string;
  };
  readonly artifact_refs: readonly ArtifactRef[];
  readonly issued_at: string;
}

export interface RunEvent<P extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>> {
  readonly protocol: typeof HARNESS_PROTOCOL;
  readonly event_id: string;
  readonly run_id: string;
  readonly task_id: string;
  readonly sequence: number;
  readonly type: RunEventType;
  readonly at: string;
  readonly idempotency_key: string;
  readonly payload: P;
}
