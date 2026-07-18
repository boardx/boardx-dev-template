# Survey Single-output Report Chapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each Survey report chapter select exactly one image, chart, or text output while the right column previews that output and exposes a read-only official ECharts option for chart chapters.

**Architecture:** Extend the existing report-category JSON contract with a normalized single `outputType` and allowlisted `chartTemplateId`, while retaining `inputModes` only as a legacy compatibility field. Keep official chart templates in a pure serializable registry, render them through a focused client component, and include the normalized output contract in the existing versioned report requirement hash.

**Tech Stack:** TypeScript, React 18, Next.js 14, Apache ECharts 6.1, Vitest, Playwright, existing `@repo/data` Survey repositories and versioned report APIs.

## Global Constraints

- Work only in `.worktrees/p25-f16-survey-report-fact-base` on `codex/p25-f16-survey-report-fact-base`.
- Do not add dependencies; reuse the installed `echarts` and `lucide-react` packages.
- Each chapter has exactly one `outputType`: `image`, `chart`, or `text`.
- Existing saved chapters without `outputType` normalize to `text`.
- Do not restore individual-question selection or send raw responses to the browser.
- Store an allowlisted chart template identifier, never arbitrary executable ECharts JavaScript.
- ECharts option JSON is complete, read-only, and copyable.
- Official sample values are preview-only and never enter report evidence or generated artifacts.
- Output type and chart template participate in `requirementHash`.
- Changing the output contract marks the latest report stale; generation remains an explicit action.
- Do not modify `active-features.json` or hand-edit F16 `status`/`owner`/`evidence`.
- F17 LangGraph and autonomous file retrieval remain out of scope.

---

### Task 1: Amend the authoritative F16 requirement and verification contract

**Files:**
- Modify: `phases/phase-p25-survey/requirements/15-versioned-fact-base-report-composer.md`
- Modify: `phases/phase-p25-survey/ui-signoff.md`
- Modify: `phases/phase-p25-survey/feature_list.json`
- Modify: `docs/superpowers/specs/2026-07-18-survey-versioned-report-architecture.md`

**Interfaces:**
- Consumes: approved design `docs/superpowers/specs/2026-07-18-survey-single-output-report-chapter-design.md`.
- Produces: F16 acceptance text that matches the approved single-output UI without changing harness-controlled status fields.

- [ ] **Step 1: Replace the superseded UI requirement**

Change the requirement from “delete output module selection” to:

```markdown
- 删除逐题绑定、可添加问题、自由模块堆叠和可编辑映射 JSON。
- 每章必须且只能选择一种输出：图片、图表或文本。
- 图表使用白名单 ECharts 官方模板，右栏提供效果预览和只读 Option JSON。
- 自然语言要求描述分析约束；系统仍从整份问卷事实库检索证据。
```

- [ ] **Step 2: Record the confirmed incremental UI signoff**

Append a dated confirmation that references the approved design document and the
Apache ECharts `line-simple` page. Do not change the existing frontmatter status.

- [ ] **Step 3: Amend F16 behavior and verification without touching harness state**

Set `user_visible_behavior` to describe:

```text
每个报告章节只能选择图片、图表或文本中的一种；图表可从常用 ECharts 模板中选择，
右侧同屏显示效果预览和只读 Option JSON。章节要求仍为自然语言，生成时从整份问卷
和全部授权答卷自主获取证据；输出契约变化后须主动生成不可变新版本。
```

Add this focused verification before lint:

```text
pnpm --filter @repo/web run test -- survey-report-chart-templates survey-report-category-plan
```

Do not edit `status`, `owner`, or `evidence`.

- [ ] **Step 4: Validate documents and JSON**

Run:

```bash
jq empty phases/phase-p25-survey/feature_list.json
git diff --check
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit the requirement amendment**

```bash
git add phases/phase-p25-survey/requirements/15-versioned-fact-base-report-composer.md \
  phases/phase-p25-survey/ui-signoff.md \
  phases/phase-p25-survey/feature_list.json \
  docs/superpowers/specs/2026-07-18-survey-versioned-report-architecture.md
