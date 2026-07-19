# Survey Workflow Visual Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify all five Survey workflow steps on the full-width operational workspace used by Publish & Collect while preserving each step's business structure.

**Architecture:** Keep `WorkspaceShell` as the sole owner of the persistent header and workflow tabs. Add one shared step-content frame below it, then adapt design, template, collect, answer, and report content to that frame without changing their data or action contracts.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, shadcn/ui, Playwright, BoardX Harness.

## Global Constraints

- Use the Publish & Collect full-width workspace as the visual baseline.
- Keep the same workflow header and tab DOM nodes while switching steps.
- Do not change Survey, response, template, or professional-report data contracts.
- Do not add dependencies.
- Keep the professional report document at a centered reading width.
- Preserve all existing step actions and deep-link restoration.

---

### Task 1: Register Harness Feature F25

**Files:**
- Create: `phases/phase-p25-survey/requirements/24-unified-workflow-visual-system.md`
- Modify: `phases/phase-p25-survey/feature_list.json`
- Create: `phases/phase-p25-survey/sprints/sprint-25/sprint.md`
- Create: `phases/phase-p25-survey/sprints/sprint-25/progress.md`
- Create: `phases/phase-p25-survey/sprints/sprint-25/session-handoff.md`
- Generated: `phases/phase-p25-survey/sprints/sprint-25/active-features.json`

**Interfaces:**
- Consumes: confirmed design in `docs/superpowers/specs/2026-07-19-survey-workflow-visual-unification-design.md`.
- Produces: F25 with owner `wrk-survey-1`, status `in_progress`, and executable verification commands.

- [ ] **Step 1: Write the requirement**

Define visible behavior: all five steps share one full-width content frame, one title/action region, consistent gutters and panels; design has no duplicate workflow command bar; report body stays centered.

- [ ] **Step 2: Add F25 to the authoritative feature list**

Use verification commands:

```bash
pnpm --filter @repo/web run lint
pnpm --filter @repo/web run typecheck
E2E_PORT=62678 COLLAB_WS_PORT=62679 pnpm --filter @repo/web exec playwright test e2e/survey-p25-025-unified-workflow-visual-system.spec.ts
pnpm harness doctor --phase p25
git cat-file -e HEAD:phases/phase-p25-survey/sprints/sprint-25/evidence/F25.verify.log
```

- [ ] **Step 3: Generate sprint 25**

Run:

```bash
pnpm harness new-sprint --phase p25 --id 25 --goal "统一 Survey 五步工作流视觉系统" --features F25
```

Expected: sprint files are generated and F25 is the only `in_progress` feature for `wrk-survey-1`.

- [ ] **Step 4: Commit**

```bash
git add phases/phase-p25-survey
git commit -m "docs(survey): define unified workflow visual feature"
```

---

### Task 2: Add Failing Five-Step Visual Contract

**Files:**
- Create: `apps/web/e2e/survey-p25-025-unified-workflow-visual-system.spec.ts`

**Interfaces:**
- Consumes: `survey-workflow-header`, `survey-workflow-tabs`, and existing step content test IDs.
- Produces: layout contract test IDs `survey-workflow-content`, `survey-step-header`, and `survey-step-surface`.

- [ ] **Step 1: Write the failing Playwright test**

Create one survey, open `step=design`, and capture:

```ts
const content = page.getByTestId("survey-workflow-content");
const contentBox = await content.boundingBox();
await expect(page.getByTestId("survey-step-header")).toBeVisible();
await expect(page.getByTestId("survey-step-surface")).toBeVisible();
await expect(page.getByTestId("editor-command-bar")).toHaveCount(0);
```

Switch through `template`, `collect`, `answer`, and `report`. For each step assert:

```ts
expect(await page.getByTestId("survey-workflow-content").boundingBox()).toEqual(contentBox);
await expect(page.getByTestId("survey-step-header")).toHaveCount(1);
await expect(page.getByTestId("survey-step-surface")).toHaveCount(1);
```

For report assert:

```ts
const reportBox = await page.getByTestId("professional-report-document").boundingBox();
expect(reportBox!.width).toBeLessThan(contentBox!.width);
```

Take one screenshot per step under `phases/phase-p25-survey/sprints/sprint-25/evidence/`.

- [ ] **Step 2: Run the test to verify RED**

Run:

```bash
E2E_PORT=62678 COLLAB_WS_PORT=62679 pnpm --filter @repo/web exec playwright test e2e/survey-p25-025-unified-workflow-visual-system.spec.ts
```

