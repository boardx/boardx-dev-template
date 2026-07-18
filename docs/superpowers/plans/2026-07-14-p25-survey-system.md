# Phase p25 Survey System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `boardx-dev-template` deliver the complete Survey lifecycle defined by the p25 requirements baseline, using `boardx-survey@codex-survey-home-nav-redesign` as the product and UI source of truth.

**Architecture:** Survey remains a Next.js module backed by `@repo/data` and PostgreSQL. The migration first transplants the source workbench, answer, result, AI, and template behavior, then closes the production gaps named by the requirements baseline through focused API, persistence, export, and observability tasks. Public answering stays unauthenticated; every management, result, report, and export route enforces server-side ownership/team access.

**Tech Stack:** Next.js 14, React 18, TypeScript strict mode, PostgreSQL, `@repo/data`, `@repo/ai`, shadcn/ui, Tailwind CSS, Vitest, Playwright.

## Global Constraints

- Source of truth: `/Users/shenyangjun/boardx/boardx-survey` branch `codex-survey-home-nav-redesign`.
- Do not import source `node_modules`, `.turbo`, generated logs, sprint views, or old evidence.
- Preserve anonymous access to `/survey/:id/answer`; enforce all management permissions on the server.
- AI tests use deterministic mock providers and never require a live external model.
- AI cannot publish or persist changes without explicit user confirmation.
- Zero-response reports cannot invent samples, percentages, quotes, or conclusions.
- All schema changes use numbered migrations and include database invariant assertions.
- UI must pass `apps/web/scripts/lint-design.sh` and 375/768/1280 viewport checks.

---

### Task 1: Phase control plane and approved UI baseline

**Files:**
- Create: `phases/phase-p25-survey/**`
- Create: `docs/superpowers/plans/2026-07-14-p25-survey-system.md`
- Modify: `.harness/state/roadmap.yaml`
- Modify: `.harness/state/PROGRESS.md`

**Interfaces:**
- Consumes: requirements baseline SHA-256 `7f339a46fe4be0715aa4675fdf4f6065d141109376becc2fdd693e63489f7417`.
- Produces: confirmed p25 UI anchors and authoritative `feature_list.json`.

- [ ] Copy the requirements baseline into `phases/phase-p25-survey/requirements/` and verify identical checksum.
- [ ] Transplant the source Survey UI routes and deterministic UI test fixtures.
- [ ] Run the target web app and capture desktop/mobile screenshots into `phases/phase-p25-survey/ui-preview/`.
- [ ] Record the human decision that the source branch is authoritative in `ui-signoff.md`.
- [ ] Generate features whose Playwright assertions use the transplanted `data-testid` values.
- [ ] Run `pnpm harness doctor --phase p25` and commit the control-plane baseline.

### Task 2: Survey schema, access model, and CRUD/publish APIs

**Files:**
- Create: `packages/data/migrations/027_survey_system.sql`
- Modify: `packages/data/src/survey.ts`
- Modify: `packages/data/src/survey.test.ts`
- Modify: `packages/data/src/index.ts`
- Modify/Create: `apps/web/app/api/surveys/**`
- Modify/Create: `apps/web/app/api/survey-templates/**`
- Test: `apps/web/e2e/survey-p25-001-core.spec.ts`

**Interfaces:**
- Produces: `SurveyWithQuestions`, persisted question categories/metadata, report plans, publish rules, template CRUD, and `canManageSurvey`/`canViewSurvey` access checks.

- [ ] Write failing data and API tests for private/team isolation, question metadata, report-plan round trips, PATCH/DELETE, template delete, time windows, response limits, and identified one-response rules.
- [ ] Apply source migration `021_survey_report_templates.sql` semantics in a new conflict-free target migration and extend it for p25 metadata/report-plan requirements.
- [ ] Transplant source data access behavior, retaining target room scope and target authorization ordering.
- [ ] Implement the missing dynamic Survey and template routes with structured 400/401/403/404/409 errors.
- [ ] Run data tests, API Playwright tests, migration idempotency, and a database invariant query.
- [ ] Verify F01 with `pnpm harness verify --sprint p25/01 --feature F01` and commit.

### Task 3: Workbench, templates, AI creation, and editor

**Files:**
- Modify: `apps/web/app/(app)/surveys/page.tsx`
- Create: `apps/web/e2e/survey-p25-002-workbench-editor.spec.ts`
- Modify/Create: `apps/web/app/api/surveys/ai/route.ts`
- Modify/Create: `packages/ai/src/surveyGenerator.ts`
- Test: `packages/ai/src/surveyGenerator.test.ts`

**Interfaces:**
- Consumes: Task 2 CRUD and report-plan contracts.
- Produces: My/Team/Templates/AI workbench, compact template editor, typed question editor, AI draft/change-set confirmation.

- [ ] Copy the source workbench as the visual baseline and add the documented 6:4 template editor workspace.
- [ ] Write failing Playwright cases for URL-restored tabs, built-in/user templates, validation, ordering, preview persistence, and AI change selection.
- [ ] Implement deterministic AI schema validation and explicit fallback labels.
- [ ] Connect save/publish only after explicit confirmation and preserve unsaved state across preview.
- [ ] Run design lint and 375/768/1280 viewport overflow assertions.
- [ ] Verify F02 with Harness and commit.

