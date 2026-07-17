# Survey Create Dialog Usability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Survey create chooser readable, decisive, keyboard accessible, and responsive without changing any creation workflow.

**Architecture:** Keep the existing shared `Dialog` behavior and the three existing callbacks in the Survey page. Change only the chooser composition and responsive classes, then prove layout containment and action clarity with a focused Playwright specification.

**Tech Stack:** Next.js 14, React, TypeScript, Tailwind CSS, Lucide icons, Playwright, BoardX Harness.

## Global Constraints

- Work only in `/Users/shenyangjun/boardx/boardx-dev-template/.worktrees/p25-f12-survey-ui-redesign`.
- Treat this as review rework for the existing F15 Delivery PR #693.
- Preserve `new-survey-ai`, `new-survey-template`, and `new-survey-blank` callbacks and test IDs.
- Do not modify shared Survey data, permissions, APIs, or creation workflows.
- Use semantic design tokens and existing Lucide icons; add no dependency.
- Follow test-driven development: observe the focused test fail before editing production code.

---

### Task 1: Lock the responsive chooser contract

**Files:**
- Create: `apps/web/e2e/survey-p25-015-create-dialog.spec.ts`
- Reference: `apps/web/e2e/survey-p25-015-home-information.spec.ts`

**Interfaces:**
- Consumes: the authenticated `/surveys` fixture setup and existing `new-survey-*` test IDs.
- Produces: desktop and mobile assertions for readable card content, action labels, recommendation state, focus, and overflow containment.

- [ ] **Step 1: Write the failing desktop test**

Open `/surveys`, click the existing `survey-home-create` control, and assert:

```ts
await expect(page.getByTestId("new-survey-ai-recommended")).toHaveText("推荐");
await expect(page.getByTestId("new-survey-ai-action")).toHaveText("开始对话");
await expect(page.getByTestId("new-survey-template-action")).toHaveText("浏览模板");
await expect(page.getByTestId("new-survey-blank-action")).toHaveText("从空白开始");
```

Also assert every option has `white-space: normal`, no horizontal content overflow, and the dialog is at least 680 CSS pixels wide on a desktop viewport.

- [ ] **Step 2: Write the failing mobile test**

Use a `390 x 844` viewport and assert the dialog remains inside the viewport, the three cards share the same horizontal position, and both the document and each card satisfy `scrollWidth <= clientWidth`.

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```bash
pnpm --filter @repo/web exec playwright test e2e/survey-p25-015-create-dialog.spec.ts --reporter=line
```

Expected: FAIL because recommendation and action test IDs do not exist, the current desktop dialog is narrower than 680px, and card text inherits `nowrap`.

### Task 2: Implement the approved chooser design

**Files:**
- Modify: `apps/web/app/(app)/surveys/page.tsx`

**Interfaces:**
- Consumes: `createWithAiFromChooser`, `createFromTemplateChooser`, `createBlankFromChooser`, shared `Dialog`, `Badge`, and Lucide icons.
- Produces: a `max-w-3xl` responsive chooser with complete card text and stable visual-action test IDs.

- [ ] **Step 1: Add the required icon import**

Add `ArrowRight` to the existing `lucide-react` import list. Do not add a package.

- [ ] **Step 2: Make the dialog fit the viewport**

Pass a class that widens only this dialog and allows internal vertical scrolling:

```tsx
className="max-h-full max-w-3xl overflow-y-auto rounded-lg"
```

- [ ] **Step 3: Replace each compressed option with a responsive card**

Keep the existing `Button` and callback, but override its single-line behavior with `whitespace-normal`, use `min-w-0`, and compose each option as:

```tsx
<span className="flex min-w-0 items-start gap-3 md:flex-col md:gap-5">
  <span>{/* existing Lucide icon */}</span>
  <span className="min-w-0 flex-1">
    <span>{/* title and optional Badge */}</span>
    <span>{/* wrapping description */}</span>
    <span data-testid="...-action">
      {/* action label */}
      <ArrowRight />
    </span>
  </span>
</span>
```

Add `autoFocus` to the AI option, a `new-survey-ai-recommended` badge, and the three action test IDs from Task 1.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
pnpm --filter @repo/web exec playwright test e2e/survey-p25-015-create-dialog.spec.ts --reporter=line
```

Expected: 2 tests passed.

### Task 3: Verify visual fidelity and close the review loop

**Files:**
- Modify: `phases/phase-p25-survey/sprints/sprint-13/progress.md`
- Modify: `phases/phase-p25-survey/sprints/sprint-13/session-handoff.md`
- Modify: `design-qa.md`
- Create: `phases/phase-p25-survey/sprints/sprint-13/evidence/survey-create-dialog-f15-desktop.png`
- Create: `phases/phase-p25-survey/sprints/sprint-13/evidence/comparison-create-dialog-f15.png`

**Interfaces:**
- Consumes: the approved user screenshot and the rendered local dialog at the same desktop viewport.
- Produces: repository evidence, updated F15 verification evidence, and a clean PR branch.

- [ ] **Step 1: Run focused and regression validation**

Run:

```bash
pnpm --filter @repo/web run lint
pnpm --filter @repo/web run typecheck
pnpm --filter @repo/web exec playwright test e2e/survey-p25-015-home-information.spec.ts e2e/survey-p25-015-create-dialog.spec.ts
```

Expected: all commands exit 0.

- [ ] **Step 2: Capture and compare at the source viewport**

Capture the implemented open dialog at the same viewport as the supplied source, place both images side by side, and confirm no text overlap, clipping, incoherent spacing, or viewport overflow remains.

- [ ] **Step 3: Refresh passing evidence through Harness**

Run:

```bash
pnpm harness verify --sprint p25/13 --feature F15 --backfill-evidence
pnpm -w run verify:base
pnpm harness doctor --phase p25
```

Expected: F15 backfill rerun passes, base verification passes, and doctor reports `0 FAIL / 0 WARN`.

- [ ] **Step 4: Commit and update the existing Delivery PR**

Commit the implementation, tests, docs, and evidence on `codex/p25-f12-survey-html-followup`, push it, then update PR #693 and issue #648 with the new acceptance result.
