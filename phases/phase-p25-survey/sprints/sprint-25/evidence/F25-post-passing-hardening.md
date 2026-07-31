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

## Final current-head review closure

- `9278b2d9` rejects unsupported open-text-only evidence before generation, includes image analysis settings in prompts, and enforces read-only management boundaries.
- `d1cc27b9` derives formal-report question counts from the distinct union of template-bound question IDs and removes sticky report chapter navigation so the full document scrolls continuously.
- Web: 36 files / 194 tests passed; typecheck and lint passed.
- Data: 15 files / 101 tests passed; workflow-worker: 11 tests passed.
- F19/F24/F25 Playwright: 7/7 passed; final professional-report E2E: 1/1 passed.
- Pre-push affected verification: 16/16 tasks successful; Harness doctor: 0 FAIL / 0 WARN; `git diff --check`: passed.
- Two independent local reviewers returned `APPROVE` with no P0/P1/P2 findings on the final implementation patch.
- All 8 remaining GitHub review threads received evidence replies and were resolved.
- Issue #823 and PR #824 identify `usersyj` as final coordinator and merge owner; this worker does not merge.

## Final evidence-boundary review follow-up

- Commit `72de1075` rejects image chapters whose selected questions provide no anonymous aggregate claims, before any image generator is invoked.
- Chapter bundles no longer inherit report-level sample limitations; those limitations remain in the formal report preface instead of repeating in every chapter.
- Collection link copy resolves origin-relative respondent paths against the current browser origin, producing a directly usable absolute URL.
- TDD red evidence: the chapter test failed on inherited limitations and unsupported image generation; the Playwright test failed because the copied path raised `TypeError: Invalid URL`.
- `pnpm --filter @repo/web run test`: 36 files / 195 tests passed.
- `pnpm --filter @repo/web run typecheck`: exit 0.
- `pnpm --filter @repo/web run lint`: exit 0, with only the pre-existing phase-p17 language-mix warnings.
- F19/F24/F25 Playwright: 8/8 passed, including absolute respondent-link clipboard coverage.
- `pnpm harness doctor --phase p25`: 0 FAIL / 0 WARN.
- Final coordinator remains `usersyj`; this worker does not merge PR #824.
