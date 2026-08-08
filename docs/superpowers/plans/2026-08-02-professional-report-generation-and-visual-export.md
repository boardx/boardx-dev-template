# Professional Report Generation and Visual Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make template-configured text, ECharts, and Wan 2.7 research visuals generate one evidence-grounded formal report whose web, PDF, Word, and PNG outputs remain content-equivalent and professionally presented.

**Architecture:** Extend the existing template-driven report contract rather than adding a parallel report path. Chapter generation remains all-or-nothing, uses the existing evidence boundaries, stores generated images in controlled object storage, and publishes one canonical report version. Web rendering and every export consume that canonical report; browser exports serialize already-rendered chart canvases and research visuals only after assets are ready.

**Tech Stack:** TypeScript, Next.js, React, Vitest, Playwright, ECharts, docx, object storage, DashScope Wan image API, BoardX Harness.

## Global Constraints

- Do not start implementation until Harness permits F13: `F13` currently depends on pending `F17`; resolve that dependency through the authoritative feature process, never by editing `active-features.json` or silently bypassing the gate.
- Preserve all existing uncommitted work and scope commits to files intentionally changed for F13.
- Do not create a second report schema or export-only content model.
- Do not use generated images for quantitative charts or statistical evidence.
- Do not restore per-chapter `有效回答 n=X` labels.
- Do not fake PDF, DOCX, or PNG with HTML or plain text payloads.
- Keep old report versions readable and preserve the most recent successful version on generation failure.

---

### Task 1: Establish the F13 Harness work item

**Files:**
- Inspect: `phases/phase-p25-survey/feature_list.json`
- Inspect: `phases/phase-p25-survey/sprints/*/active-features.json`
- Modify through Harness only: the sprint/progress files selected by `pnpm harness new-sprint`

- [ ] Run the Harness status checks and confirm `F17` is `passing` before assigning F13.

```bash
pnpm harness doctor --phase p25
node -e "const f=require('./phases/phase-p25-survey/feature_list.json'); console.log(f.features.filter(x=>['F13','F17'].includes(x.id)))"
```

- [ ] If F17 is still pending, stop implementation and complete or formally re-plan F17 through the coordinator workflow; do not weaken F13's dependency locally.
- [ ] Once the dependency is satisfied, create/enter the sprint that owns only F13 and confirm there is one `in_progress` feature for the owner.
- [ ] Record the exact branch, feature issue, verification commands, and baseline in the sprint handoff before editing production code.

### Task 2: Extend the canonical report contract for research visuals

**Files:**
- Modify: `apps/web/lib/survey-template-report.ts`
- Test: `apps/web/lib/survey-template-report.test.ts`
- Modify: `packages/data/src/surveyReportVersion.ts`
- Test: `packages/data/src/survey-report-version.test.ts`

- [ ] Add failing tests proving an image chapter carries a structured purpose, evidence-source label, and AI-visual disclosure while old stored reports remain readable.
- [ ] Add failing tests proving validation rejects empty visual purpose/source and rejects image evidence outside the chapter allow-list.
- [ ] Add the smallest compatible fields to the image chapter type, for example `visualPurpose`, `sourceLabel`, and `disclosure`, with legacy defaults applied only while materializing old versions.
- [ ] Include the new image contract in report requirement hashing/version persistence so a changed visual request creates a new report version.
- [ ] Run focused tests.

```bash
pnpm --filter @repo/web run test -- survey-template-report
pnpm --filter @repo/data run test -- survey-report-version
```

### Task 3: Generate evidence-grounded Wan 2.7 research visuals

**Files:**
- Modify: `apps/web/lib/wan-image.ts`
- Test: `apps/web/lib/wan-image.test.ts`
- Modify: `apps/web/lib/survey-report-chapter-generation.ts`
- Test: `apps/web/lib/survey-report-chapter-generation.test.ts`
- Modify: `apps/web/server/survey-report-ai-stub.mjs`

- [ ] Add failing tests for the configured Wan 2.7 model, supported image response types, object-storage persistence, timeout, invalid content type, oversize payload, and non-retention of the vendor URL.
- [ ] Add failing chapter-generation tests showing that the prompt contains only the chapter's validated anonymous findings, management purpose, visual type, and prohibitions.
- [ ] Add a failing test showing that image chapters are returned as formal report chapters with purpose/source/disclosure metadata without a confirmation step.
- [ ] Change the default `WAN_IMAGE_MODEL` fallback to the project-approved Wan 2.7 model identifier while preserving environment override.
- [ ] Build the prompt from structured chapter inputs; explicitly prohibit numbers, logos, personal information, portraits, decorative stock imagery, and imitation of consulting brands.
- [ ] Keep image generation in the existing all-or-nothing chapter pipeline. On failure, surface the chapter error so the API retains the latest successful report version.
- [ ] Update the deterministic AI stub to return the same contract used in production tests.
- [ ] Run focused tests.

```bash
pnpm --filter @repo/web run test -- wan-image survey-report-chapter-generation
```

### Task 4: Enforce template output types in the generation API

**Files:**
- Modify: `apps/web/app/api/surveys/[id]/professional-report/route.ts`
- Test: `apps/web/app/api/surveys/[id]/professional-report/survey-report.route.test.ts`
- Modify if required: `apps/web/lib/survey-report-category-plan.ts`
- Test if required: `apps/web/lib/survey-report-category-plan.test.ts`

- [ ] Add failing route tests for a mixed text/chart/image template and assert the persisted formal report preserves exact chapter count, order, output type, chart template, and image metadata.
- [ ] Add a failing test showing a changed chapter output type changes the requirement hash and prevents stale report reuse.
- [ ] Add a failing test showing an image-generation failure does not publish a partial version and leaves the previous successful version available with a retryable error.
- [ ] Make the minimum API/orchestration changes needed for those tests; do not introduce a second generation endpoint.
- [ ] Run route and planning tests.

