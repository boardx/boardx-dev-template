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
