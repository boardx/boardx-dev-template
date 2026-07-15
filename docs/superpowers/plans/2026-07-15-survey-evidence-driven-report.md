# Survey Evidence-driven Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate professional Survey reports exclusively from real, traceable response evidence and render them through a dedicated screen/print document model.

**Architecture:** Add a pure evidence aggregation boundary in `apps/web/lib`, use it to derive per-question report chapters and validated claims, then map that document model to both the report workspace and export HTML. Existing Survey authorization, response storage, Qwen gateway and report job APIs remain unchanged.

**Tech Stack:** TypeScript, React, Next.js 14, Vitest, Playwright, ECharts, existing BoardX Survey APIs.

## Global Constraints

- Never fabricate response counts, percentages, chart values or conclusions.
- One chart uses one question and one denominator unless it is an explicitly validated cross-tab.
- Zero-response reports contain structure and empty states but no business claims.
- Low-sample findings are directional and include their limitation.
- AI claims require valid evidence references and matching numeric values.
- PDF/Word render from a report document model, not from cloned workspace DOM.
- Do not add dependencies or change Survey authorization boundaries.

---

### Task 1: Real Survey Evidence Bundle

**Files:**
- Create: `apps/web/lib/survey-report-evidence.ts`
- Test: `apps/web/lib/survey-report-evidence.test.ts`

**Interfaces:**
- Consumes: persisted survey questions and response answer maps.
- Produces: `buildSurveyReportEvidence(input): SurveyReportEvidenceBundle` with sample quality, per-question distributions, score summaries, text answers and limitations.

- [ ] Write failing tests proving zero responses produce no values, separate questions never share a distribution, multiple choice exposes respondent denominator, and low samples add a limitation.
- [ ] Run `pnpm exec vitest run lib/survey-report-evidence.test.ts` and confirm failures are caused by the missing module.
- [ ] Implement typed aggregation for choice, multiple-choice, score/NPS, numeric and text questions without simulated fallbacks.
- [ ] Run the focused tests and confirm all pass.
- [ ] Commit the evidence boundary.

### Task 2: Professional Report Document and Claim Validation

**Files:**
- Create: `apps/web/lib/survey-professional-report.ts`
- Test: `apps/web/lib/survey-professional-report.test.ts`
- Modify: `apps/web/lib/survey-report-planner.ts`

**Interfaces:**
- Consumes: `SurveyReportEvidenceBundle`, optional AI claim candidates and report category plan.
- Produces: `buildProfessionalReportDocument(...)` and `validateEvidenceClaims(...)` with cover, executive summary, methodology, evidence chapters, limitations, actions and appendix.

- [ ] Write failing tests proving zero samples produce no executive claims, invalid AI evidence references are rejected, each chart preserves its question ID and denominator, and low-sample claims are marked directional.
- [ ] Run the tests and confirm the expected failures.
- [ ] Implement the document builder and fail-closed claim validator; remove fixed highest/lowest fallback prose from the professional path.
- [ ] Run evidence and document tests together and confirm all pass.
- [ ] Commit the document model.

### Task 3: Report Workspace Uses Evidence Instead of Simulation

**Files:**
- Modify: `apps/web/app/(app)/surveys/page.tsx`
- Create: `apps/web/components/survey/professional-report-document.tsx`
- Modify: `apps/web/e2e/survey-p25-012-report-composer.spec.ts`

**Interfaces:**
- Consumes: the persisted/generated report artifact and professional document model.
- Produces: user-visible report sections with sample methodology, per-question charts, evidence notes, limitations and actions.

- [ ] Add a failing Playwright assertion that a zero-response report contains “暂无真实答卷” and does not contain “模拟数据” or generated numeric bars.
- [ ] Add a fixture with real responses and assert two different questions render separate chart titles and sample sizes.
- [ ] Replace the forced `isSimulated: true` preview and generic distribution prose with `ProfessionalReportDocument`.
- [ ] Keep AI failure recoverable: statistics remain visible while AI text shows retry status.
- [ ] Run focused typecheck, Vitest and Playwright tests.
- [ ] Commit the report workspace integration.

### Task 4: Dedicated A4 PDF and Word Rendering

**Files:**
- Modify: `apps/web/lib/report-export.ts`
- Test: `apps/web/lib/report-export.test.ts`
- Modify: `apps/web/app/(app)/surveys/page.tsx`

**Interfaces:**
- Consumes: professional report document model.
- Produces: `buildProfessionalReportHtml(document)` used by PDF print and Word download.

- [ ] Write failing tests asserting exports include methodology, sample size, source notes and page structure, and exclude workspace controls, “模拟数据” and “预览维度”.
- [ ] Implement A4 portrait report CSS with cover, page headers/footers, chapter page breaks, chart captions and evidence footnotes.
- [ ] Route PDF and Word exports through the document model; stop cloning the live report workbench.
- [ ] Run export tests, report tests, typecheck, design lint and `git diff --check`.
- [ ] Run the focused Survey Playwright suite and record any baseline-only failure separately.
- [ ] Update sprint evidence, progress and handoff without manually changing F12 to passing.
- [ ] Commit the verified implementation.