git commit -m "docs(survey): amend F16 output selection contract"
```

---

### Task 2: Normalize a single persisted output contract

**Files:**
- Modify: `packages/data/src/survey.ts`
- Modify: `packages/data/src/survey-source-contract.test.ts`
- Modify: `apps/web/app/api/surveys/[id]/professional-report/route.ts`

**Interfaces:**
- Consumes: existing `SurveyReportCategoryInput`, `cleanSurveyReportCategoryPlan`, and versioned report requirement hashing.
- Produces:

```ts
export type SurveyReportOutputType = "image" | "chart" | "text";
export type SurveyReportChartTemplateId =
  | "line-simple"
  | "bar-simple"
  | "pie-simple"
  | "scatter-simple"
  | "radar"
  | "funnel"
  | "gauge"
  | "heatmap-cartesian";

export interface SurveyReportCategoryInput {
  // existing fields remain for compatibility
  outputType: SurveyReportOutputType;
  chartTemplateId?: SurveyReportChartTemplateId;
}
```

- [ ] **Step 1: Write failing normalizer tests**

Add these cases to `survey-source-contract.test.ts`:

```ts
it("normalizes an explicit chart chapter to one output type", () => {
  const plan = cleanSurveyReportCategoryPlan({
    categories: [{
      id: "safety",
      name: "安全认知",
      outputType: "chart",
      inputModes: ["chart", "text"],
      chartType: "line",
      questionIds: [],
      prompt: "分析安全认知",
      order: 1,
      isCustom: false,
    }],
  }, "商品安全调研");

  expect(plan.categories[0]).toMatchObject({
    outputType: "chart",
    inputModes: ["chart"],
    chartTemplateId: "line-simple",
  });
});

it("defaults chapters without a valid output type to text", () => {
  const plan = cleanSurveyReportCategoryPlan({
    categories: [{
      id: "summary",
      name: "总结",
      inputModes: ["chart", "text"],
      chartType: "line",
    }],
  }, "商品安全调研");

  expect(plan.categories[0]).toMatchObject({
    outputType: "text",
    inputModes: ["text"],
  });
  expect(plan.categories[0]?.chartTemplateId).toBeUndefined();
});
```

- [ ] **Step 2: Run the data test and verify RED**

Run:

```bash
pnpm --filter @repo/data run test -- survey-source-contract
```

Expected: FAIL because `outputType` and `chartTemplateId` are absent and
`inputModes` still accepts multiple values.

- [ ] **Step 3: Implement minimal normalization**

Add allowlists and normalization equivalent to:

```ts
const REPORT_OUTPUT_TYPES = new Set<SurveyReportOutputType>(["image", "chart", "text"]);
const REPORT_CHART_TEMPLATE_IDS = new Set<SurveyReportChartTemplateId>([
  "line-simple",
  "bar-simple",
  "pie-simple",
  "scatter-simple",
  "radar",
  "funnel",
  "gauge",
  "heatmap-cartesian",
]);

function cleanReportOutputType(explicit: unknown): SurveyReportOutputType {
  if (REPORT_OUTPUT_TYPES.has(explicit as SurveyReportOutputType)) {
    return explicit as SurveyReportOutputType;
  }
  return "text";
}
```

For each cleaned category:

```ts
const outputType = cleanReportOutputType(item.outputType);
const chartTemplateId = outputType === "chart"
  ? cleanChartTemplateId(item.chartTemplateId, item.chartType)
  : undefined;

return {
  // existing fields
  outputType,
  inputModes: [outputType],
  chartType: outputType === "chart"
    ? chartTypeForTemplate(chartTemplateId)
    : undefined,
  chartTemplateId,
};
```

Default and custom chapters must set `outputType: "text"` and
`inputModes: ["text"]`.

- [ ] **Step 4: Include the output contract in report hashing**

Change `reportRequirementPayload()` category mapping to include:

```ts
outputType: category.outputType,
chartTemplateId:
  category.outputType === "chart" ? category.chartTemplateId : undefined,
```

Do not include legacy `questionIds`, sample values, or browser preview state.

- [ ] **Step 5: Run focused data and Web type verification**

Run:

```bash
pnpm --filter @repo/data run test -- survey-source-contract survey-report-version
pnpm --filter @repo/data run typecheck
pnpm --filter @repo/web run typecheck
```

Expected: all commands pass. Fix every existing report-category fixture to provide
the normalized output type rather than weakening the new type.

- [ ] **Step 6: Commit the data contract**

```bash
git add packages/data/src/survey.ts \
  packages/data/src/survey-source-contract.test.ts \
  apps/web/app/api/surveys/'[id]'/professional-report/route.ts
