# Survey HTML Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the production BoardX Survey UI faithfully match the six-screen `AI 问卷诊断平台(1).html` reference while preserving all existing data, authorization, Qwen, public-answer, URL-recovery, and report contracts.

**Architecture:** Keep `apps/web/app/(app)/surveys/page.tsx` as the data and route-state orchestrator, and move each visible surface into a focused component under `apps/web/components/survey/`. Components receive typed view models and callbacks; they do not fetch independently. Existing API routes and server-side report aggregation remain unchanged except where an existing review-blocking defect is proved by a failing test.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript strict mode, Tailwind CSS semantic tokens, local shadcn-style components, Lucide icons, ECharts, Vitest, Playwright, pnpm Harness.

## Global Constraints

- The only visual and interaction source is `/Users/shenyangjun/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/yy774650019_32de/msg/file/2026-07/AI 问卷诊断平台(1).html`.
- Reference SHA-256 is `bfaaef440519aad4fd4b0e9b9d3934e947e72001758e724e287d04289df65755`.
- Track the delivery through GitHub issue `boardx/boardx-dev-template#648` and the existing PR #674.
- Keep F01-F11 passing state and evidence unchanged.
- Keep F12 `in_progress` until `pnpm harness verify --sprint p25/12 --feature F12` succeeds.
- Preserve owner, team, room, and unauthenticated public-answer authorization.
- Preserve existing Survey API routes, Qwen provider, URL recovery, and server-side report aggregation.
- Use semantic Tailwind tokens and Lucide icons; do not add hard-coded palette classes or emoji controls.
- Render zero or an explicit unknown state when a metric lacks a real numerator or denominator.
- Do not send raw response sets to the client for report aggregation.
- Keep core controls keyboard accessible with stable `data-testid` attributes.

---

### Task 1: Lock the Six-Screen Contract

**Files:**
- Modify: `apps/web/e2e/survey-p25-008-source-stash-ui.spec.ts`
- Modify: `apps/web/e2e/survey-p25-010-source-workspace.spec.ts`
- Modify: `apps/web/e2e/survey-p25-012-report-composer.spec.ts`
- Modify: `phases/phase-p25-survey/ui-signoff.md`

**Interfaces:**
- Consumes: routes `/surveys`, `/surveys?view=my`, `/surveys?view=templates`, and the existing `survey` plus `step` query state.
- Produces: stable screen roots `survey-diagnostic-home`, `survey-list-screen`, `survey-template-center`, `report-template-builder`, `survey-editor-screen`, and `survey-insight-report`.

- [ ] **Step 1: Add failing screen-root assertions**

```ts
await page.goto("/surveys");
await expect(page.getByTestId("survey-diagnostic-home")).toBeVisible();

await page.goto("/surveys?view=my");
await expect(page.getByTestId("survey-list-screen")).toBeVisible();
await expect(page.getByTestId("create-path-ai")).toBeVisible();
await expect(page.getByTestId("create-path-template")).toBeVisible();
await expect(page.getByTestId("create-path-blank")).toBeVisible();

await page.goto("/surveys?view=templates");
await expect(page.getByTestId("survey-template-center")).toBeVisible();
```

- [ ] **Step 2: Add F12 builder and workflow assertions**

```ts
await expect(page.getByTestId("report-template-builder")).toBeVisible();
await expect(page.getByTestId("report-module-list")).toBeVisible();
await expect(page.getByTestId("report-module-preview")).toBeVisible();
await expect(page.getByTestId("report-module-inspector")).toBeVisible();
await expect(page.getByTestId("survey-editor-screen")).toBeVisible();
```

- [ ] **Step 3: Run focused tests and confirm RED**

```bash
pnpm --filter @repo/web exec playwright test \
  e2e/survey-p25-008-source-stash-ui.spec.ts \
  e2e/survey-p25-010-source-workspace.spec.ts \
  e2e/survey-p25-012-report-composer.spec.ts
```

Expected: FAIL on the missing screen-root and creation-path contracts.

