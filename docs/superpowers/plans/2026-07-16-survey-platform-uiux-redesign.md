# Survey Platform UIUX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the complete BoardX Survey experience to match the approved AI Survey Diagnosis Platform reference while preserving existing routes, permissions, data, Qwen AI, public answering, and report generation.

**Architecture:** Deliver the redesign in vertical slices. The current F12 slice owns the report-template composer and report orchestration UI; later management-shell and workflow slices must receive separate Harness feature ownership after F12 passes. Existing API contracts remain unchanged, and presentational responsibilities are extracted from the large Survey page only when a slice has stable tests.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript strict mode, Tailwind CSS, shadcn-style local UI components, Lucide icons, ECharts, Playwright, Vitest, pnpm Harness.

## Global Constraints

- Keep the BoardX global navigation and add a Survey workspace sidebar on management pages.
- Use neutral semantic tokens; reserve Survey purple for AI, selection, progress, and key metrics.
- Do not add a new dependency unless an existing component or library cannot satisfy the requirement.
- Preserve owner, team, room, and public-answer authorization contracts.
- Qwen remains the only production AI provider through existing project interfaces.
- AI changes must be previewed before application.
- The editor must not restore Responses or Settings tabs.
- No raw response set may be sent to the client for report aggregation.
- Every task follows test-first development and stores evidence under the owning sprint.

---

### Task 1: F12 Report Template Builder Shell

**Files:**
- Modify: `apps/web/app/(app)/surveys/page.tsx`
- Modify: `apps/web/e2e/survey-p25-012-report-composer.spec.ts`
- Evidence: `phases/phase-p25-survey/sprints/sprint-12/evidence/F12-report-builder-shell.md`

**Interfaces:**
- Consumes: `WorkspaceTemplateWorkbench`, `ReportCategoryDraft`, `ReportInputMode`, existing report-category API callbacks.
- Produces: `data-testid="report-template-builder"`, `report-module-list`, `report-module-preview`, `report-ai-assistant`.

- [ ] **Step 1: Write the failing shell test**

Add assertions:

```ts
await expect(page.getByTestId("report-template-builder")).toBeVisible();
await expect(page.getByTestId("report-module-list")).toBeVisible();
await expect(page.getByTestId("report-module-preview")).toBeVisible();
await expect(page.getByTestId("report-ai-assistant")).toBeVisible();
await expect(page.getByTestId("report-template-builder")).toHaveClass(/xl:grid-cols-/);
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
pnpm --filter @repo/web exec playwright test e2e/survey-p25-012-report-composer.spec.ts --grep "builder"
```

Expected: FAIL because the approved builder test IDs and three-column shell are absent.

- [ ] **Step 3: Implement the approved three-column structure**

Reshape `WorkspaceTemplateWorkbench` into:

```tsx
<div data-testid="report-template-builder" className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
  <aside data-testid="report-module-list">{/* ordered modules */}</aside>
  <main data-testid="report-module-preview">{/* live preview */}</main>
  <aside data-testid="report-ai-assistant">{/* AI guidance */}</aside>
</div>
```

Keep existing save, classification, retry, and navigation callbacks connected.

- [ ] **Step 4: Run typecheck, design lint, and focused test**

```bash
pnpm --filter @repo/web typecheck
bash apps/web/scripts/lint-design.sh
pnpm --filter @repo/web exec playwright test e2e/survey-p25-012-report-composer.spec.ts --grep "builder"
```

Expected: PASS.

- [ ] **Step 5: Capture evidence and commit**

```bash
git add apps/web/app/'(app)'/surveys/page.tsx apps/web/e2e/survey-p25-012-report-composer.spec.ts phases/phase-p25-survey/sprints/sprint-12/evidence/F12-report-builder-shell.md
git commit -m "feat(survey): align report builder shell"
```

### Task 2: F12 Module Selection and Live Preview

**Files:**
- Modify: `apps/web/app/(app)/surveys/page.tsx`
- Modify: `apps/web/e2e/survey-p25-012-report-composer.spec.ts`
- Test: `apps/web/lib/survey-report-layout.test.ts`

**Interfaces:**
- Consumes: ordered report categories and their enabled `inputModes`.
- Produces: stable current-module selection, module enable toggle, reorder controls, preview synchronized with the selected module.

- [ ] **Step 1: Add failing selection and reorder assertions**

```ts
await page.getByTestId("report-module-item-1").click();
await expect(page.getByTestId("report-module-preview-title")).toContainText("当前章节");
await page.getByTestId("report-module-down-1").click();
await expect(page.getByTestId("report-module-item-2")).toContainText("当前章节");
```

- [ ] **Step 2: Verify RED**

Run the focused composer test. Expected: FAIL on missing module item and reorder test IDs.

- [ ] **Step 3: Implement ordered module navigation**

Each row contains:

- enabled checkbox;
- module title;
- module type;
- up and down icon buttons;
- active selection state.

The center panel renders only the selected module preview and does not repeat the complete chapter summary.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
pnpm --filter @repo/web test -- survey-report-layout
pnpm --filter @repo/web exec playwright test e2e/survey-p25-012-report-composer.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(survey): synchronize report module preview"
```

### Task 3: F12 Chart, Text, Image, and Prompt Configuration

**Files:**
- Modify: `apps/web/app/(app)/surveys/page.tsx`
- Modify: `apps/web/e2e/survey-p25-012-report-composer.spec.ts`
- Modify: `apps/web/lib/survey-report-layout.test.ts`

**Interfaces:**
- Consumes: `ReportInputMode`, chart configuration, module prompts, category question IDs.
- Produces: `report-config-style`, `report-config-data`, `report-config-mapping`, per-module generation prompt controls.

- [ ] **Step 1: Add failing configuration tests**

Assert that chart modules expose chart type, X axis, Y axis, metric, dimension, sorting, labels, legend, benchmark, and footnote controls. Assert text and image modules expose prompt, size, and placement controls.

- [ ] **Step 2: Verify RED**

Expected: missing configuration tabs or missing mode-specific fields.

- [ ] **Step 3: Implement mode-specific configuration**

Use a compact inspector with three views:

- Chart and Style
- Data Generation
- Visualization Mapping

Do not display chart-only controls for text and image modules.

- [ ] **Step 4: Verify persistence**

Change configuration, save, reload, and assert the controls restore their values from the existing report-category plan.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(survey): complete report module configuration"
```