Expected: FAIL because the shared content and step frame test IDs do not exist and the design command bar is duplicated.

- [ ] **Step 3: Commit the failing test**

```bash
git add apps/web/e2e/survey-p25-025-unified-workflow-visual-system.spec.ts
git commit -m "test(survey): define unified workflow visual contract"
```

---

### Task 3: Build Shared Full-Width Step Frame

**Files:**
- Modify: `apps/web/app/(app)/surveys/page.tsx`

**Interfaces:**
- Consumes: existing `WorkspaceShell` children and `WorkspaceTarget`.
- Produces: a stable `survey-workflow-content` region and reusable `SurveyStepFrame` component.

- [ ] **Step 1: Add the shared frame**

Define:

```tsx
interface SurveyStepFrameProps {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}
```

Render:

```tsx
<section data-testid="survey-step-surface" className="min-w-0">
  <header data-testid="survey-step-header" className="mb-4 flex flex-wrap items-start justify-between gap-4 border border-border bg-background px-5 py-4">
    ...
  </header>
  {children}
</section>
```

Wrap workflow children in:

```tsx
<main data-testid="survey-workflow-content" className="min-w-0 px-4 py-4 sm:px-6">
  {children}
</main>
```

- [ ] **Step 2: Adapt the design step**

Remove the duplicate `editor-command-bar` workflow identity and back action. Move Preview, Report Template, and Save into `SurveyStepFrame.actions`. Replace the centered `max-w-survey-editor` container with the shared full-width frame while retaining the main editor plus AI rail.

- [ ] **Step 3: Adapt template, collect, answer, and report**

Use `SurveyStepFrame` once per step. Preserve:

- template three-column chapter/editor/preview layout;
- collect full-width rules plus AI rail;
- answer filter/content/quality layout;
- report centered document and top report actions.

- [ ] **Step 4: Run the visual contract to verify GREEN**

Run:

```bash
E2E_PORT=62678 COLLAB_WS_PORT=62679 pnpm --filter @repo/web exec playwright test e2e/survey-p25-025-unified-workflow-visual-system.spec.ts
```

Expected: PASS and five evidence screenshots are written.

- [ ] **Step 5: Run regressions**

Run:

```bash
pnpm --filter @repo/web run lint
pnpm --filter @repo/web run typecheck
E2E_PORT=62678 COLLAB_WS_PORT=62679 pnpm --filter @repo/web exec playwright test \
  e2e/survey-p25-020-unified-design-entry.spec.ts \
  e2e/survey-p25-021-template-report-entry.spec.ts \
  e2e/survey-p25-022-single-column-report.spec.ts \
  e2e/survey-p25-024-persistent-workflow-shell.spec.ts \
  e2e/survey-p25-025-unified-workflow-visual-system.spec.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(app\)/surveys/page.tsx apps/web/e2e/survey-p25-025-unified-workflow-visual-system.spec.ts phases/phase-p25-survey/sprints/sprint-25/evidence
git commit -m "feat(survey): unify workflow visual system"
```

---

### Task 4: Verify and Close F25

**Files:**
- Modify through Harness: `phases/phase-p25-survey/feature_list.json`
- Modify: `phases/phase-p25-survey/sprints/sprint-25/progress.md`
- Modify: `phases/phase-p25-survey/sprints/sprint-25/session-handoff.md`
- Append: `.agents/skills/mod-survey/SKILL.md`

**Interfaces:**
- Consumes: passing F25 implementation and evidence screenshots.
- Produces: Harness-owned passing state and review-ready PR update.

- [ ] **Step 1: Record the module lesson**

Append that a persistent workflow shell must also own a shared visual content frame; DOM stability alone does not prevent visual fragmentation when each step controls its own width and title hierarchy.

- [ ] **Step 2: Run Harness verification**

Run:

```bash
pnpm harness verify --sprint p25/25 --feature F25
```

Expected: all F25 commands, doctor, and base verification pass; Harness transitions F25 to `passing`.

- [ ] **Step 3: Update progress and handoff**

Record implementation, exact commands, screenshot evidence, residual risks, and PR #757.

- [ ] **Step 4: Commit and push**

```bash
git add .agents/skills/mod-survey/SKILL.md phases/phase-p25-survey
git commit -m "chore(harness): mark survey F25 passing"
git push origin codex/p25-f19-template-driven-report
```

Expected: PR #757 head updates and remains mergeable.