### Task 4: Public answering and response validation

**Files:**
- Modify: `apps/web/app/survey/[id]/answer/page.tsx`
- Modify: `apps/web/app/survey/[id]/answer/answer-form.tsx`
- Modify: `apps/web/app/api/surveys/[id]/answer/route.ts`
- Modify: `apps/web/app/api/surveys/[id]/responses/route.ts`
- Create: `apps/web/e2e/survey-p25-003-answer.spec.ts`

**Interfaces:**
- Consumes: Task 2 publish and response contracts.
- Produces: anonymous/identified answering, server-side type validation, progress, success message, and duplicate/closed/limit states.

- [ ] Write failing tests for all supported question types and server-side invalid payloads.
- [ ] Transplant the source professional answer shell without adding authentication to the public route.
- [ ] Enforce active/time-window/limit/identity rules atomically before insert.
- [ ] Store file answers as controlled references; reject raw local paths and oversized/unsupported metadata.
- [ ] Verify F03 with Harness and commit.

### Task 5: Results, report planning, AI classification, and report artifacts

**Files:**
- Modify: `apps/web/app/(app)/surveys/[id]/results/page.tsx`
- Modify/Create: `apps/web/app/api/surveys/[id]/results/**`
- Modify/Create: `apps/web/app/api/surveys/[id]/ai-report/route.ts`
- Modify/Create: `packages/ai/src/surveyReportGenerator.ts`
- Create: `apps/web/e2e/survey-p25-004-results-report.spec.ts`

**Interfaces:**
- Consumes: Task 2 report plan and Task 4 real responses.
- Produces: server-side aggregates, individual responses, categorized report generation, low-sample caveats, versioned report artifacts, and retry/refine sessions.

- [ ] Write failing tests for summary/individual access, zero-sample safety, category strategies, evidence references, report versions, and partial failure recovery.
- [ ] Transplant the source result/report UI and retain target authorization checks.
- [ ] Render report modules strictly in persisted plan order and mark fact/inference/hypothesis/limitation content.
- [ ] Persist generation status, model, trace ID, version, and failure metadata.
- [ ] Verify F04 with Harness and commit.

### Task 6: Charts, AI images, and consistent exports

**Files:**
- Create/Modify: `apps/web/app/api/surveys/[id]/results/export/route.ts`
- Create: `packages/ai/src/surveyImageGenerator.ts`
- Create: `packages/ai/src/surveyImageGenerator.test.ts`
- Create: `apps/web/e2e/survey-p25-005-exports.spec.ts`

**Interfaces:**
- Consumes: Task 5 report artifact JSON.
- Produces: deterministic chart data and PDF/DOCX/image exports rendered from the same artifact.

- [ ] Write failing tests proving CSV escaping, real PDF signature, valid DOCX archive, image output, artifact-version consistency, and image failure fallback.
- [ ] Implement chart blocks from real aggregate data and persist generated image metadata.
- [ ] Render every export format from the report artifact instead of separate report logic.
- [ ] Add authorization, safe filenames, content types, and explicit draft watermark behavior for zero samples.
- [ ] Verify F05 with Harness and commit.

### Task 7: Full-system acceptance and operational hardening

**Files:**
- Create: `apps/web/e2e/survey-p25-006-system.spec.ts`
- Modify: `apps/web/e2e/survey-*.spec.ts` only where contracts intentionally changed.
- Modify: `.agents/skills/mod-survey/SKILL.md`
- Modify: `phases/phase-p25-survey/progress.md`
- Modify: `phases/phase-p25-survey/sprints/*/session-handoff.md`

**Interfaces:**
- Consumes: Tasks 2-6.
- Produces: one reproducible template-to-export journey plus permission, degradation, performance, and audit evidence.

- [ ] Run the five baseline E2E acceptance scenarios with real PostgreSQL and deterministic AI providers.
- [ ] Assert no unauthorized raw responses, prompts, or sensitive answer content appears in logs.
- [ ] Assert list/result performance budgets and report progress/retry behavior.
- [ ] Run all p13 Survey regressions and room Survey entry tests.
- [ ] Run `pnpm harness verify --sprint p25/<id>`, `./init.sh`, and `pnpm harness doctor --phase p25`.
- [ ] Update progress, handoff, and Survey module experience, then commit.

### Task 8: Review and delivery

**Files:**
- Review the complete branch diff against p25 requirements and source branch.

**Interfaces:**
- Produces: a reviewable PR to `main`; only `coord-main` may merge it.

- [ ] Confirm every p25 feature is `passing` only through Harness-generated evidence.
- [ ] Confirm every evidence path is present in `git ls-tree HEAD` and non-empty.
- [ ] Run a code review focused on public-answer auth boundaries, team isolation, AI fabrication prevention, migration safety, and export consistency.
- [ ] Push `codex/p25-survey-system` and open a PR to `main` with verification and risk details.
- [ ] Hand the green PR to `coord-main`; do not merge from the module coordinator role.
