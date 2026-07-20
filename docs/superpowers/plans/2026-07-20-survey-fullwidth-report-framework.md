# Survey Full-Width Report Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Survey design, template, and report steps use their requested full-width layouts while rendering and generating reports strictly from the saved ordered template, including a non-fabricated zero-response framework.

**Architecture:** Keep `WorkspaceShell` as the stable full-width owner and change only each step's internal grid. Add a separate template-framework chapter type for zero-response reads, build it from the normalized saved snapshot, and render it through the same report document without permitting framework chapters to enter artifact validation or model generation.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, Vitest, Playwright, phase-p25 Harness.

## Global Constraints

- Keep the persistent five-step workflow header unchanged.
- Use `minmax(0, 3fr) minmax(360px, 2fr)` for the open questionnaire editor and AI assistant at `xl`.
- Do not add draggable or persisted column widths.
- Do not generate simulated responses, metrics, claims, chart series, or images.
- POST with zero responses must return `422 report_requires_responses` before claiming a job or calling a model.
- Generated artifacts must preserve saved chapter count, order, title, and output type and publish atomically.
- Keep existing Survey authorization and server-side response aggregation unchanged.
- Add no dependencies.

---

### Task 1: Register F26 in the Harness

**Files:**
- Create: `phases/phase-p25-survey/requirements/25-fullwidth-report-framework.md`
- Modify: `phases/phase-p25-survey/feature_list.json`
- Create: `phases/phase-p25-survey/sprints/sprint-26/sprint.md`
- Create: `phases/phase-p25-survey/sprints/sprint-26/progress.md`
- Create: `phases/phase-p25-survey/sprints/sprint-26/session-handoff.md`
- Generated: `phases/phase-p25-survey/sprints/sprint-26/active-features.json`

**Interfaces:**
- Consumes: approved design spec and GitHub Issue `#811`.
- Produces: one `in_progress` F26 with executable verification commands.

- [ ] **Step 1: Write the requirement**

Define `# R1 全宽工作区与模板报告框架` with these acceptance statements:

```markdown
- 设计问卷桌面端主编辑区与 AI 助手按 6:4 展示，移动端上下排列。
- 报告模板和分析报告使用五步导航下方全部可用宽度。
- 有答卷报告按保存的模板章节顺序逐章生成并原子发布。
- 无答卷时按相同模板顺序显示章节框架，不调用模型，不制造数据。
```

- [ ] **Step 2: Add F26 to `feature_list.json`**

Use:

```json
{
  "id": "F26",
  "priority": 1,
  "area": "survey",
  "title": "扩展工作流布局并保留无数据报告框架",
  "user_visible_behavior": "设计问卷在桌面端以 6:4 展示编辑区和 AI 助手；报告模板与分析报告铺满导航下方空间；分析报告始终按已保存模板的章节顺序组装，有答卷时逐章生成，无答卷时直接展示同顺序章节框架且不调用模型。",
  "spec_ref": "25-fullwidth-report-framework.md#R1",
  "design_ref": "requirements/25-fullwidth-report-framework.md；docs/superpowers/specs/2026-07-20-survey-fullwidth-report-framework-design.md；GitHub #811",
  "status": "in_progress",
  "sprint": "26",
  "owner": "wrk-survey-1",
  "capability": "CAP-WEB",
  "depends_on": ["F25"],
  "wave": 23,
  "verification": [
    "pnpm --filter @repo/web run test -- survey-template-report survey-report.route",
    "pnpm --filter @repo/web run lint",
    "pnpm --filter @repo/web run typecheck",
    "E2E_PORT=62688 COLLAB_WS_PORT=62689 pnpm --filter @repo/web exec playwright test e2e/survey-p25-026-fullwidth-report-framework.spec.ts",
    "pnpm harness doctor --phase p25",
    "git cat-file -e HEAD:phases/phase-p25-survey/sprints/sprint-26/evidence/F26.verify.log"
  ],
  "notes": "独立 UI 与报告读取 feature，Issue #811；从 PR #806 分支派生 stacked PR。"
}
```

- [ ] **Step 3: Scaffold sprint 26**

Run:

```bash
pnpm harness new-sprint --phase p25 --id 26 \
  --goal "统一 Survey 全宽布局并按模板显示无数据报告框架" \
  --features F26
```

Expected: sprint files are created and `active-features.json` contains only F26 as `in_progress`.

- [ ] **Step 4: Audit the starting state**

Run:

```bash
pnpm harness doctor --phase p25
```

Expected: `0 FAIL`.

- [ ] **Step 5: Commit**

```bash
git add phases/phase-p25-survey
git commit -m "docs(survey): define F26 report framework"
```

---

### Task 2: Build a Zero-Response Template Framework