git commit -m "feat(survey): persist one report output per chapter"
```

---

### Task 3: Add the official ECharts option registry

**Files:**
- Create: `apps/web/lib/survey-report-chart-templates.ts`
- Create: `apps/web/lib/survey-report-chart-templates.test.ts`

**Interfaces:**
- Consumes: `SurveyReportChartTemplateId` from `@repo/data`.
- Produces:

```ts
export interface SurveyReportChartTemplate {
  id: SurveyReportChartTemplateId;
  label: string;
  description: string;
  sourceUrl: string;
  option: Record<string, unknown>;
}

export const SURVEY_REPORT_CHART_TEMPLATES: readonly SurveyReportChartTemplate[];
export function getSurveyReportChartTemplate(
  id: SurveyReportChartTemplateId
): SurveyReportChartTemplate;
export function stringifySurveyReportChartOption(
  id: SurveyReportChartTemplateId
): string;
```

- [ ] **Step 1: Write failing registry tests**

```ts
it("keeps the official line-simple option shape", () => {
  expect(getSurveyReportChartTemplate("line-simple").option).toEqual({
    xAxis: {
      type: "category",
      data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    },
    yAxis: { type: "value" },
    series: [{
      data: [150, 230, 224, 218, 135, 147, 260],
      type: "line",
    }],
  });
});

it("only exposes serializable allowlisted options", () => {
  expect(SURVEY_REPORT_CHART_TEMPLATES).toHaveLength(8);
  for (const template of SURVEY_REPORT_CHART_TEMPLATES) {
    const json = JSON.stringify(template.option);
    expect(json).not.toContain("function");
    expect(json).not.toContain("http://");
    expect(json).not.toContain("https://");
    expect(JSON.parse(json)).toEqual(template.option);
  }
});
```

- [ ] **Step 2: Run the registry test and verify RED**

Run:

```bash
pnpm --filter @repo/web run test -- survey-report-chart-templates
```

Expected: FAIL because the registry module does not exist.

- [ ] **Step 3: Implement eight serializable official option templates**

Use the option objects from these Apache ECharts example families:

```ts
const templateIds: SurveyReportChartTemplateId[] = [
  "line-simple",
  "bar-simple",
  "pie-simple",
  "scatter-simple",
  "radar",
  "funnel",
  "gauge",
  "heatmap-cartesian",
];
```

Every `sourceUrl` must use:

```ts
`https://echarts.apache.org/examples/zh/editor.html?c=${id}`
```

Keep every option JSON-serializable. Do not copy formatter functions, remote image
URLs, animation callbacks, or script expressions from examples.

- [ ] **Step 4: Run registry tests and verify GREEN**

Run:

```bash
pnpm --filter @repo/web run test -- survey-report-chart-templates
```

Expected: both registry tests pass.

- [ ] **Step 5: Commit the template registry**

```bash
git add apps/web/lib/survey-report-chart-templates.ts \
  apps/web/lib/survey-report-chart-templates.test.ts
git commit -m "feat(survey): add allowlisted ECharts report templates"
```

---

### Task 4: Build the single-output editor and chapter preview

**Files:**
- Create: `apps/web/components/survey/survey-report-output-preview.tsx`
- Modify: `apps/web/components/survey/survey-versioned-report-composer.tsx`
- Modify: `apps/web/lib/survey-report-category-plan.ts`
- Modify: `apps/web/lib/survey-report-category-plan.test.ts`

**Interfaces:**
- Consumes: normalized chapter output contract and the chart registry from Tasks 2-3.
- Produces:

```ts
interface SurveyReportOutputPreviewProps {
  category: SurveyReportCategoryInput;
  responseCount: number;
}

