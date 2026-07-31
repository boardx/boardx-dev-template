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
