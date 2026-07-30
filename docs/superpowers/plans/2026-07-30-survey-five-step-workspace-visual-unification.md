# Survey Five-Step Workspace Visual Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all five Survey workflow steps use one consistent workspace shell with restrained warm-purple accents while preserving every existing workflow and data behavior.

**Architecture:** Add one focused Survey presentation component that owns the shared content background, purple top rule, width, spacing, and introduction-row contract. Keep the persistent workflow header in `WorkspaceShell`, but make its active-step styling use the same Survey accent. Existing design, report-template, publish, responses, and report components retain their domain layouts and are composed inside the shared shell.

**Tech Stack:** Next.js 14, React 18, TypeScript strict mode, Tailwind CSS semantic tokens, shadcn-style UI components, Playwright.

## Global Constraints

- Apply the visual change to Design Survey, Report Template, Publish and Collect, Review Responses, and Analyze Report.
- Purple is limited to workflow state, selection, AI assistance, and diagnostic context.
- Primary commands remain black; success, warning, destructive, stale, and disabled states retain their semantic colors.
- Cards use an 8px maximum radius and avoid decorative nesting.
- Do not change Survey APIs, persistence, permissions, report generation, publication behavior, or answer data.
- Do not add dependencies or hard-coded colors.
- Preserve the persistent workflow-header and workflow-tabs DOM identity across step changes.
- Only the workflow content area scrolls; no document-level scrolling or blank area may appear below the application shell.

---

### Task 1: Shared Workflow Surface And Step Navigation

**Files:**
- Create: `apps/web/components/survey/survey-workflow-surface.tsx`
- Modify: `apps/web/app/(app)/surveys/page.tsx`
- Test: `apps/web/e2e/survey-p25-024-persistent-workflow-shell.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  interface SurveyWorkflowSurfaceProps {
    children: ReactNode;
    className?: string;
    contentClassName?: string;
  }

  export function SurveyWorkflowSurface(props: SurveyWorkflowSurfaceProps): JSX.Element;
  ```
- Consumes existing semantic Tailwind tokens: `bg-secondary`, `bg-background`, `border-border`, `border-survey`, `text-survey`.
- Preserves existing `survey-workflow-header`, `survey-workflow-tabs`, and `survey-workflow-scroll-container` test ids.
- Adds stable `survey-workflow-surface` and `survey-workflow-content` test ids.

- [ ] **Step 1: Write the failing five-step shell test**

Extend the persistent workflow test to visit all five deep links and assert:

```ts
const steps = ["design", "template", "collect", "answer", "report"] as const;

for (const step of steps) {
  await page.goto(`/surveys?survey=${survey.id}&step=${step}`);
  await expect(page.getByTestId("survey-workflow-surface")).toBeVisible();
  await expect(page.getByTestId("survey-workflow-content")).toBeVisible();
  await expect(page.getByTestId("survey-workflow-tabs")).toHaveCount(1);
  await expect(page.getByTestId(`survey-workflow-step-${step}`)).toHaveAttribute("data-active", "true");
}
```

- [ ] **Step 2: Run the shell test and verify it fails**

Run:

```bash
E2E_PORT=62740 COLLAB_WS_PORT=62741 pnpm --filter @repo/web exec playwright test e2e/survey-p25-024-persistent-workflow-shell.spec.ts
```

Expected: FAIL because the shared surface test ids and active-step attributes do not exist.

- [ ] **Step 3: Create the shared surface**

Implement the component with one framed boundary and a restrained purple accent:

```tsx
export function SurveyWorkflowSurface({
  children,
  className,
  contentClassName,
}: SurveyWorkflowSurfaceProps) {
  return (
    <div
      data-testid="survey-workflow-surface"
      className={cn("min-h-full border-t-2 border-survey bg-survey/5", className)}
    >
      <div
        data-testid="survey-workflow-content"
        className={cn("mx-auto w-full max-w-survey-editor p-4 sm:p-6", contentClassName)}
      >
        {children}
      </div>
    </div>
  );
}
```

Use the project `cn` utility and semantic tokens only.