**Files:**
- Modify: `apps/web/lib/survey-template-report.test.ts`
- Modify: `apps/web/lib/survey-template-report.ts`
- Modify: `apps/web/lib/survey-report-document.ts`

**Interfaces:**
- Consumes: `SurveyReportTemplateSnapshot`.
- Produces:
  - `TemplateDrivenReportFrameworkChapter`
  - `PublicTemplateDrivenSurveyReportView`
  - `buildEmptyTemplateDrivenReport(input)`
  - `isTemplateDrivenReportFrameworkChapter(chapter)`

- [ ] **Step 1: Write the failing framework test**

Add a test that calls:

```ts
const report = buildEmptyTemplateDrivenReport({
  title: "经营诊断报告",
  generatedAt: "2026-07-20T00:00:00.000Z",
  sourceRevision: "source-empty",
  snapshot: buildSurveyReportTemplateSnapshot(reportPlan),
  questionCount: 8,
});
```

Assert:

```ts
expect(report.status).toBe("empty");
expect(report.sample).toEqual({
  responseCount: 0,
  questionCount: 8,
  confidence: "none",
});
expect(report.chapters.map(({ chapterId, order, title, outputType }) => ({
  chapterId, order, title, outputType,
}))).toEqual([
  { chapterId: "summary", order: 1, title: "管理层摘要", outputType: "text" },
  { chapterId: "trend", order: 2, title: "趋势对比", outputType: "chart" },
  { chapterId: "visual", order: 3, title: "场景视觉", outputType: "image" },
]);
expect(report.chapters.every((chapter) => chapter.state === "framework"))
  .toBe(true);
expect(JSON.stringify(report)).not.toContain("evidenceRefs");
expect(JSON.stringify(report)).not.toContain("series");
expect(JSON.stringify(report)).not.toContain("assetId");
```

- [ ] **Step 2: Run the test and observe RED**

Run:

```bash
pnpm --filter @repo/web run test -- survey-template-report
```

Expected: FAIL because `buildEmptyTemplateDrivenReport` is not exported.

- [ ] **Step 3: Add the framework-only types**

Define:

```ts
export interface TemplateDrivenReportFrameworkChapter {
  state: "framework";
  chapterId: string;
  order: number;
  title: string;
  requirement: string;
  outputType: SurveyReportOutputType;
  chartTemplateId?: SurveyReportChartTemplateId;
}

export interface PublicTemplateDrivenSurveyReportView
  extends Omit<PublicTemplateDrivenSurveyReport, "chapters"> {
  chapters: Array<
    PublicTemplateDrivenReportChapter | TemplateDrivenReportFrameworkChapter
  >;
}
```

Keep `TemplateDrivenSurveyReport` and `validateTemplateDrivenReport` restricted
to generated artifact chapters so framework chapters cannot be persisted as a
successful generated report.

- [ ] **Step 4: Implement the empty report builder**

Implement:

```ts
export function buildEmptyTemplateDrivenReport(input: {
  title: string;
  generatedAt: string;
  sourceRevision: string;
  snapshot: SurveyReportTemplateSnapshot;
  questionCount: number;
}): PublicTemplateDrivenSurveyReportView {
  return {
    schemaVersion: TEMPLATE_DRIVEN_REPORT_SCHEMA_VERSION,
    title: input.title,
    generatedAt: input.generatedAt,
    sourceRevision: input.sourceRevision,
    status: "empty",
    templateSnapshot: input.snapshot,
    sample: {
      responseCount: 0,
      questionCount: input.questionCount,
      confidence: "none",
    },
    chapters: input.snapshot.chapters.map((chapter) => ({
      state: "framework" as const,
      chapterId: chapter.id,
      order: chapter.order,
      title: chapter.title,
      requirement: chapter.requirement,
      outputType: chapter.outputType,
      ...(chapter.chartTemplateId
        ? { chartTemplateId: chapter.chartTemplateId }
        : {}),
    })),
  };
}
```

Add a type guard that checks `chapter.state === "framework"`.

- [ ] **Step 5: Run the test and observe GREEN**

Run:

```bash
pnpm --filter @repo/web run test -- survey-template-report
```

Expected: all template report contract tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/survey-template-report.ts \
  apps/web/lib/survey-template-report.test.ts \
  apps/web/lib/survey-report-document.ts
