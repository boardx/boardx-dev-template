# Survey Fluent Answer UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bordered Survey preview and public answer form with one Microsoft Forms-inspired Fluent reading surface.

**Architecture:** Keep the existing editor preview and public answer implementations in place, but align their layout tokens and control treatment. Playwright structure assertions define the shared unboxed contract while existing response tests protect submission behavior.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, shadcn-style local UI primitives, Playwright.

## Global Constraints

- Do not change Survey persistence, publication, response submission, or question types.
- Do not add dependencies.
- The complete questionnaire, individual questions, and choice options have no permanent card-style outlines.
- Editor preview and public answer page use the same visual hierarchy.

---

### Task 1: Lock the Fluent questionnaire contract

**Files:**
- Modify: `apps/web/e2e/survey-p25-002-professional-ui.spec.ts`

**Interfaces:**
- Consumes: Existing `survey-preview-sheet`, `preview-question-list`, `answer-professional-shell`, and `answer-question-list` test IDs.
- Produces: Assertions for unboxed page, question, and option surfaces.

- [x] **Step 1: Write failing structure assertions**

Assert that the shared sheet uses `border-0` and `shadow-none`, question lists omit `divide-y`, and first choice rows expose `preview-option-0-0` / `answer-option-1-0` without border classes.

- [x] **Step 2: Verify RED**

Run:

```bash
E2E_PORT=62206 COLLAB_WS_PORT=62207 pnpm exec playwright test e2e/survey-p25-002-professional-ui.spec.ts --grep "editor shell|answer and acceptance"
```

Expected: FAIL because the current sheet, question list, and options still use permanent borders.

### Task 2: Implement the Fluent preview and answer surface

**Files:**
- Modify: `apps/web/app/(app)/surveys/page.tsx`
- Modify: `apps/web/app/survey/[id]/answer/answer-form.tsx`
- Test: `apps/web/e2e/survey-p25-002-professional-ui.spec.ts`

**Interfaces:**
- Consumes: Existing `QuestionPreviewAnswer`, answer state setters, and semantic color tokens.
- Produces: Shared unboxed visual contract without changing data flow.

- [x] **Step 1: Remove permanent framing**

Use a white reading surface without outer border, radius, or shadow. Remove question dividers and option outlines. Keep vertical rhythm through `space-y-*`, question padding, typography, and subtle option hover backgrounds.

- [x] **Step 2: Add Fluent header and progress**

Replace the badge with quiet eyebrow text. Add a thin progress track to the public answer page and a static preview track in editor preview.

- [x] **Step 3: Align answer controls**

Render choice options as unboxed rows with semantic hover, focus, and selected states. Keep existing inputs, test IDs, and event handlers intact.

- [x] **Step 4: Verify GREEN**

Run the focused Playwright command from Task 1. Expected: 2 tests passed.

- [x] **Step 5: Run regression gates**

```bash
pnpm --filter @repo/web typecheck
pnpm --filter @repo/web test
bash apps/web/scripts/lint-design.sh
```

Expected: exit code 0 for all commands.

- [ ] **Step 6: Commit and push**

```bash
git add apps/web/app/(app)/surveys/page.tsx apps/web/app/survey/[id]/answer/answer-form.tsx apps/web/e2e/survey-p25-002-professional-ui.spec.ts docs/superpowers/plans/2026-07-16-survey-fluent-answer-ui.md
git commit -m "fix(survey): adopt fluent answer layout"
git push origin codex/p25-f12-survey-ui-redesign
```