- [ ] **Step 4: Record the confirmed reference in UI signoff**

Append the confirmed source path, hash, six screen names, and confirmation date. Do not alter historical confirmation text or manufacture implementation screenshots.

- [ ] **Step 5: Commit the contract**

```bash
git add apps/web/e2e/survey-p25-008-source-stash-ui.spec.ts \
  apps/web/e2e/survey-p25-010-source-workspace.spec.ts \
  apps/web/e2e/survey-p25-012-report-composer.spec.ts \
  phases/phase-p25-survey/ui-signoff.md
git commit -m "test(survey): lock HTML fidelity contract"
```

### Task 2: Extract and Match the Survey Shell and Home Dashboard

**Files:**
- Create: `apps/web/components/survey/survey-workspace-shell.tsx`
- Create: `apps/web/components/survey/survey-home-dashboard.tsx`
- Modify: `apps/web/app/(app)/surveys/page.tsx`
- Test: `apps/web/e2e/survey-p25-008-source-stash-ui.spec.ts`

**Interfaces:**
- Consumes:

```ts
export type SurveyManagementView = "home" | "my" | "templates";

export interface SurveyWorkspaceShellProps {
  activeView: SurveyManagementView;
  children: React.ReactNode;
  onNavigate: (view: SurveyManagementView) => void;
  onOpenReportTemplates: () => void;
}

export interface SurveyHomeMetric {
  label: string;
  value: string;
  emphasis?: boolean;
}
```

- Produces: `SurveyWorkspaceShell` and `SurveyHomeDashboard` with no data fetching.

- [ ] **Step 1: Add failing home hierarchy assertions**

```ts
await expect(page.getByTestId("survey-home-context")).toBeVisible();
await expect(page.getByTestId("survey-home-metrics")).toBeVisible();
await expect(page.getByTestId("survey-home-organization")).toBeVisible();
await expect(page.getByTestId("survey-home-community")).toBeVisible();
await expect(page.getByTestId("survey-home-method")).toBeVisible();
await expect(page.getByTestId("survey-home-templates")).toBeVisible();
await expect(page.getByTestId("survey-home-recent")).toBeVisible();
```

- [ ] **Step 2: Run the home test and confirm RED**

```bash
pnpm --filter @repo/web exec playwright test \
  e2e/survey-p25-008-source-stash-ui.spec.ts \
  --grep "diagnostic workspace reference"
```

Expected: FAIL because organization, community, or method sections are absent.

- [ ] **Step 3: Implement the typed shell**

```tsx
export function SurveyWorkspaceShell({
  activeView,
  children,
  onNavigate,
  onOpenReportTemplates,
}: SurveyWorkspaceShellProps) {
  return (
    <div className="grid min-h-screen bg-secondary lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="border-r border-border bg-background p-6">
        {/* Product identity and grouped navigation using Lucide icons. */}
      </aside>
      <main className="min-w-0 overflow-auto">{children}</main>
    </div>
  );
}
```

Use the reference order: product identity, grouped navigation, AI note, then the content canvas.

- [ ] **Step 4: Implement the reference home order**

```tsx
<div data-testid="survey-diagnostic-home" className="mx-auto w-full max-w-6xl px-10 py-9">
  <section data-testid="survey-home-context">{/* greeting + identity chips + actions */}</section>
  <section className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_1fr_1fr]">
    <div data-testid="survey-home-metrics">{/* real metrics */}</div>
    <div data-testid="survey-home-organization">{/* current team */}</div>
    <div data-testid="survey-home-community">{/* template signal */}</div>
  </section>
  <section data-testid="survey-home-method">{/* WHY / HOW / THEN */}</section>
  <section data-testid="survey-home-templates">{/* recommended templates */}</section>
  <section data-testid="survey-home-recent">{/* recent survey rows */}</section>
</div>
```

Use semantic `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, and `text-primary`. Do not use `violet-*`, `white`, or inline color values.

- [ ] **Step 5: Remove the fake completion metric**

Replace the hard-coded `78%` with:

```ts
const completionRate =
  totalStartedResponses > 0
    ? Math.round((totalCompletedResponses / totalStartedResponses) * 100)
    : null;