```bash
pnpm --filter @repo/web run test -- survey-report.route survey-report-category-plan
```

### Task 5: Render a consulting-grade canonical web report

**Files:**
- Modify: `apps/web/components/survey/professional-report-document.tsx`
- Modify only if orchestration requires it: `apps/web/components/survey/survey-professional-report-workbench.tsx`
- Test: `apps/web/e2e/survey-p25-019-template-driven-professional-report.spec.ts`

- [ ] Extend the existing E2E fixture to include at least one text chapter, one chart chapter, and one research-visual chapter.
- [ ] Add failing assertions that the report shows conclusion-led titles, real ECharts output, the stored research visual, purpose/source/disclosure labels, and no per-chapter `有效回答 n=` text.
- [ ] Refine the renderer around a single report document with restrained color, stable typography, readable line length, one management question per exhibit, and distinct conclusion/evidence/action regions.
- [ ] Render chart chapters from the persisted option, not from fallback prose.
- [ ] Render image chapters with accessible alt text and visible purpose/source/disclosure metadata; do not add decorative generated imagery.
- [ ] Confirm legacy image chapters render with compatible default disclosure text.
- [ ] Run the focused E2E spec at desktop and a narrow viewport.

```bash
pnpm --filter @repo/web exec playwright test e2e/survey-p25-019-template-driven-professional-report.spec.ts
```

### Task 6: Produce content-equivalent PDF, Word, and PNG exports

**Files:**
- Modify: `apps/web/lib/report-export.ts`
- Test: `apps/web/lib/report-export.test.ts`
- Create: `apps/web/e2e/survey-p25-013-report-export.spec.ts`
- Modify if needed for UI wiring: `apps/web/components/survey/survey-professional-report-workbench.tsx`

- [ ] Add failing unit tests for an export manifest that contains every chapter in report order and preserves text, chart image, research visual, purpose/source/disclosure, and methodology content.
- [ ] Add failing tests that PDF, DOCX, and PNG outputs use correct MIME types, filename extensions, non-empty bytes, and embedded image assets.
- [ ] Add failing tests that export waits for fonts, ECharts canvases, and report images; asset failure must reject instead of silently producing text-only output.
- [ ] Refactor all formats to consume one normalized report/export manifest derived from the canonical report document.
- [ ] For PDF and PNG, replace each chart canvas with a high-resolution data URL/image before cloning or capture; preserve pagination and avoid clipping.
- [ ] For Word, embed chart snapshots and research visual bytes in a real DOCX while keeping headings and narrative text editable.
- [ ] Implement the F13 Playwright spec: generate/download each format, verify browser-visible chapters, inspect downloads for matching filenames/MIME/signatures, and assert chart/research-visual assets are present.
- [ ] Run F13 export verification.

```bash
pnpm --filter @repo/web run test -- report-export
pnpm --filter @repo/web exec playwright test e2e/survey-p25-013-report-export.spec.ts
```

### Task 7: Verify permissions and retry behavior

**Files:**
- Inspect/modify only if gaps exist: `apps/web/app/api/surveys/[id]/professional-report/assets/[assetId]/route.ts`
- Inspect/modify only if gaps exist: report download API routes under `apps/web/app/api/surveys/[id]/professional-report/`
- Test: colocated route tests for the affected APIs

- [ ] Add or update tests proving image and report downloads require the correct authenticated team/survey access.
- [ ] Add tests for missing assets and generation/export failures returning stable retryable errors without leaking object keys or vendor URLs.
- [ ] Confirm the latest successful report remains viewable and exportable after a failed regeneration.
- [ ] Run the affected API test files.

### Task 8: Full verification, evidence, review, and delivery

**Files:**
- Modify via Harness workflow: `phases/phase-p25-survey/sprints/<sprint>/progress.md`
- Modify via Harness workflow: `phases/phase-p25-survey/sprints/<sprint>/session-handoff.md`
- Evidence generated by Harness under the selected sprint

- [ ] Run the complete F13 verification commands exactly as defined in `feature_list.json`.

```bash
pnpm --filter @repo/web run test -- report-export
pnpm --filter @repo/web run lint
pnpm --filter @repo/web run typecheck
pnpm --filter @repo/web exec playwright test e2e/survey-p25-013-report-export.spec.ts
```

- [ ] Run broader report regression tests and the repository baseline.

```bash
pnpm --filter @repo/web run test -- survey-template-report survey-report-chapter-generation survey-report.route survey-report-category-plan report-export
./init.sh
```

- [ ] Capture screenshots of the mixed-output web report and exported PDF/Word/PNG evidence; record paths and command output in the sprint evidence.
- [ ] Run `pnpm harness verify --sprint <phase/sprint>` and `pnpm harness doctor --phase p25`; do not manually mark F13 `passing`.
- [ ] Stage only F13 files, request code review, resolve all blocking findings, push the `codex/` branch, create the feature PR, pass review/CI gates, and let the coordinator merge.
- [ ] Update progress and handoff with the final commit, PR, verification evidence, known limitations, and clean-state checklist result.

## Plan Self-Review

- [ ] Confirm every approved design requirement maps to at least one implementation task and one verification assertion.
- [ ] Search changed production files for placeholders: `TODO`, `FIXME`, `mock`, `placeholder`, and text-only export fallbacks.
- [ ] Confirm TypeScript contracts are shared across generation, persistence, rendering, and export rather than duplicated.
- [ ] Confirm no task reintroduces per-chapter sample-count labels or generated statistical imagery.
- [ ] Confirm the plan does not bypass F17, mutate `active-features.json`, or claim `passing` without Harness evidence.

