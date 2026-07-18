import { describe, expect, it } from "vitest";
import * as core from "../src/index";
import type { ValidationResult } from "../src/index";

const NOW = "2026-07-18T07:15:00.000Z";
const LATER = "2026-07-18T07:16:00.000Z";
const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const DIGEST = `sha256:${"b".repeat(64)}`;

function validator(name: string): (input: unknown) => ValidationResult {
  const value = (core as unknown as Record<string, unknown>)[name];
  expect(typeof value, `${name} must be exported`).toBe("function");
  return value as (input: unknown) => ValidationResult;
}

const artifact = {
  artifact_id: "artifact_01JZCORE",
  kind: "trace",
  digest: DIGEST,
  uri: "artifact://run/run_01JZCORE/trace",
  media_type: "application/json",
  size_bytes: 128,
};

describe("complete Harness V2 validation surface", () => {
  it("validates Run projections", () => {
    const validate = validator("validateRun");
    expect(
      validate({
        protocol: core.HARNESS_PROTOCOL,
        run_id: "run_01JZCORE",
        task_id: "task_01JZCORE",
        attempt: 1,
        status: "running",
        base_commit: COMMIT,
        workspace_id: "workspace_01JZCORE",
        created_at: NOW,
        updated_at: LATER,
      }),
    ).toEqual({ ok: true, errors: [] });
  });

  it("validates Step projections", () => {
    const validate = validator("validateStep");
    expect(
      validate({
        step_id: "step_01JZCORE",
        run_id: "run_01JZCORE",
        sequence: 1,
        kind: "tool",
        status: "completed",
        started_at: NOW,
        completed_at: LATER,
      }),
    ).toEqual({ ok: true, errors: [] });
  });

  it("validates content-addressed Artifact references", () => {
    const validate = validator("validateArtifactRef");
    expect(validate(artifact)).toEqual({ ok: true, errors: [] });
    expect(validate({ ...artifact, digest: "latest" }).errors).toContain(
      "artifact.digest must be a sha256 digest",
    );
  });

  it("validates Evaluation results anchored to an exact subject", () => {
    const validate = validator("validateEvaluationResult");
    expect(
      validate({
        protocol: core.HARNESS_PROTOCOL,
        evaluation_id: "eval_01JZCORE",
        run_id: "run_01JZCORE",
        subject: {
          feature_id: "p30/F01",
          feature_revision: 1,
          commit_sha: COMMIT,
        },
        evaluator: {
          name: "@repo/harness-core",
          version: "0.1.0",
        },
        status: "passed",
        checks: [
          {
            check_id: "contracts",
            status: "passed",
            duration_ms: 18,
            artifact_refs: [artifact],
          },
        ],
        artifact_refs: [artifact],
        started_at: NOW,
        completed_at: LATER,
      }),
    ).toEqual({ ok: true, errors: [] });
  });
});