```

Render `completionRate === null ? "—" : `${completionRate}%``. If the current API has no started/completed denominator, pass `null` and render the unknown state.

- [ ] **Step 6: Run verification**

```bash
pnpm --filter @repo/web run typecheck
bash apps/web/scripts/lint-design.sh
pnpm --filter @repo/web exec playwright test \
  e2e/survey-p25-008-source-stash-ui.spec.ts \
  --grep "diagnostic workspace reference"
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/survey/survey-workspace-shell.tsx \
  apps/web/components/survey/survey-home-dashboard.tsx \
  apps/web/app/'(app)'/surveys/page.tsx \
  apps/web/e2e/survey-p25-008-source-stash-ui.spec.ts
git commit -m "feat(survey): match diagnostic home reference"
```

### Task 3: Match My Surveys and the Creation Paths

**Files:**
- Create: `apps/web/components/survey/survey-list-screen.tsx`
- Modify: `apps/web/app/(app)/surveys/page.tsx`
- Modify: `apps/web/e2e/survey-p25-008-source-stash-ui.spec.ts`
- Modify: `apps/web/e2e/survey-p25-011-qwen-ai-workflow.spec.ts`

**Interfaces:**
- Consumes:

```ts
export interface SurveyListItem {
  id: string;
  title: string;
  description: string;
  statusLabel: string;
  responseCount: number;
  responseLimit: number | null;
  updatedLabel: string;
  nextActionLabel: string;
}

export interface SurveyListScreenProps {
  surveys: SurveyListItem[];
  onCreateWithAi: () => void;
  onCreateFromTemplate: () => void;
  onCreateBlank: () => void;
  onOpenSurvey: (surveyId: string) => void;
}
```

- Produces: three visible creation paths and a compact list with one primary row action.

- [ ] **Step 1: Add failing creation-path tests**

```ts
await page.getByTestId("create-path-ai").click();
await expect(page.getByTestId("survey-ai-create")).toBeVisible();

await page.goto("/surveys?view=my");
await page.getByTestId("create-path-template").click();
await expect(page).toHaveURL(/view=templates/);

await page.goto("/surveys?view=my");
await page.getByTestId("create-path-blank").click();
await expect(page.getByTestId("survey-editor-screen")).toBeVisible();
```

- [ ] **Step 2: Confirm RED**

Run the two focused E2E files. Expected: FAIL because the three paths are not simultaneously visible.

- [ ] **Step 3: Implement the reference list**

Render the reference order: title and supporting copy, New Survey action, three creation paths, then the compact list header and rows. Each row displays title/context, status, real response information, and exactly one primary action.

Progress width:

```ts
const responseProgress =
  item.responseLimit && item.responseLimit > 0
    ? Math.min(100, Math.round((item.responseCount / item.responseLimit) * 100))
    : null;
```

Do not use `responseCount` directly as a percentage.

- [ ] **Step 4: Verify AI apply-before-overwrite**

Keep the existing `SurveyAiPanel` draft separate from the editor state. The test must assert the current survey is unchanged before clicking Apply.

- [ ] **Step 5: Run verification**

```bash
pnpm --filter @repo/web run typecheck
pnpm --filter @repo/web exec playwright test \
  e2e/survey-p25-008-source-stash-ui.spec.ts \
  e2e/survey-p25-011-qwen-ai-workflow.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/survey/survey-list-screen.tsx \
  apps/web/app/'(app)'/surveys/page.tsx \
  apps/web/e2e/survey-p25-008-source-stash-ui.spec.ts \
  apps/web/e2e/survey-p25-011-qwen-ai-workflow.spec.ts
