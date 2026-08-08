# Survey Design Workbench Reference UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Survey design workbench to match the confirmed reference UI while preserving every existing edit and navigation callback.

**Architecture:** Keep `WorkspaceShell` responsible for workflow navigation and move the design page's command row into the shared shell. Replace the outline-selected editor with a document-style `SurveyDesignWorkbench` that renders derived summary data, hypotheses and all question cards. Keep derivation in a small tested helper and keep persistence in the existing page callbacks.

**Tech Stack:** Next.js 14, React, TypeScript, Tailwind CSS, existing shadcn/ui components, Lucide icons, Vitest, Playwright.

## Global Constraints

- Do not change Survey database or API contracts.
- Do not add dependencies.
- Use the confirmed screenshot as the visual target.
- Use semantic design tokens and Lucide icons; do not copy emoji from the reference.
- Purple remains a restrained accent for the summary rule, tags, selected controls and AI primary action.
- Desktop shows a sticky AI column; tablet and mobile use a single column without horizontal page overflow.

---

### Task 1: Define F18 Harness Contract

**Files:**
- Modify: `phases/phase-p25-survey/feature_list.json`
- Create: `phases/phase-p25-survey/sprints/sprint-18/progress.md`
- Create: `phases/phase-p25-survey/sprints/sprint-18/session-handoff.md`
- Generate: `phases/phase-p25-survey/sprints/sprint-18/active-features.json`

**Interfaces:**
- Consumes: confirmed requirement and design spec.
- Produces: a single `in_progress` F18 feature with executable verification.

- [ ] **Step 1: Add F18 as `not_started`**

Use the exact behavior and verification commands from
`requirements/17-design-workbench-reference-ui.md`.

- [ ] **Step 2: Create sprint 18**

Run:

```bash
pnpm harness new-sprint --phase p25 --id 18 --goal "按确认参考稿重构设计问卷工作台" --features F18
```

Expected: sprint 18 is generated and F18 becomes the only in-progress feature
for its owner.

- [ ] **Step 3: Validate the harness state**

Run:

```bash
pnpm harness doctor --phase p25
```

Expected: `0 FAIL / 0 WARN`.

### Task 2: Add Deterministic Survey Summary Derivation

**Files:**
- Create: `apps/web/lib/survey-design-summary.ts`
- Create: `apps/web/lib/survey-design-summary.test.ts`

**Interfaces:**
- Consumes:

```ts
type DesignSummaryQuestion = {
  title: string;
  category?: string;
};
```

- Produces:

```ts
function buildSurveyDesignSummary(
  questions: DesignSummaryQuestion[],
): {
  categories: string[];
  questionCount: number;
  estimatedMinutes: number;
  segmentVariables: string[];
  hypotheses: Array<{ id: string; title: string; category?: string }>;
};
```

- [ ] **Step 1: Write failing summary tests**

Cover category de-duplication, deterministic duration, empty categories and the
first three grounded hypotheses.

```ts
expect(buildSurveyDesignSummary(questions)).toEqual({
  categories: ["基本信息", "战略共识"],
  questionCount: 3,
  estimatedMinutes: 2,
  segmentVariables: ["基本信息"],
  hypotheses: [
    { id: "H1", title: "所在部门", category: "基本信息" },
    { id: "H2", title: "战略路线", category: "战略共识" },
    { id: "H3", title: "补充意见", category: undefined },
  ],
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run:

```bash
pnpm --filter @repo/web run test -- survey-design-summary
```

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement the helper**

Use stable array order, `Math.max(1, Math.ceil(questionCount / 2))` for duration,
and categories matching `/基本|人口|部门|角色|画像/i` for segment variables.

- [ ] **Step 4: Run the test and confirm pass**

Run the same Vitest command.

Expected: all `survey-design-summary` tests pass.

### Task 3: Rebuild the Design Workbench

**Files:**
- Modify: `apps/web/components/survey/survey-design-workbench.tsx`
- Modify: `apps/web/components/survey/survey-ai-panel.tsx`
- Modify: `apps/web/app/(app)/surveys/page.tsx`

**Interfaces:**
- Consumes: existing `SurveyDesignWorkbench` props and
  `buildSurveyDesignSummary()`.
- Produces: the same callbacks and `data-testid="workspace-design-workbench"`
  with a new document layout.

- [ ] **Step 1: Add the reference command row**

Move workflow-level Preview, Report Template and Publish actions into the
`WorkspaceShell` header for `active === "design"`. Keep `onNavigate()` as the
only workflow transition path.

- [ ] **Step 2: Replace the outline grid**

Remove `SurveyOutlinePanel` and selected-question state. Render:

```tsx
<div className="mx-auto grid w-full max-w-[1440px] gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
  <main className="grid min-w-0 gap-4">{/* summary, hypotheses, all questions */}</main>
  <SurveyAiPanel />
