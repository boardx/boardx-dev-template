# @repo/harness-core

Provider-neutral core contracts for Harness V2.

This package defines the stable language shared by runtimes, control planes,
evaluation systems, and adapters:

- `FeatureRef`: immutable reference to a versioned delivery contract.
- `TaskSpec`: a unit of requested work.
- `Run`: one execution attempt for a task.
- `RunEvent`: append-only execution fact with sequence and idempotency key.
- `Step`: a query projection derived from run events.
- `ArtifactRef`: content-addressed output reference.
- `EvaluationResult`: evaluator output for an exact subject.
- `EvaluationAttestation`: immutable proof anchored to feature revision, commit,
  environment, verifier version, and artifacts.

The package has no runtime third-party dependencies. Model providers, storage,
GitHub, sandboxes, and coordination services belong in adapters or higher
layers.

During migration, `@repo/agent-core` re-exports this package while retaining its
existing session API.