export function SurveyReportOutputPreview(
  props: SurveyReportOutputPreviewProps
): JSX.Element;
```

- [ ] **Step 1: Write failing planner tests**

Replace the old “always text” assertion with:

```ts
expect(preview.sections[0]).toMatchObject({
  inputModes: ["chart"],
  chart: {
    type: "line",
    templateId: "line-simple",
    isSimulated: true,
  },
});
expect(preview.sections[0]?.questionCount).toBe(1);
```

Add separate image and text cases so each preview section contains only its selected
output.

- [ ] **Step 2: Run planner tests and verify RED**

Run:

```bash
pnpm --filter @repo/web run test -- survey-report-category-plan
```

Expected: FAIL because `buildReportComposerPreview()` still forces `["text"]`.

- [ ] **Step 3: Make preview construction output-aware**

Build the section from `category.outputType`:

```ts
const outputType = category.outputType ?? "text";
return {
  // shared fields
  inputModes: [outputType],
  text: outputType === "text" ? buildTextPreview(category, survey) : undefined,
  image: outputType === "image" ? buildImagePreview(category) : undefined,
  chart: outputType === "chart"
    ? buildChartPreview(category, survey)
    : undefined,
};
```

Preview rows may use explicit sample values only inside the draft preview object.
They must retain `isSimulated: true` and must not be passed to the report POST body.

- [ ] **Step 4: Implement the output preview component**

The component must:

```tsx
if (category.outputType === "chart") {
  return (
    <div>
      <div role="tablist" aria-label="图表预览方式">
        <button role="tab" aria-selected={view === "preview"} onClick={() => setView("preview")}>
          效果预览
        </button>
        <button role="tab" aria-selected={view === "json"} onClick={() => setView("json")}>
          Option JSON
        </button>
      </div>
      {view === "preview" ? (
        <EChartsOptionCanvas option={template.option} />
      ) : (
        <div role="tabpanel">
        <Button aria-label="复制 Option JSON" onClick={copyOption}>
          <Copy />
        </Button>
        <pre data-testid="report-chart-option-json">
          {JSON.stringify(template.option, null, 2)}
        </pre>
        </div>
      )}
    </div>
  );
}
```

Use `echarts.init()`, `instance.setOption(option, true)`, `ResizeObserver`, and cleanup
with `instance.dispose()`. Register only the chart and component modules used by the
eight templates.

For text, render the chapter title, requirement, evidence boundary, and empty/generated
state as document typography. For image, render the natural-language image requirement
and an explicit “生成报告后显示图片” empty state; do not fabricate an image asset.

- [ ] **Step 5: Add the single-selection controls**

In the middle column add a stable three-option segmented control:

```tsx
const OUTPUT_OPTIONS = [
  { value: "image", label: "图片", icon: ImageIcon },
  { value: "chart", label: "图表", icon: BarChart3 },
  { value: "text", label: "文本", icon: Type },
] as const;
```

Each button uses `aria-pressed`, a visible checked state, and:

```tsx
onClick={() => patchSelected({
  outputType: option.value,
  inputModes: [option.value],
  chartTemplateId:
    option.value === "chart"
      ? selectedCategory.chartTemplateId ?? "line-simple"
      : undefined,
})}
```

When chart is selected, show the compact eight-template chooser below the segmented
control. Do not add question selectors, editable JSON, manual dimensions, colors, or
sorting controls.

- [ ] **Step 6: Replace the right full-report panel with chapter preview**

Render:

```tsx
<SurveyReportOutputPreview
  category={selectedCategory}
  responseCount={survey.responses}
/>
```

Keep generation state, timestamp, and collapsible immutable version history in the
right column. The existing complete report remains reachable through the report flow;
do not render `ProfessionalReportDocument` inside this chapter configuration panel.

Use a viewport-bounded desktop layout:

```text
xl:grid-cols-[240px_minmax(360px,0.9fr)_minmax(480px,1.1fr)]
xl:max-h-[calc(100vh-11rem)]
```

Each column scrolls internally. The mobile layout remains a single column without
horizontal overflow.

- [ ] **Step 7: Run focused tests, lint, and typecheck**

Run:

```bash
pnpm --filter @repo/web run test -- survey-report-chart-templates survey-report-category-plan
pnpm --filter @repo/web run lint
pnpm --filter @repo/web run typecheck
```

Expected: all commands pass with no design-lint violations.

- [ ] **Step 8: Commit the UI**

```bash
git add apps/web/components/survey/survey-report-output-preview.tsx \
  apps/web/components/survey/survey-versioned-report-composer.tsx \
  apps/web/lib/survey-report-category-plan.ts \
  apps/web/lib/survey-report-category-plan.test.ts