- [ ] **Step 4: Integrate the surface into the persistent shell**

Replace the workflow-only plain `p-4` wrapper in `WorkspaceShell` with `SurveyWorkflowSurface`. Keep non-workflow dashboard/list rendering unchanged.

Add to each workflow step control:

```tsx
data-testid={`survey-workflow-step-${step.id}`}
data-active={active === step.id ? "true" : "false"}
```

Use one visual grammar:

```tsx
active === step.id
  ? "border-survey bg-survey/10 text-foreground shadow-sm"
  : "border-border bg-background text-foreground hover:border-survey/50 hover:bg-survey/5"
```

The number tile uses a Survey tint when active; primary command buttons remain unchanged.

- [ ] **Step 5: Run the shell and persistent-node tests**

Run:

```bash
E2E_PORT=62740 COLLAB_WS_PORT=62741 pnpm --filter @repo/web exec playwright test e2e/survey-p25-024-persistent-workflow-shell.spec.ts
```

Expected: PASS with the same header/tab element handles and geometry across all five steps.

### Task 2: Unify The Four Specialized Workbenches

**Files:**
- Modify: `apps/web/app/(app)/surveys/page.tsx`
- Modify: `apps/web/components/survey/survey-versioned-report-composer.tsx`
- Modify: `apps/web/components/survey/survey-professional-report-workbench.tsx`
- Modify: `apps/web/components/survey/professional-report-document.tsx`
- Test: `apps/web/e2e/survey-p25-010-source-workspace.spec.ts`
- Test: `apps/web/e2e/survey-p25-012-report-composer.spec.ts`
- Test: `apps/web/e2e/survey-p25-022-single-column-report.spec.ts`

**Interfaces:**
- Consumes `SurveyWorkflowSurface` from Task 1 through `WorkspaceShell`; specialized components do not import or duplicate the page-level shell.
- Preserves all existing mutation callbacks, report-generation callbacks, links, and test ids.
- Adds a shared class contract for page-introduction rows:
  `border-b border-survey/20 bg-background px-5 py-4`.

- [ ] **Step 1: Add failing visual-contract assertions**

In the source workspace test, assert each specialized workbench is inside the shared content node and has a compact introduction region:

```ts
await expect(
  page.getByTestId("survey-workflow-content").getByTestId(expectedWorkbench)
).toBeVisible();
await expect(page.getByTestId(`${step}-workspace-intro`)).toBeVisible();
```

Use these ids:

- `template-workspace-intro`
- `collect-workspace-intro`
- `answer-workspace-intro`
- `report-workspace-intro`

- [ ] **Step 2: Run the workspace test and verify it fails**

Run:

```bash
E2E_PORT=62740 COLLAB_WS_PORT=62741 pnpm --filter @repo/web exec playwright test e2e/survey-p25-010-source-workspace.spec.ts
```

Expected: FAIL because the four introduction test ids are absent.

- [ ] **Step 3: Align Report Template**

In `survey-versioned-report-composer.tsx`:

- keep the three-column chapter/editor/preview structure;
- replace the isolated top-level gray page treatment with the shared white introduction row;
- use `border-survey/30`, `bg-survey/5`, and `text-survey` for selected chapter, selected output mode, and AI controls;
- retain neutral surfaces for editable requirements and result preview;
- retain red stale status and all existing report-generation behavior.

- [ ] **Step 4: Align Publish And Collect**

In the collect workbench in `page.tsx`:

- mark the existing title/action region as `collect-workspace-intro`;
- use the common introduction-row spacing and border;
- group current survey, collection state, and report binding in one aligned summary band;
- use Survey purple for the section label and selected configuration only;
- keep active collection green, paused state yellow, and destructive/error states unchanged.

- [ ] **Step 5: Align Review Responses**

In `WorkspaceModulePanel`:

- add `answer-workspace-intro` to the response page introduction;
- align filters, response list, detail view, and empty state with the same background, borders, and gaps;
- use Survey tint for the selected response and active filter;
- preserve response validity and sample-state semantic colors.

