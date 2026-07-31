# F25 post-passing hardening evidence

- Commit: `41cd44cf fix(survey): harden iterative report templates`
- Independent review: `APPROVE`
- Web lint: exit 0
- Web typecheck: exit 0
- Data typecheck: exit 0
- Web focused tests: 33 passed
- Data source contract: 13 passed
- F25 Playwright: 2 passed
- Harness doctor: 0 FAIL / 0 WARN
- Harness verify: F25 already passing; skipped by irreversible-state rule
- Updated UI evidence: `ai-iterable-report-template.png`

The first Playwright attempt timed out while Next.js cold-compiled `/surveys`.
The unchanged test suite passed after the compilation cache was warm, confirming
that the initial failure was startup timing rather than a product regression.

## PR review follow-up

- Issue: `#823`
- Pull request: `#824`
- Coordinator handoff: `usersyj`
- Report-template POST is preview-only; persistence is restricted to the versioned PATCH path with CAS conflict detection.
- Every chapter now carries an independently editable analysis objective and analysis method through AI preview, storage, requirement hashing, immutable report snapshots, and generation prompts.
- Missing or stale question references are rejected with a chapter-scoped 422 before text or image generation starts; empty chapter sources cannot widen to all survey evidence.
- Chart chapters require at least one distribution-compatible selected question.
- The formal report renders research methodology and evidence scope once at document level, while historical v1 artifacts receive a compatibility fallback when read.
- Collection schedule toggles resynchronize when survey or publish-time props change.
- All-or-nothing report publication remains intentional: F19 requires preserving the latest successful report when any chapter fails, and the route regression test proves no partial version is published.
- `pnpm -w run verify:base`: 81/81 Turbo tasks passed; Web 36 files / 189 tests passed.
- `pnpm --filter @repo/data test`: 15 files / 101 tests passed.
- Harness doctor: 0 FAIL / 0 WARN.
- F25 Playwright rerun: blocked before product assertions because Docker Desktop did not respond to its API socket; this run is not recorded as passing.

## Final review-gate hardening

- Template chapter runtime failures now return the failed chapter identity and preserve the latest complete report instead of collapsing to an unscoped error.
- The F19 template-driven report E2E fixture uses real selected question IDs, matching the strict chapter-source contract.
- Collection start/end schedule synchronization is isolated per field, so editing one date cannot reset the sibling pending toggle.
- Formal template-driven PDF/Word HTML includes the report-level research methodology and evidence scope once before the saved chapters.
- `pnpm --filter @repo/web run test -- survey-report-chapter-generation survey-report-generation survey-report.route`: 36 files / 190 tests passed.
- `pnpm --filter @repo/web run typecheck`: exit 0.
- `pnpm --filter @repo/web run lint`: exit 0, with only the pre-existing phase-p17 language-mix warnings.
- `pnpm --filter @repo/web exec vitest run lib/report-export.test.ts`: 2 tests passed.
- `pnpm exec turbo run typecheck lint test --output-logs=errors-only`: 81/81 tasks passed.
- `pnpm harness doctor --phase p25`: 0 FAIL / 0 WARN.
- `pnpm harness verify --sprint p25/25`: F25 already passing; skipped by the irreversible-state rule.
- Docker Desktop remained unresponsive after approved API access and the probe was terminated after five seconds; the updated F19/F24 Playwright assertions are therefore left for GitHub CI and are not recorded as locally passing.
- Final coordinator remains `usersyj`; worker must not merge PR #824.

## Current-head browser and failure-contract verification

- Template assembly validation failures now preserve the failed chapter ID and title, return the same chapter-scoped retry contract as generation failures, release the generation claim, and publish no partial artifact.
- The F19 report-category save follows the production CAS contract by reading and sending `expectedUpdatedAt` before PATCH.
- Playwright derives `S3_ENDPOINT` from the worktree `MINIO_PORT` when no explicit endpoint is configured, so image chapters exercise the active isolated MinIO service instead of the obsolete default port.
- The current versioned template editor exposes a stable `template-continue-publish` command used by the mobile keyboard workflow check.
- Historical E2E report fixtures include the centralized methodology contract and the complete GET response envelope.
- `E2E_PORT=62678 COLLAB_WS_PORT=62679 pnpm --filter @repo/web exec playwright test e2e/survey-p25-019-template-driven-professional-report.spec.ts e2e/survey-p25-024-persistent-workflow-shell.spec.ts e2e/survey-p25-025-ai-iterable-report-template.spec.ts`: 7 tests passed in 41.0s.
- `pnpm --filter @repo/web run test`: 36 files / 191 tests passed.
- `pnpm --filter @repo/web run typecheck`: exit 0.
- `pnpm --filter @repo/web run lint`: exit 0, with only the pre-existing phase-p17 language-mix warnings.
- `pnpm -w run verify:base`: 81/81 Turbo tasks passed.
- `pnpm harness doctor --phase p25`: 0 FAIL / 0 WARN.
- `pnpm harness verify --sprint p25/25`: F25 already passing; skipped by the irreversible-state rule.
- Current-head browser coverage includes ordered text/chart/image report generation and protected image retrieval, unified five-step desktop/mobile surfaces and keyboard commands, simplified collection settings, AI template iteration, repeated question reuse, and a continuous four-chapter report document.
- Updated visual evidence: sprint-19 `report-desktop.png` / `report-mobile.png`, sprint-24 `persistent-workflow-shell.png`, and sprint-25 `ai-iterable-report-template.png` / `continuous-professional-report.png`.
- Final coordinator remains `usersyj`; this worker does not merge PR #824.