git commit -m "feat(survey): build empty template report framework"
```

---

### Task 3: Return the Framework Without Relaxing Generation

**Files:**
- Modify: `apps/web/app/api/surveys/[id]/professional-report/survey-report.route.test.ts`
- Modify: `apps/web/app/api/surveys/[id]/professional-report/route.ts`

**Interfaces:**
- Consumes: `buildEmptyTemplateDrivenReport`.
- Produces: GET preview with ordered framework chapters for zero responses.
- Preserves: POST `422 report_requires_responses`.

- [ ] **Step 1: Write the failing GET test**

Mock zero responses and a three-chapter report plan, call GET, and assert:

```ts
expect(response?.status).toBe(200);
const payload = await response?.json();
expect(payload.preview).toBe(true);
expect(payload.report.schemaVersion).toBe("template-driven-report-v1");
expect(payload.report.status).toBe("empty");
expect(payload.report.chapters.map((chapter: {
  chapterId: string;
  outputType: string;
}) => [chapter.chapterId, chapter.outputType])).toEqual([
  ["summary", "text"],
  ["trend", "chart"],
  ["visual", "image"],
]);
expect(mocks.callQwenJson).not.toHaveBeenCalled();
expect(mocks.claimSurveyReportGeneration).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run the route tests and observe RED**

Run:

```bash
pnpm --filter @repo/web run test -- survey-report.route
```

Expected: GET returns the legacy fixed professional report instead of template
framework chapters.

- [ ] **Step 3: Replace only the no-artifact fallback**

In GET, build the snapshot once and use:

```ts
const report = await artifactReport(artifact)
  ?? buildEmptyTemplateDrivenReport({
    title: context.reportCategoryPlan.title || context.survey.title,
    generatedAt: new Date().toISOString(),
    sourceRevision: context.sourceSnapshot.sourceRevision,
    snapshot: buildSurveyReportTemplateSnapshot(context.reportCategoryPlan),
    questionCount: context.evidence.survey.questionCount,
  });
```

Do not change POST's zero-response guard or the existing sequential
`generateTemplateReportChapters` call.

- [ ] **Step 4: Strengthen the existing POST test**

Keep the `422` assertions and additionally assert the response has no `report`
property:

```ts
const payload = await response?.json();
expect(payload).not.toHaveProperty("report");
```

- [ ] **Step 5: Run route and generation tests**

Run:

```bash
pnpm --filter @repo/web run test -- \
  survey-report.route survey-report-chapter-generation survey-template-report
```

Expected: all tests pass; sequential chapter generation tests still prove saved
template order.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/api/surveys/[id]/professional-report/route.ts \
  apps/web/app/api/surveys/[id]/professional-report/survey-report.route.test.ts
git commit -m "feat(survey): return ordered report framework without responses"
```

---

### Task 4: Render Framework Chapters and Expand the Three Workspaces

**Files:**
- Modify: `apps/web/components/survey/professional-report-document.tsx`
- Modify: `apps/web/components/survey/survey-professional-report-workbench.tsx`
- Modify: `apps/web/app/(app)/surveys/page.tsx`
- Create: `apps/web/e2e/survey-p25-026-fullwidth-report-framework.spec.ts`

**Interfaces:**
- Consumes: `PublicTemplateDrivenSurveyReportView` and framework chapter guard.
- Produces: visible ordered framework chapters plus full-width layout contracts.

- [ ] **Step 1: Write the failing Playwright contract**

Create a test that registers a survey with ordered text, chart, and image report
chapters, opens each workflow step, and asserts:

```ts
const design = page.getByTestId("survey-editor-workspace");
const designBox = await design.boundingBox();
const builderBox = await page.getByTestId("question-builder-panel").boundingBox();
const assistantBox = await page.getByTestId("survey-ai-assistant").boundingBox();
expect(builderBox!.width / designBox!.width).toBeGreaterThan(0.56);
expect(builderBox!.width / designBox!.width).toBeLessThan(0.64);
expect(assistantBox!.width / designBox!.width).toBeGreaterThan(0.36);
```

For template and report, compare their outer workspaces against
`survey-workflow-content` and require no more than 2 px width difference after
accounting for shared padding.

For zero responses:

```ts
await expect(page.getByTestId("professional-report-chapter-summary")).toBeVisible();
await expect(page.getByTestId("professional-report-chapter-trend")).toBeVisible();
await expect(page.getByTestId("professional-report-chapter-visual")).toBeVisible();
expect(await page.locator("[data-report-chapter-state='framework']")
  .evaluateAll((nodes) => nodes.map((node) => node.id))).toEqual([
  "report-chapter-summary",
  "report-chapter-trend",
  "report-chapter-visual",
]);
await expect(page.getByRole("button", { name: "重新生成" })).toBeDisabled();
```

- [ ] **Step 2: Run Playwright and observe RED**

Run:

```bash
E2E_PORT=62688 COLLAB_WS_PORT=62689 \
  pnpm --filter @repo/web exec playwright test \
  e2e/survey-p25-026-fullwidth-report-framework.spec.ts
