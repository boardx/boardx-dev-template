# Survey AI Workbench UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved five-step, AI-first Survey workbench without changing existing API contracts.

**Architecture:** Extract shared workbench shell, collapsible navigation, and compact AI result controls into focused Survey components, then adapt the existing step workbenches to those primitives. Keep data loading, mutations, permissions, Qwen sessions, report planning, publishing, response review, and export in the existing route while moving purely presentational and local layout behavior into typed components.

**Tech Stack:** Next.js 14 App Router, React 18, strict TypeScript, Tailwind CSS, shadcn-style local UI components, Lucide icons, ECharts, Playwright, Vitest.

## Global Constraints

- Preserve all five existing workflow capabilities and rename `设计模块` to `报告模板`.
- Do not add dependencies or change Survey API/database contracts.
- Use a 12-column export-safe report layout, not a free-position pixel canvas.
- Every chart, image, and text module has an independent generation prompt.
- AI changes expose preview and direct-apply actions.
- Preserve the dirty main workspace by working only in the isolated branch.

---

### Task 1: Lock the approved navigation and AI interaction contract

**Files:**
- Modify: `apps/web/e2e/survey-p25-011-qwen-ai-workflow.spec.ts`
- Modify: `apps/web/e2e/survey-p25-012-report-composer.spec.ts`

**Interfaces:**
- Consumes: existing authenticated Survey creation helpers and `/surveys?survey=<id>&step=<step>` routes.
- Produces: stable `data-testid` contracts for the workflow shell, collapsible panels, AI preview/apply controls, report canvas, and module prompts.

- [ ] Add failing assertions for `报告模板`, `survey-outline-toggle`, `survey-ai-panel`, `survey-ai-preview`, and `survey-ai-apply`.
- [ ] Add failing assertions for `report-layout-canvas`, chart/image/text modules, resize controls, and module prompt editor.
- [ ] Run the focused Playwright specs and confirm failure because the new UI contract is absent.

### Task 2: Build reusable Survey workbench primitives

**Files:**
- Create: `apps/web/components/survey/survey-workflow-shell.tsx`
- Create: `apps/web/components/survey/survey-ai-panel.tsx`
- Create: `apps/web/components/survey/survey-outline-panel.tsx`
- Modify: `apps/web/app/(app)/surveys/page.tsx`

**Interfaces:**
- Produces: `SurveyWorkflowShell`, `SurveyAiPanel`, and `SurveyOutlinePanel` typed React components.
- Consumes: existing route state and callbacks; components do not fetch or persist data.

- [ ] Implement the five-step shell with `报告模板` and responsive/collapsible side panels.
- [ ] Implement the compact AI panel with prompt, busy/success state, expandable summary, preview, and apply callbacks.
- [ ] Replace duplicated workbench header/panel markup while preserving existing callbacks.
- [ ] Run typecheck and focused Playwright until the shell assertions pass.

### Task 3: Rebuild design and report-template workspaces

**Files:**
- Create: `apps/web/components/survey/report-layout-canvas.tsx`
- Create: `apps/web/lib/survey-report-layout.ts`
- Create: `apps/web/lib/survey-report-layout.test.ts`
- Modify: `apps/web/app/(app)/surveys/page.tsx`

**Interfaces:**
- Produces: typed 12-column `ReportLayoutModule`, normalization/move/resize helpers, and `ReportLayoutCanvas`.
- Consumes: existing category plan, question source, chart configuration, module prompts, and preview chart data.

- [ ] Write failing unit tests for grid normalization, move, resize bounds, and independent module prompts.
- [ ] Implement minimal layout helpers and verify unit tests pass.
- [ ] Render chart, image, and text modules in the selected report chapter with drag/reorder and keyboard-accessible resize controls.
- [ ] Connect selected-module tabs to existing chart config and module prompt fields.
- [ ] Preserve existing design editor behavior while applying the shared collapsible outline and compact AI panel.
- [ ] Run report unit tests, typecheck, and focused E2E.

### Task 4: Restyle publish, response review, and report workspaces

**Files:**
- Modify: `apps/web/app/(app)/surveys/page.tsx`
- Modify: `apps/web/e2e/survey-p25-012-report-composer.spec.ts`

**Interfaces:**
- Consumes: existing publish mutation, response data, report generation, retry, and export callbacks.
- Produces: approved step-specific views without changing response shapes.

- [ ] Add failing E2E assertions for publish readiness, response views/detail, report outline/progress, and PDF/Word export.
- [ ] Apply the shared shell and compact AI panel to the three workspaces.
- [ ] Consolidate repeated descriptions and actions while retaining every existing setting and mutation.
- [ ] Verify the selected answer detail, report generation progress, retry, and completed-section reading states.

### Task 5: Verify UI quality and Harness evidence

**Files:**
- Modify: `phases/phase-p25-survey/sprints/sprint-12/progress.md`
- Modify: `phases/phase-p25-survey/sprints/sprint-12/session-handoff.md`
- Create: `phases/phase-p25-survey/sprints/sprint-12/evidence/F12-ui-redesign.verify.log`

**Interfaces:**
- Consumes: all implementation and test outputs.
- Produces: reproducible verification evidence while F12 remains subject to its complete Harness gate.

- [ ] Run `pnpm --filter @repo/web run test -- survey-report`.
- [ ] Run `pnpm --filter @repo/web run typecheck` and `pnpm lint-design`.
- [ ] Run focused Survey Playwright specs at desktop and mobile widths.
- [ ] Capture the five workspaces to `phases/phase-p25-survey/ui-preview/implemented/`.
- [ ] Update progress and handoff with the verified boundary; do not directly mark F12 passing.
