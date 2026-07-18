import { describe, expect, expectTypeOf, it } from "vitest";
import {
  HARNESS_PROTOCOL,
  RUN_EVENT_TYPES,
  validateEvaluationAttestation,
  validateRunEvent,
  validateTaskSpec,
  type EvaluationAttestation,
  type RunEvent,
  type Step,
  type TaskSpec,
} from "../src/index";

const NOW = "2026-07-18T07:15:00.000Z";
const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const DIGEST = `sha256:${"a".repeat(64)}`;

function taskSpec(): TaskSpec {
  return {
    protocol: HARNESS_PROTOCOL,
    task_id: "task_01JZCORE",
    feature: {
      id: "p30/F01",
      revision: 1,
      spec_digest: DIGEST,
    },
    goal: "Define the Harness V2 provider-neutral core contracts",
    acceptance: [
      {
        criterion_id: "core-contract-tests",
        kind: "command",
        description: "The core contract test suite passes",
        target: "pnpm --filter @repo/harness-core test",
      },
    ],
    base_commit: COMMIT,
    created_at: NOW,
    metadata: { issue: 729 },
  };
}

function runEvent(): RunEvent {
  return {
    protocol: HARNESS_PROTOCOL,
    event_id: "evt_01JZCORE",
    run_id: "run_01JZCORE",
    task_id: "task_01JZCORE",
    sequence: 1,
    type: "run.created",
    at: NOW,
    idempotency_key: "run_01JZCORE:1",
    payload: { base_commit: COMMIT },
  };
}

function attestation(): EvaluationAttestation {
  return {
    protocol: HARNESS_PROTOCOL,
    attestation_id: "att_01JZCORE",
    evaluation_id: "eval_01JZCORE",
    run_id: "run_01JZCORE",
    subject: {
      feature_id: "p30/F01",
      feature_revision: 1,
      commit_sha: COMMIT,
    },
    result: "passed",
    environment: {
      name: "local-macos-node22",
      digest: DIGEST,
    },
    verifier: {
      name: "@repo/harness-core",
      version: "0.1.0",
    },
    artifact_refs: [
      {
        artifact_id: "artifact_01JZCORE",
        kind: "log",
        digest: DIGEST,
        uri: "artifact://eval/eval_01JZCORE/output",
        media_type: "text/plain",
      },
    ],
    issued_at: NOW,
  };
}

describe("TaskSpec", () => {
  it("accepts a provider-neutral task contract", () => {
    expect(validateTaskSpec(taskSpec())).toEqual({ ok: true, errors: [] });
  });

  it("rejects an unversioned feature, shell-only acceptance strings, and a non-SHA base", () => {
    const invalid = {
      ...taskSpec(),
      feature: { ...taskSpec().feature, revision: 0 },
      acceptance: ["pnpm test"],
      base_commit: "main",
    };

    const result = validateTaskSpec(invalid);

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "feature.revision must be an integer >= 1",
        "acceptance[0] must be an object",
        "base_commit must be a 7-64 character hexadecimal commit SHA",
      ]),
    );
  });
});

describe("RunEvent", () => {
  it("accepts every closed-set event type with a monotonic sequence and idempotency key", () => {
    for (const type of RUN_EVENT_TYPES) {
      expect(validateRunEvent({ ...runEvent(), type }).ok, type).toBe(true);
    }
  });

  it("rejects unknown events, negative sequences, and missing idempotency keys", () => {
    const result = validateRunEvent({
      ...runEvent(),
      type: "run.teleported",
      sequence: -1,
      idempotency_key: "",
    });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        "type must be a supported run event type",
        "sequence must be an integer >= 0",
        "idempotency_key must be a non-empty string",
      ]),
    );
  });
});

describe("EvaluationAttestation", () => {
  it("accepts an immutable proof anchored to feature revision, commit, environment, and verifier", () => {
    expect(validateEvaluationAttestation(attestation())).toEqual({ ok: true, errors: [] });
  });

  it("rejects a passed proof without artifacts or an exact commit anchor", () => {
    const result = validateEvaluationAttestation({
      ...attestation(),
      subject: { ...attestation().subject, commit_sha: "main" },
      artifact_refs: [],
    });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        "subject.commit_sha must be a 7-64 character hexadecimal commit SHA",
        "artifact_refs must contain at least one artifact when result is passed",
      ]),
    );
  });
});

describe("public projections", () => {
  it("exposes Step as a projection without making it the event source of truth", () => {
    const step: Step = {
      step_id: "step_01JZCORE",
      run_id: "run_01JZCORE",
      sequence: 1,
      kind: "tool",
      status: "completed",
      started_at: NOW,
      completed_at: NOW,
      input: { command: "pnpm test" },
      output: { exit_code: 0 },
    };

    expectTypeOf(step).toMatchTypeOf<Step>();
    expect(step.status).toBe("completed");
  });
});