- [ ] **Step 6: Align Analyze Report**

In `survey-professional-report-workbench.tsx` and `professional-report-document.tsx`:

- add `report-workspace-intro` to the report toolbar/title region;
- keep the report document white and single-column;
- place generation eligibility and version controls inside the shared spacing contract;
- use purple only for version selection and AI regeneration affordances;
- preserve the no-response empty state and generation eligibility behavior.

- [ ] **Step 7: Run specialized workflow tests**

Run:

```bash
E2E_PORT=62740 COLLAB_WS_PORT=62741 pnpm --filter @repo/web exec playwright test \
  e2e/survey-p25-010-source-workspace.spec.ts \
  e2e/survey-p25-012-report-composer.spec.ts \
  e2e/survey-p25-022-single-column-report.spec.ts
```

Expected: PASS with all existing workflow actions and new shared visual-contract assertions.

### Task 3: Responsive, Scroll, And Visual Regression

**Files:**
- Modify: `apps/web/e2e/survey-p25-002-professional-ui.spec.ts`
- Modify: `apps/web/e2e/survey-p25-024-persistent-workflow-shell.spec.ts`
- Evidence: `phases/phase-p25-survey/sprints/sprint-12/evidence/survey-five-step-unified-desktop.png`
- Evidence: `phases/phase-p25-survey/sprints/sprint-12/evidence/survey-five-step-unified-mobile.png`

**Interfaces:**
- Consumes the `survey-workflow-surface`, `survey-workflow-content`, step, and introduction test ids from Tasks 1 and 2.
- Preserves the existing internal-scroll contract: app and document scroll positions remain zero.

- [ ] **Step 1: Add desktop geometry assertions**

For all five steps at 1440x900, assert:

```ts
const surface = await page.getByTestId("survey-workflow-surface").boundingBox();
const content = await page.getByTestId("survey-workflow-content").boundingBox();
expect(surface).not.toBeNull();
expect(content).not.toBeNull();
expect(content!.x).toBeGreaterThanOrEqual(surface!.x);
expect(content!.x + content!.width).toBeLessThanOrEqual(surface!.x + surface!.width);
expect(content!.width).toBeLessThanOrEqual(1600);
```

Also assert no horizontal document overflow.

- [ ] **Step 2: Add mobile overflow assertions**

At 375x812, visit all five deep links and assert:

```ts
expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
await expect(page.getByTestId("survey-workflow-content")).toBeVisible();
```

Critical commands must remain reachable by keyboard or visible controls; no desktop-only column may force horizontal scrolling.

- [ ] **Step 3: Extend the bottom-scroll regression**

Keep the 24-question test and, after scrolling the workflow container to the bottom, send an additional 4000px wheel event. Assert:

```ts
expect(await page.evaluate(() => window.scrollY)).toBe(0);
expect(await page.evaluate(() => document.documentElement.scrollTop)).toBe(0);
expect(await page.getByTestId("app-scroll-container").evaluate((node) => node.scrollTop)).toBe(0);
```

- [ ] **Step 4: Run type and design checks**

Run:

```bash
pnpm --filter @repo/web typecheck
pnpm --filter @repo/web lint
git diff --check
```

Expected: all commands exit 0; existing language-mix warnings remain non-blocking.

- [ ] **Step 5: Run the focused Survey regression suite**

Run:

```bash
E2E_PORT=62740 COLLAB_WS_PORT=62741 pnpm --filter @repo/web exec playwright test \
  e2e/survey-p25-002-professional-ui.spec.ts \
  e2e/survey-p25-010-source-workspace.spec.ts \
  e2e/survey-p25-012-report-composer.spec.ts \
  e2e/survey-p25-022-single-column-report.spec.ts \
  e2e/survey-p25-024-persistent-workflow-shell.spec.ts
```

Expected: all tests pass.

- [ ] **Step 6: Capture final desktop and mobile evidence**

Capture one desktop composite showing the five-step navigation plus each content surface and one mobile composite proving one-column behavior. Save them at the exact evidence paths listed above and verify both files are non-empty.
