# Survey Unified Creation Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the New Survey chooser, Survey Editor, and Survey Template Center match the approved diagnostic-workspace UI while preserving all current Survey behavior.

**Architecture:** Keep `apps/web/app/(app)/surveys/page.tsx` as the existing composition root and reuse `openEditor`, `openTemplateEditor`, `selectSurveyForWorkspace`, AI state, and template APIs. Add only local presentation state for the creation chooser and reshape existing render branches; do not introduce dependencies or replace authorization/data contracts.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, shadcn/ui, Lucide React, Playwright.

## Global Constraints

- Preserve the current Survey API, Qwen provider, room/team/owner permissions, publishing flow, report generation, and public answer contract.
- Use semantic Tailwind tokens and existing shadcn/ui components; no hard-coded palette, arbitrary pixel classes, or native form controls.
- Keep cards at 8px radius or less and avoid nested decorative cards.
- AI-generated changes must remain previewable and require explicit application.
- Do not restore Responses or Settings tabs in the editor.
- F12 remains `in_progress`; only `pnpm harness verify` may promote it.

---

### Task 1: New Survey Chooser

**Files:**
- Modify: `apps/web/app/(app)/surveys/page.tsx`
- Modify: `apps/web/e2e/survey-p25-008-source-stash-ui.spec.ts`

**Interfaces:**
- Consumes: `openEditor(options?: { withAi?: boolean; template?: SurveyTemplate })`, `setWorkbenchTab`, existing `Dialog`, `DialogContent`, `Button`, and Lucide icons.
- Produces: `createChooserOpen: boolean`, `openCreateChooser(): void`, and stable anchors `new-survey-dialog`, `new-survey-ai`, `new-survey-template`, `new-survey-blank`.

- [ ] **Step 1: Write the failing chooser E2E**

Add a test that registers, opens `/surveys`, clicks `create-with-ai`, expects `new-survey-dialog`, then verifies all three choices. Select the template choice and assert `/surveys?view=templates`; reopen and select AI to assert `editor-command-bar`; reopen and select blank to assert the editor is visible with no AI panel.

- [ ] **Step 2: Run the chooser test and verify RED**

Run:
```bash
E2E_PORT=62620 COLLAB_WS_PORT=62621 pnpm exec playwright test e2e/survey-p25-008-source-stash-ui.spec.ts --grep "new survey chooser"
```
Expected: FAIL because `new-survey-dialog` does not exist.

- [ ] **Step 3: Implement the chooser with existing workflows**

Add local dialog state and change Home/My Surveys creation buttons to open the chooser. Render three `Button` choices with `Sparkles`, `LayoutTemplate`, and `FileText` icons. Handlers must close the dialog before calling:
```tsx
openEditor({ withAi: true });
window.location.href = "/surveys?view=templates";
openEditor();
```
Keep deep-link `?create=ai` behavior unchanged.

- [ ] **Step 4: Run the chooser test and verify GREEN**

Run the Step 2 command. Expected: `1 passed`.

- [ ] **Step 5: Commit the chooser slice**

```bash
git add apps/web/app/'(app)'/surveys/page.tsx apps/web/e2e/survey-p25-008-source-stash-ui.spec.ts
git commit -m "feat(survey): unify new survey chooser"
```

### Task 2: Diagnostic Template Center

**Files:**
- Modify: `apps/web/app/(app)/surveys/page.tsx`
- Modify: `apps/web/e2e/survey-p25-008-source-stash-ui.spec.ts`

**Interfaces:**
- Consumes: `allTemplates`, `templateCategories`, `templateListTag`, `setTemplateListTag`, `openEditor({ template })`, `openTemplateEditor(template)`, and existing template API state.
- Produces: stable anchors `diagnostic-template-center`, `template-tag-filter`, `template-card-${id}`, `use-template-${id}`, and `view-report-template-${id}`.

- [ ] **Step 1: Replace the legacy template assertion with a failing diagnostic-center contract**

Update the existing template URL test to expect the title `诊断模板中心`, the Survey sidebar, compact tag filters, a two-column template grid, and real use-template/report-template actions. Assert that `Template Manager` and `template-summary` are absent.

- [ ] **Step 2: Run the template-center test and verify RED**

Run:
```bash
E2E_PORT=62630 COLLAB_WS_PORT=62631 pnpm exec playwright test e2e/survey-p25-008-source-stash-ui.spec.ts --grep "diagnostic template center"
```
Expected: FAIL because the page still renders the legacy template manager.