git commit -m "feat(survey): match survey list and creation paths"
```

### Task 4: Match Template Center and Report Template Builder

**Files:**
- Create: `apps/web/components/survey/survey-template-center.tsx`
- Create: `apps/web/components/survey/report-template-builder.tsx`
- Modify: `apps/web/app/(app)/surveys/page.tsx`
- Modify: `apps/web/e2e/survey-p25-008-source-stash-ui.spec.ts`
- Modify: `apps/web/e2e/survey-p25-012-report-composer.spec.ts`
- Test: `apps/web/lib/survey-report-layout.test.ts`

**Interfaces:**
- Consumes: existing template view models, report categories, report input modes, layout helpers, and save/retry callbacks.
- Produces: `SurveyTemplateCenter` and `ReportTemplateBuilder`.

- [ ] **Step 1: Add failing template-center assertions**

```ts
await expect(page.getByTestId("template-tag-filter")).toBeVisible();
await expect(page.getByTestId("survey-template-grid")).toBeVisible();
await expect(page.getByTestId("template-create-ai")).toBeVisible();
await expect(page.getByTestId("template-create-manual")).toBeVisible();
```

- [ ] **Step 2: Add failing three-column builder assertions**

```ts
const builder = page.getByTestId("report-template-builder");
await expect(builder.getByTestId("report-module-list")).toBeVisible();
await expect(builder.getByTestId("report-module-preview")).toBeVisible();
await expect(builder.getByTestId("report-module-inspector")).toBeVisible();
```

- [ ] **Step 3: Confirm RED**

Run the template and F12 E2E files. Expected: FAIL on missing stable roots or inspector contract.

- [ ] **Step 4: Implement the template hierarchy**

Use a two-column desktop grid. Card order is ownership/tags, name/description, framework/report summary, then primary and secondary actions. Preserve filters, use-template, edit, delete, and linked report-template callbacks.

- [ ] **Step 5: Implement the builder responsibilities**

```tsx
<div data-testid="report-template-builder" className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
  <aside data-testid="report-module-list">{/* enable, select, reorder */}</aside>
  <main data-testid="report-module-preview">{/* selected module only */}</main>
  <aside data-testid="report-module-inspector">{/* tabs, prompt, AI preview */}</aside>
</div>
```

The left panel switches sections, the center previews results, and the right panel edits configuration. Do not repeat section count, question count, or save actions in all three panels.

- [ ] **Step 6: Verify persistence and failure recovery**

Change module order and prompt, save, reload, and assert restored values. Trigger the deterministic provider failure and assert current state remains editable with Retry.

- [ ] **Step 7: Run verification**

```bash
pnpm --filter @repo/web run test -- survey-report
pnpm --filter @repo/web run typecheck
bash apps/web/scripts/lint-design.sh
pnpm --filter @repo/web exec playwright test \
  e2e/survey-p25-008-source-stash-ui.spec.ts \
  e2e/survey-p25-012-report-composer.spec.ts
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/survey/survey-template-center.tsx \
  apps/web/components/survey/report-template-builder.tsx \
  apps/web/app/'(app)'/surveys/page.tsx \
  apps/web/e2e/survey-p25-008-source-stash-ui.spec.ts \
  apps/web/e2e/survey-p25-012-report-composer.spec.ts \
  apps/web/lib/survey-report-layout.test.ts