```

Expected: layout width assertions and framework chapter assertions fail.

- [ ] **Step 3: Render framework chapters**

In `TemplateDrivenReportDocument`, branch before generated output rendering:

```tsx
const framework = isTemplateDrivenReportFrameworkChapter(chapter);
```

Set:

```tsx
data-report-chapter-state={framework ? "framework" : "generated"}
```

For framework chapters, render the saved requirement and one output-specific
empty surface:

```tsx
<p>生成要求：{chapter.requirement}</p>
```

- text: `等待真实答卷后生成结论与证据`
- chart: show `ECharts 模板：{chapter.chartTemplateId}` and
  `等待真实答卷后生成图表数据`
- image: `等待真实答卷后生成研究视觉`

Do not mount `SurveyEChartsCanvas` or `Image` for framework chapters.

- [ ] **Step 4: Apply the layout rules**

In the questionnaire editor, replace the fixed open AI width with:

```tsx
"grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)]"
```

Keep the collapsed assistant rail behavior unchanged.

Remove outer `mx-auto`/`max-w-*` width constraints from the report-template
workspace while preserving its three internal columns.

In `SurveyProfessionalReportWorkbench`, replace the toolbar and reading surface
`max-w-6xl`/`max-w-5xl` wrappers with `w-full`; retain local `max-w-3xl` prose
constraints inside `ProfessionalReportDocument`.

- [ ] **Step 5: Run browser verification and observe GREEN**

Run:

```bash
E2E_PORT=62688 COLLAB_WS_PORT=62689 \
  pnpm --filter @repo/web exec playwright test \
  e2e/survey-p25-026-fullwidth-report-framework.spec.ts
```

Expected: one passing test with desktop and mobile screenshots written to
`phases/phase-p25-survey/sprints/sprint-26/evidence/`.

- [ ] **Step 6: Run focused static checks**

Run:

```bash
pnpm --filter @repo/web run lint
pnpm --filter @repo/web run typecheck
```

Expected: both commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/'(app)'/surveys/page.tsx \
  apps/web/components/survey/professional-report-document.tsx \
  apps/web/components/survey/survey-professional-report-workbench.tsx \
  apps/web/e2e/survey-p25-026-fullwidth-report-framework.spec.ts \
  phases/phase-p25-survey/sprints/sprint-26/evidence
git commit -m "feat(survey): expand workflow report surfaces"
```

---

### Task 5: Verify, Record Evidence, and Prepare the F26 PR

**Files:**
- Modify: `.agents/skills/mod-survey/SKILL.md`
- Generated: `phases/phase-p25-survey/sprints/sprint-26/evidence/F26.verify.log`
- Modify: `phases/phase-p25-survey/sprints/sprint-26/progress.md`
- Modify: `phases/phase-p25-survey/sprints/sprint-26/session-handoff.md`
- Harness-managed: `phases/phase-p25-survey/feature_list.json`

**Interfaces:**
- Consumes: completed F26 implementation and verification commands.
- Produces: Harness `passing` evidence and a clean stacked PR for Issue #811.

- [ ] **Step 1: Append the module lesson**

Append:

```markdown
- 2026-07-20：零答卷报告读取应由已保存模板快照构建只读章节框架，框架类型不能进入生成产物校验；
  POST 仍须在 claim/model 前拒绝零答卷，避免为了展示结构而制造数据
  （出处：phase-p25 F26 / issue #811）。
```

- [ ] **Step 2: Run the Harness doctor**

```bash
pnpm harness doctor --phase p25
```

Expected: `0 FAIL / 0 WARN`.

- [ ] **Step 3: Run the authoritative verification**

```bash
pnpm harness verify --sprint p25/26 --feature F26
```

Expected: all F26 commands and `verify:base` pass; Harness moves F26 to
`passing` and writes `evidence/F26.verify.log`.

- [ ] **Step 4: Confirm evidence is committed material**

```bash
git add -f phases/phase-p25-survey/sprints/sprint-26/evidence/F26.verify.log
git ls-files phases/phase-p25-survey/sprints/sprint-26/evidence
```

Expected: verify log and all referenced screenshots are listed.

- [ ] **Step 5: Update handoff records**

Record exact verification commands, generated evidence paths, no-response
boundary, current commit, and the dependency on PR #806.

- [ ] **Step 6: Commit the Harness-managed result**

```bash
git add .agents/skills/mod-survey/SKILL.md \
  phases/phase-p25-survey/feature_list.json \
  phases/phase-p25-survey/sprints/sprint-26
git commit -m "chore(harness): mark survey F26 passing"
```

- [ ] **Step 7: Final clean-state checks**

```bash
git diff --check
git status --short
git ls-tree -r HEAD -- phases/phase-p25-survey/sprints/sprint-26/evidence
```

Expected: no unstaged changes and every evidence file has a Git blob.

- [ ] **Step 8: Push and create the independent PR**

Push `codex/p25-f26-fullwidth-report-framework` and create a ready PR with:

```markdown
Closes #811
Depends on #806
```

Target `codex/p25-f25-unified-workflow-ui` until PR #806 merges, then retarget
to `main`.