- [ ] **Step 3: Reshape the existing template branch**

Filter `allTemplates` using `templateListTag`, render compact tag `Button`s above a responsive two-column grid, and keep existing template objects as the only data source. Each card renders ownership/tags, question count/time, description, report summary, `openEditor({ template })`, and `openTemplateEditor(template)`. Preserve saved-template edit/delete operations through a compact overflow/action row instead of removing them.

- [ ] **Step 4: Verify empty and error-safe template states**

When filtering yields zero results, render `data-testid="empty"` with a reset-filter action. Keep template loading failure non-blocking and preserve blank creation.

- [ ] **Step 5: Run the template test and verify GREEN**

Run the Step 2 command. Expected: `1 passed`.

- [ ] **Step 6: Commit the template-center slice**

```bash
git add apps/web/app/'(app)'/surveys/page.tsx apps/web/e2e/survey-p25-008-source-stash-ui.spec.ts
git commit -m "feat(survey): align diagnostic template center"
```

### Task 3: Unified Survey Editor and AI Assistant

**Files:**
- Modify: `apps/web/app/(app)/surveys/page.tsx`
- Modify: `apps/web/e2e/survey-p25-008-source-stash-ui.spec.ts`
- Modify: `apps/web/e2e/survey-p25-011-qwen-ai-workflow.spec.ts`

**Interfaces:**
- Consumes: `WorkspaceShell`, `WorkspaceDesignWorkbench`, existing five-step navigation, question mutation functions, `pendingAiChangeSet`, `confirmedAiOps`, `applyPendingAiChangeSet`, and save/publish functions.
- Produces: stable anchors `survey-editor-workspace`, `survey-diagnostic-summary`, `survey-hypotheses`, `survey-question-canvas`, `survey-ai-assistant`, and existing AI preview/apply anchors unchanged.

- [ ] **Step 1: Write failing editor consistency assertions**

Extend editor E2E coverage to assert one command bar, five workflow steps, no Responses/Settings tabs, a single-boundary survey summary, hypothesis section, continuous question canvas, and subordinate right AI assistant. Retain the existing assertion that applied AI questions immediately appear in the left editor.

- [ ] **Step 2: Run editor tests and verify RED**

Run:
```bash
E2E_PORT=62640 COLLAB_WS_PORT=62641 pnpm exec playwright test e2e/survey-p25-008-source-stash-ui.spec.ts e2e/survey-p25-011-qwen-ai-workflow.spec.ts --grep "unified survey editor|applies"
```
Expected: FAIL on the new editor layout anchors while existing AI behavior remains measurable.

- [ ] **Step 3: Reshape the editor composition without changing mutations**

Keep the five-step `WorkspaceShell` navigation and existing question controls. Consolidate title, description, dimensions, and hypotheses into aligned single-boundary sections; render questions as a continuous canvas; retain all question types/options/reorder/delete/required controls. Remove duplicate labels and command descriptions, not functionality.

- [ ] **Step 4: Simplify the AI assistant presentation**

Keep current messages, quick commands, change preview, selected operations, Apply, Dismiss, busy, fallback, and error states. Reduce repeated instructional copy and ensure the panel never directly overwrites questions before `applyPendingAiChangeSet`.

- [ ] **Step 5: Run editor tests and verify GREEN**

Run the Step 2 command. Expected: all selected tests pass.

- [ ] **Step 6: Run cross-surface verification**

Run:
```bash
pnpm --filter @repo/web typecheck
bash apps/web/scripts/lint-design.sh
E2E_PORT=62650 COLLAB_WS_PORT=62651 pnpm exec playwright test e2e/survey-p25-008-source-stash-ui.spec.ts
git diff --check
```
Expected: all commands exit 0. Capture desktop and mobile screenshots in `phases/phase-p25-survey/sprints/sprint-12/evidence/`.

- [ ] **Step 7: Record Harness evidence and commit**

Update `progress.md` and `session-handoff.md`, add a focused evidence Markdown file with RED/GREEN commands and screenshot paths, then commit:
```bash
git add apps/web/app/'(app)'/surveys/page.tsx apps/web/e2e phases/phase-p25-survey/sprints/sprint-12 docs/superpowers/plans/2026-07-17-survey-unified-creation-surfaces.md
git commit -m "feat(survey): unify creation workspace surfaces"
```