git commit -m "feat(survey): match template and report builders"
```

### Task 5: Match Editor and Insight Report

**Files:**
- Modify: `apps/web/components/survey/survey-design-workbench.tsx`
- Modify: `apps/web/components/survey/survey-ai-panel.tsx`
- Create: `apps/web/components/survey/survey-insight-report.tsx`
- Modify: `apps/web/app/(app)/surveys/page.tsx`
- Modify: `apps/web/app/(app)/surveys/[id]/results/page.tsx`
- Modify: `apps/web/e2e/survey-p25-010-source-workspace.spec.ts`
- Modify: `apps/web/e2e/survey-p25-002-professional-ui.spec.ts`

**Interfaces:**
- Consumes: existing typed question/category/hypothesis state, report evidence bundle, professional report model, and callbacks.
- Produces: `survey-editor-screen` and `survey-insight-report`.

- [ ] **Step 1: Add failing editor assertions**

```ts
await expect(page.getByTestId("survey-editor-screen")).toBeVisible();
await expect(page.getByTestId("survey-workflow-steps")).toBeVisible();
await expect(page.getByTestId("survey-question-editor")).toBeVisible();
await expect(page.getByTestId("survey-ai-assistant")).toBeVisible();
await expect(page.getByTestId("responses-tab")).toHaveCount(0);
await expect(page.getByTestId("settings-tab")).toHaveCount(0);
```

- [ ] **Step 2: Add failing report assertions**

```ts
await expect(page.getByTestId("survey-insight-report")).toBeVisible();
await expect(page.getByTestId("report-sample-quality")).toBeVisible();
await expect(page.getByTestId("report-limitations")).toBeVisible();
```

- [ ] **Step 3: Confirm RED**

Run the workspace and professional UI files. Expected: FAIL on screen roots or missing evidence sections.

- [ ] **Step 4: Implement the editor visual hierarchy**

Keep one command bar and the five workflow steps. The body contains metadata and questions as the primary column, with a subordinate AI assistant. AI changes remain in a draft preview until Apply.

- [ ] **Step 5: Implement the report hierarchy**

Render cover/summary, sample and methodology, sample quality, hypothesis validation, dimensions, segment differences, themes/quotes, priority matrix, action roadmap, and limitations in reference order. Use only `SurveyReportEvidenceBundle` and `ProfessionalSurveyReport` data.

- [ ] **Step 6: Verify zero and low samples**

Assert zero responses render an explicit no-evidence state and low samples render a limitation warning. No fabricated chart series may appear.

- [ ] **Step 7: Run verification**

```bash
pnpm --filter @repo/web run test -- survey-report
pnpm --filter @repo/web run typecheck
pnpm --filter @repo/web exec playwright test \
  e2e/survey-p25-010-source-workspace.spec.ts \
  e2e/survey-p25-002-professional-ui.spec.ts
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/survey/survey-design-workbench.tsx \
  apps/web/components/survey/survey-ai-panel.tsx \
  apps/web/components/survey/survey-insight-report.tsx \
  apps/web/app/'(app)'/surveys/page.tsx \
  apps/web/app/'(app)'/surveys/'[id]'/results/page.tsx \
  apps/web/e2e/survey-p25-010-source-workspace.spec.ts \
  apps/web/e2e/survey-p25-002-professional-ui.spec.ts
git commit -m "feat(survey): match editor and insight report"
```

### Task 6: Resolve PR #674 Review Blockers

**Files:**
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/tailwind.config.ts`
- Modify: `apps/web/app/survey/[id]/answer/answer-form.tsx`
- Modify: `apps/web/e2e/survey-p25-002-professional-ui.spec.ts`
- Move: `design-qa.md` to `phases/phase-p25-survey/sprints/sprint-12/evidence/design-qa.md`
- Modify: `phases/phase-p25-survey/sprints/sprint-12/progress.md`
- Modify: `phases/phase-p25-survey/sprints/sprint-12/session-handoff.md`

**Interfaces:**
- Consumes: existing semantic color tokens and public answer behavior.
- Produces: reviewable evidence with no false claims, hard-coded palette colors, duplicate alerts, or implementation-detail assertions.

- [ ] **Step 1: Add token and accessibility regression checks**

Run:

```bash
rg -n 'violet-|text-white|bg-white|role="alert"' \
  apps/web/app/'(app)'/surveys \
  apps/web/app/survey/'[id]'/answer \
  apps/web/components/survey
```

Expected before fix: matches for hard-coded palette classes and duplicate answer alerts.

- [ ] **Step 2: Replace the Survey color pair**

Define `--survey` and `--survey-foreground` for light and dark themes, expose both in Tailwind, and use them only where the existing primary token cannot express the reference selection/AI accent.

- [ ] **Step 3: Fix public-answer regressions**

Keep one visible `role="alert"` for a validation error. Replace class-name assertions with user-visible state assertions. Remove forced preload for any decorative large image and use the closest existing source asset only when it is visible content.

