# Survey Collect Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cluttered publish-and-collect workspace with one focused surface for collection status, activation time, respondent link, and secondary advanced settings.

**Architecture:** Extract the collect workbench from the oversized survey page into a focused client component. Keep all existing page state and API handlers as the source of truth, passing controlled values and callbacks into the new component so the redesign does not alter backend contracts.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, existing BoardX UI primitives, Lucide React, Playwright.

## Global Constraints

- Preserve the existing Survey PATCH endpoints and payload fields.
- Keep the persistent five-step workflow shell unchanged.
- Use a restrained warm purple accent only for selection, focus, and active states.
- The lower workflow workspace must fill the available application width.
- Do not add dependencies.

---

### Task 1: Lock The Simplified Collect Contract

**Files:**
- Modify: `apps/web/e2e/survey-p25-024-persistent-workflow-shell.spec.ts`

**Interfaces:**
- Consumes: the existing `/surveys?survey=:id&step=collect` route and survey fixtures.
- Produces: browser assertions for the simplified primary view, advanced disclosure, time shortcuts, validation, and full-width behavior.

- [x] **Step 1: Add failing primary-view assertions**

Add assertions that the collect workspace contains `collect-status-panel`,
`collect-settings-panel`, `collect-enabled-switch`, and
`save-collect-settings`, while `发布 AI`, `回收监控`, and `报告规划` are absent
from the collect content.

- [x] **Step 2: Add failing interaction assertions**

Exercise `立即开始`, `长期有效`, the advanced-settings disclosure, and invalid
start/end ordering. Assert associated fields disable correctly and the invalid
order exposes an alert while disabling `保存设置`.

- [x] **Step 3: Run the focused test and verify failure**

Run:
`pnpm --filter web exec playwright test e2e/survey-p25-024-persistent-workflow-shell.spec.ts --grep "simplified collect"`

Expected: FAIL because the new test IDs and controls do not exist yet.

### Task 2: Build And Wire The Focused Workbench

**Files:**
- Create: `apps/web/components/survey/survey-collect-workbench.tsx`
- Modify: `apps/web/app/(app)/surveys/page.tsx`

**Interfaces:**
- Consumes: controlled survey status, publish settings values, existing field callbacks, `onToggleStatus`, and `onSave`.
- Produces: `SurveyCollectWorkbench` with the same save/status API behavior and the new simplified UI contract.

- [x] **Step 1: Implement the focused component**

Create a client component with:

- A full-width status panel and accessible switch button.
- Two date-time fields controlled by `立即开始` and `长期有效`.
- Inline end-after-start validation.
- An active-only respondent link with a copy icon action.
- A native `details` disclosure containing the four existing advanced fields.
- `重置` and `保存设置` footer actions.

- [x] **Step 2: Replace the inline workbench**

Import `SurveyCollectWorkbench`, remove the old `WorkspaceCollectWorkbench`,
and pass the existing controlled values and handlers. Remove obsolete callback
props for duplicate workflow navigation.

- [x] **Step 3: Run static checks**

Run:

```bash
pnpm --filter web typecheck
pnpm --filter web lint
```

Expected: both commands exit 0 with no new errors.

- [x] **Step 4: Run focused browser verification**

Run:
`pnpm --filter web exec playwright test e2e/survey-p25-024-persistent-workflow-shell.spec.ts --grep "simplified collect|fill the desktop workspace"`

Expected: all selected tests pass.

- [x] **Step 5: Run visual design QA**

Capture the collect page at the reference desktop viewport and a narrow mobile
viewport. Compare the desktop capture beside
`phases/phase-p25-survey/ui-preview/collect-simplified-selected.png`, record
findings in `design-qa.md`, fix P0-P2 mismatches, and repeat until
`final result: passed`.