git commit -m "feat(survey): preview one output per report chapter"
```

---

### Task 5: Prove persistence, hashing, layout, and official option fidelity

**Files:**
- Modify: `apps/web/e2e/survey-p25-016-versioned-report-composer.spec.ts`
- Update through harness only: `phases/phase-p25-survey/sprints/sprint-16/evidence/F16.verify.log`
- Create through Playwright: `phases/phase-p25-survey/sprints/sprint-16/evidence/survey-report-single-output-desktop.png`

**Interfaces:**
- Consumes: API persistence, requirement hashing, single-output UI, and ECharts preview.
- Produces: F16 end-to-end evidence and refreshed harness verification.

- [ ] **Step 1: Write the failing E2E assertions**

Add this user path after opening the composer:

```ts
await expect(page.getByTestId("report-output-type")).toBeVisible();
await page.getByRole("button", { name: "图表" }).click();
await expect(page.getByRole("button", { name: "基础折线图" })).toHaveAttribute(
  "aria-pressed",
  "true"
);
await expect(page.getByTestId("report-chart-canvas")).toBeVisible();
await page.getByRole("tab", { name: "Option JSON" }).click();
await expect(page.getByTestId("report-chart-option-json")).toContainText(
  '"data": ['
);
await expect(page.getByTestId("report-chart-option-json")).toContainText(
  "150"
);
await expect(page.getByTestId("report-chart-option-json")).toContainText(
  '"type": "line"'
);
```

Save, reload, and assert:

```ts
await expect(page.getByRole("button", { name: "图表" })).toHaveAttribute(
  "aria-pressed",
  "true"
);
await expect(page.getByRole("button", { name: "基础折线图" })).toHaveAttribute(
  "aria-pressed",
  "true"
);
```

After generating one version, change the output to text, save, and verify a subsequent
POST returns `reused: false` and creates a second immutable version. Assert the browser
payload still does not contain raw response records.

- [ ] **Step 2: Run E2E and verify RED**

Run:

```bash
pnpm --filter @repo/web exec playwright test \
  e2e/survey-p25-016-versioned-report-composer.spec.ts
```

Expected: FAIL because the output selector, chart canvas, and JSON tab do not exist.

- [ ] **Step 3: Complete only fixes required by the E2E**

Fix accessible names, persistence, requirement hashing, stable dimensions, and mobile
overflow. Do not expand scope to multi-output chapters or editable options.

- [ ] **Step 4: Run the complete F16 verification list**

Run:

```bash
pnpm --filter @repo/data run test -- survey-report-version
pnpm --filter @repo/web run test -- survey-report-chart-templates survey-report-category-plan
pnpm --filter @repo/web run test -- survey-report
pnpm --filter @repo/web run lint
pnpm --filter @repo/web run typecheck
pnpm --filter @repo/web exec playwright test \
  e2e/survey-p25-016-versioned-report-composer.spec.ts
pnpm harness doctor --phase p25
```

Expected: every command exits 0.

- [ ] **Step 5: Run the harness gate and inspect evidence**

Run:

```bash
pnpm harness verify --sprint p25/16 --feature F16
git ls-tree HEAD -- phases/phase-p25-survey/sprints/sprint-16/evidence/
```

Expected: verification succeeds, F16 remains `passing`, and the tracked evidence
directory contains a non-empty F16 log and screenshot.

- [ ] **Step 6: Compare the implementation at the reference viewport**

At `1653x1024`, compare the new composer screenshot with the supplied Survey composer
and Apache ECharts reference screenshots. Confirm:

- no overlapping columns or clipped labels;
- middle settings and right preview are horizontally aligned;
- the chart canvas is nonblank;
- the JSON is complete and read-only;
- the outer page is not made vertically long by stacked preview content.

- [ ] **Step 7: Commit verification evidence**

```bash
git add apps/web/e2e/survey-p25-016-versioned-report-composer.spec.ts \
  phases/phase-p25-survey/sprints/sprint-16/evidence/F16.verify.log \
  phases/phase-p25-survey/sprints/sprint-16/evidence/survey-report-single-output-desktop.png
git commit -m "test(survey): verify single-output report chapters"
```

- [ ] **Step 8: Push the corrected F16 branch**

```bash
git push origin codex/p25-f16-survey-report-fact-base
```

Expected: existing PR #716 updates without creating a second worktree or a second
Delivery PR.