- [ ] **Step 4: Correct the audit trail**

Do not rewrite old session failures. Append the current test result with exact command, exit code, and blocker. Remove any claim that a mocked AI test proves the real server/database path.

- [ ] **Step 5: Verify**

```bash
bash apps/web/scripts/lint-design.sh
pnpm --filter @repo/web run lint
pnpm --filter @repo/web run typecheck
pnpm --filter @repo/web exec playwright test e2e/survey-p25-002-professional-ui.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/globals.css \
  apps/web/tailwind.config.ts \
  apps/web/app/survey/'[id]'/answer/answer-form.tsx \
  apps/web/e2e/survey-p25-002-professional-ui.spec.ts \
  phases/phase-p25-survey/sprints/sprint-12
git commit -m "fix(survey): resolve UI review blockers"
```

### Task 7: Visual QA, Harness Verification, and PR Update

**Files:**
- Create: `phases/phase-p25-survey/sprints/sprint-12/evidence/survey-html-reference.png`
- Create: `phases/phase-p25-survey/sprints/sprint-12/evidence/survey-html-implementation-desktop.png`
- Create: `phases/phase-p25-survey/sprints/sprint-12/evidence/survey-html-implementation-mobile.png`
- Create: `phases/phase-p25-survey/sprints/sprint-12/evidence/design-qa.md`
- Generated by Harness: `phases/phase-p25-survey/sprints/sprint-12/evidence/F12.verify.log`
- Modify: `phases/phase-p25-survey/sprints/sprint-12/progress.md`
- Modify: `phases/phase-p25-survey/sprints/sprint-12/session-handoff.md`

**Interfaces:**
- Consumes: Tasks 1-6.
- Produces: reproducible visual and command evidence, Harness-managed F12 transition, and an updated PR #674 linked to #648.

- [ ] **Step 1: Capture matching states**

Capture reference and implementation at the same desktop viewport. Capture the implementation at mobile width. Reject loading, empty-unintended, clipped, or blank-chart screenshots.

- [ ] **Step 2: Compare reference and implementation together**

Check shell widths, section order, spacing, type hierarchy, borders, radii, colors, control placement, and chart framing. Record visible differences in `design-qa.md`, fix them, then compare again.

- [ ] **Step 3: Run the complete Survey verification set**

```bash
pnpm --filter @repo/web run lint
pnpm --filter @repo/web run typecheck
pnpm --filter @repo/web run test -- survey-report
pnpm --filter @repo/web exec playwright test \
  e2e/survey-p25-001-source-baseline.spec.ts \
  e2e/survey-p25-002-professional-ui.spec.ts \
  e2e/survey-p25-005-export-artifacts.spec.ts \
  e2e/survey-p25-007-ai-session-resume.spec.ts \
  e2e/survey-p25-008-source-stash-ui.spec.ts \
  e2e/survey-p25-009-source-data-contract.spec.ts \
  e2e/survey-p25-010-source-workspace.spec.ts \
  e2e/survey-p25-011-qwen-ai-workflow.spec.ts \
  e2e/survey-p25-012-report-composer.spec.ts
```

Expected: PASS with no registration, database, provider, or screenshot blocker hidden by mocks.

- [ ] **Step 4: Run Harness verify**

```bash
pnpm harness verify --sprint p25/12 --feature F12
```

Expected: PASS. Only this command may update F12 status and evidence.

- [ ] **Step 5: Confirm evidence is committed**

```bash
git ls-tree HEAD -- phases/phase-p25-survey/sprints/sprint-12/evidence/
```

Every cited evidence file must have a non-empty blob.

- [ ] **Step 6: Commit generated state**

```bash
git add phases/phase-p25-survey
git commit -m "chore(survey): verify HTML fidelity delivery"
```

- [ ] **Step 7: Push and update PR #674**

Push `codex/p25-f12-survey-ui-redesign`, update the PR summary and exact verification results, keep `Closes #648` only if F12 verification passed, and request review without applying reviewer verdict labels.