</div>
```

The final implementation must use the repository's supported Tailwind sizing
tokens or existing arbitrary-width conventions accepted by design lint.

- [ ] **Step 3: Build the survey summary and hypothesis sections**

Use controlled title and description inputs styled as document fields.
Category tags, question count, duration and hypotheses come only from
`buildSurveyDesignSummary()`.

- [ ] **Step 4: Render all editable question cards**

Map all `questions` without filtering. Preserve title, type, category, required,
option, add, move and delete callbacks. Use icon buttons with tooltips for
move/delete controls and retain text labels on mobile where needed.

- [ ] **Step 5: Restyle the AI panel**

Add contextual copy, quick-prompt chips and a sticky desktop container while
preserving submit, preview, apply and collapse behavior.

- [ ] **Step 6: Run local quality gates**

```bash
pnpm --filter @repo/web run lint
pnpm --filter @repo/web run typecheck
pnpm --filter @repo/web run test -- survey-design-summary
```

Expected: all commands exit 0.

### Task 4: Add Browser Acceptance and Visual Evidence

**Files:**
- Create: `apps/web/e2e/survey-p25-018-design-workbench-ui.spec.ts`
- Create: `phases/phase-p25-survey/sprints/sprint-18/evidence/survey-design-workbench-desktop.png`
- Create: `phases/phase-p25-survey/sprints/sprint-18/evidence/survey-design-workbench-mobile.png`
- Create: `design-qa.md`

**Interfaces:**
- Consumes: the local `/surveys?survey=<id>&step=design` route and existing E2E
  authentication/API fixtures.
- Produces: deterministic structural assertions and same-state screenshots.

- [ ] **Step 1: Write the failing Playwright test**

Assert:

```ts
await expect(page.getByTestId("survey-design-summary")).toBeVisible();
await expect(page.getByTestId("survey-design-hypotheses")).toBeVisible();
await expect(page.getByTestId("workspace-question-0")).toBeVisible();
await expect(page.getByTestId("workspace-question-1")).toBeVisible();
await expect(page.getByTestId("survey-ai-panel")).toBeVisible();
await expect(page.getByText("题目大纲")).toHaveCount(0);
```

Exercise title editing, required toggle, question move, add question, preview
and workflow navigation.

- [ ] **Step 2: Run the test and confirm failure**

```bash
pnpm --filter @repo/web exec playwright test e2e/survey-p25-018-design-workbench-ui.spec.ts
```

Expected: FAIL on the new summary/hypothesis selectors.

- [ ] **Step 3: Finish responsive fixes**

Verify desktop at 1440x1000 and mobile at 390x844. Fix any clipped controls,
overlaps or page-level horizontal scrolling.

- [ ] **Step 4: Compare the selected reference and implementation**

Open the selected reference screenshot and the latest implementation screenshot
at the same desktop state. Record hierarchy, spacing, border, radius, typography
and overflow findings in `design-qa.md`. Fix all P0-P2 findings until the file
states `final result: passed`.

- [ ] **Step 5: Run F18 verification**

```bash
pnpm harness verify --sprint p25/18 --feature F18 --backfill-evidence
```

Expected: F18 becomes `passing` only through the harness and the evidence log is
written under sprint 18.

- [ ] **Step 6: Commit implementation**

```bash
git add apps/web phases/phase-p25-survey docs/superpowers design-qa.md
git commit -m "feat(survey): match design workbench reference UI"
```