### Task 4: F12 AI Report Structure Preview and Apply

**Files:**
- Modify: `apps/web/app/(app)/surveys/page.tsx`
- Modify: `apps/web/app/api/surveys/[id]/report-categories/route.ts`
- Modify: `apps/web/e2e/survey-p25-012-report-composer.spec.ts`

**Interfaces:**
- Consumes: existing Qwen report-category generation result.
- Produces: a visible change preview and explicit apply action; no direct overwrite.

- [ ] **Step 1: Add failing AI preview test**

```ts
await page.getByTestId("report-ai-input").fill("面向 CEO 的 10 分钟汇报");
await page.getByTestId("report-ai-send").click();
await expect(page.getByTestId("report-ai-change-preview")).toBeVisible();
await expect(page.getByTestId("report-ai-apply")).toBeVisible();
```

- [ ] **Step 2: Verify RED**

Expected: AI currently applies or reports changes without an isolated preview contract.

- [ ] **Step 3: Implement preview-before-apply**

Store the generated draft separately from persisted categories. Applying copies the draft into editable state; saving persists it through the existing authorized route.

- [ ] **Step 4: Verify failure behavior**

Provider failure must keep the current template unchanged and show retry plus manual-continuation actions.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(survey): preview AI report structure changes"
```

### Task 5: Finish and Verify F12

**Files:**
- Update through Harness only: `phases/phase-p25-survey/feature_list.json`
- Generated evidence: `phases/phase-p25-survey/sprints/sprint-12/evidence/F12.verify.log`
- Modify: `phases/phase-p25-survey/sprints/sprint-12/progress.md`
- Modify: `phases/phase-p25-survey/sprints/sprint-12/session-handoff.md`

**Interfaces:**
- Consumes: Tasks 1-4.
- Produces: F12 passing state and an unblocked dependency for later Survey redesign features.

- [ ] **Step 1: Run F12 verification**

```bash
pnpm harness verify --sprint p25/12 --feature F12
```

- [ ] **Step 2: Confirm evidence is tracked**

```bash
git ls-tree HEAD -- phases/phase-p25-survey/sprints/sprint-12/evidence/
```

- [ ] **Step 3: Update progress and handoff**

Record command results, remaining risks, and the next feature boundary.

- [ ] **Step 4: Commit Harness-generated state**

```bash
git add phases/phase-p25-survey
git commit -m "chore(survey): verify F12 report composer"
```

### Task 6: Create Harness Features for the Remaining UIUX Slices

**Files:**
- Modify through requirement-author workflow: `phases/phase-p25-survey/requirements/12-platform-uiux-redesign.md`
- Modify: `phases/phase-p25-survey/ui-signoff.md`
- Modify through Harness workflow: `phases/phase-p25-survey/feature_list.json`

**Interfaces:**
- Consumes: approved design specification and passing F12.
- Produces: independently verifiable features for shell/home, surveys/templates, editor/publish/responses, reports/public answer.

- [ ] **Step 1: Record the approved requirement**

Reference:

```text
docs/superpowers/specs/2026-07-16-survey-platform-uiux-redesign.md
```

- [ ] **Step 2: Record human UI confirmation**

Add the approved reference HTML and confirmation date to `ui-signoff.md`.

- [ ] **Step 3: Generate features**

Create four features:

- Survey shell, Home, and My Surveys
- Survey and Report Template centers
- Design, Publish, and Response Review workflows
- Analyze Report and Public Answer consistency

- [ ] **Step 4: Validate feature definitions**

Each feature must contain user-visible behavior, executable Playwright verification, and an evidence path.

- [ ] **Step 5: Create the next sprint**

Use `pnpm harness new-sprint` only after F12 is passing.

## Post-F12 Plan Boundaries

Task 6 creates the authoritative Harness features for the remaining redesign. Each generated feature receives its own implementation plan after the previous dependency passes:

1. **Management Shell, Home, and My Surveys**
   - Intended files: `apps/web/components/survey/survey-workspace-shell.tsx`, `survey-home.tsx`, `survey-list.tsx`.
   - Verification surface: desktop and mobile shell, metrics, creation paths, recommended templates, compact survey list.
2. **Survey and Report Template Centers**
   - Intended files: `survey-template-center.tsx`, `report-template-center.tsx`.
   - Verification surface: filters, ownership, linked templates, creation actions, permissions.
3. **Design, Publish, and Response Review**
   - Intended files: `survey-design-workspace.tsx`, `survey-publish-workspace.tsx`, `survey-response-workspace.tsx`.
   - Verification surface: five-step workflow, AI preview/apply, publication, share link, response review.
4. **Professional Report and Public Answer**
   - Intended files: results page, public answer page, answer form.
   - Verification surface: evidence-driven report, nonblank charts, authorized export, public answering, responsive layout.

The worker must not implement these boundaries under F12. Generate a dedicated detailed plan for each feature after Task 6 assigns authoritative IDs, verification commands, owner, sprint, and evidence paths.
