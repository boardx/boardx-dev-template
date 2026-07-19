# Template-Driven Professional Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate and render one immutable professional report whose chapter count, order, titles, output types, chart templates, and requirements exactly match the saved report template.

**Architecture:** Freeze the normalized report plan into a template snapshot, generate one discriminated chapter artifact per template chapter against the same versioned fact base, validate the complete chapter set, and publish the report atomically. Extract the oversized report workbench from `surveys/page.tsx` into focused reading components, while keeping version state and API loading in the existing page.

**Tech Stack:** Next.js 14, React, TypeScript, Vitest, Playwright, PostgreSQL-backed `@repo/data`, S3-compatible `@repo/storage`, Apache ECharts, DashScope Qwen JSON and Wan 2.6 text-to-image HTTP APIs.

## Global Constraints

- The saved report template is the only source of business chapters.
- A successful report has exactly one output per chapter: `text`, `chart`, or `image`.
- Every chapter reads from the same complete survey and authorized-response `sourceRevision`.
- Browser responses never include complete raw responses or storage object keys.
- Chart options come only from allowlisted templates and real aggregated data.
- Wan result URLs are temporary; download generated images into controlled object storage before publishing.
- Any chapter failure prevents publication of a new ready artifact and preserves the latest successful version.
- Do not add runtime dependencies unless the existing platform packages cannot provide the required capability.
- Keep each production source file below 2000 lines; do not add report rendering logic back into the 7000-line survey page.

---

### Task 1: Register F19 and its executable verification contract

**Files:**
- Modify: `phases/phase-p25-survey/feature_list.json`
- Create through Harness: `phases/phase-p25-survey/sprints/sprint-19/active-features.json`
- Create through Harness: `phases/phase-p25-survey/sprints/sprint-19/progress.md`
- Create through Harness: `phases/phase-p25-survey/sprints/sprint-19/session-handoff.md`

**Interfaces:**
- Consumes: confirmed `requirements/18-template-driven-professional-report.md`
- Produces: authoritative `F19` and sprint `p25/19`

- [ ] **Step 1: Add the F19 feature contract**

Append one feature to `feature_list.json`:

```json
{
  "id": "F19",
  "priority": 1,
  "area": "survey",
  "title": "模板驱动的专业分析报告",
  "user_visible_behavior": "用户保存报告模板并主动生成报告时，系统从同一份完整问卷事实库中为每个模板章节生成唯一的文本、ECharts 图表或图片产物；成功报告的章节数量、顺序、标题和类型与生成时模板快照逐项一致。任一章节失败时不发布部分版本并保留最近成功报告。分析报告页以专业阅读布局展示模板目录、连续章节、紧凑版本入口、分享和导出操作，且不再显示固定业务章节或常驻编辑助手。",
  "design_ref": "requirements/18-template-driven-professional-report.md；docs/superpowers/specs/2026-07-19-template-driven-professional-report-design.md；2026-07-19 用户确认",
  "status": "pending",
  "sprint": null,
  "owner": null,
  "capability": "CAP-WEB",
  "depends_on": ["F16"],
  "wave": 16,
  "verification": [
    "pnpm --filter @repo/storage run test",
    "pnpm --filter @repo/web run test -- survey-template-report survey-report-chapter-generation survey-report",
    "pnpm --filter @repo/web run lint",
    "pnpm --filter @repo/web run typecheck",
    "pnpm --filter @repo/web exec playwright test e2e/survey-p25-019-template-driven-professional-report.spec.ts",
    "pnpm harness doctor --phase p25",
    "git cat-file -e HEAD:phases/phase-p25-survey/sprints/sprint-19/evidence/F19.verify.log"
  ],
  "evidence": "",
  "notes": "独立 Delivery PR，Refs #648。共享热点为 professional-report route、survey-professional-report.ts、report export 和 surveys/page.tsx；F17 合并前后均通过明确的章节生成接口集成，不在本 feature 修改 LangGraph runtime。"
}
```

- [ ] **Step 2: Create sprint 19 through Harness**

Run:

```bash
pnpm harness new-sprint --phase p25 --id 19 --goal "按保存的报告模板逐章生成并组装专业分析报告" --features F19
```

Expected: sprint 19 files are generated, and the derived active view contains only F19.

- [ ] **Step 3: Verify the control-plane state**

Run:

```bash
pnpm harness doctor --phase p25
```

Expected: `0 FAIL / 0 WARN`.

- [ ] **Step 4: Commit the feature registration**

```bash
git add phases/phase-p25-survey
git commit -m "chore(survey): register template-driven report feature"
```

### Task 2: Define and validate the immutable template report contract

**Files:**
- Create: `apps/web/lib/survey-template-report.ts`
- Create: `apps/web/lib/survey-template-report.test.ts`
- Modify: `apps/web/lib/survey-professional-report.ts`
- Modify: `apps/web/lib/survey-professional-report.test.ts`

**Interfaces:**
- Consumes: `SurveyReportCategoryPlanInput`, `SurveyReportEvidenceBundle`
- Produces:
  - `SurveyReportTemplateSnapshot`
  - `TemplateDrivenReportChapter`
  - `TemplateDrivenSurveyReport`
  - `buildSurveyReportTemplateSnapshot(plan)`
  - `validateTemplateDrivenReport(snapshot, chapters)`
  - `assembleTemplateDrivenReport(input)`

- [ ] **Step 1: Write failing contract tests**

Cover these assertions in `survey-template-report.test.ts`:

```ts
expect(snapshot.chapters.map(({ id, order, title, outputType }) => ({
  id, order, title, outputType,
}))).toEqual([
  { id: "summary", order: 1, title: "管理层摘要", outputType: "text" },
  { id: "trend", order: 2, title: "趋势对比", outputType: "chart" },
  { id: "visual", order: 3, title: "场景视觉", outputType: "image" },
]);

expect(() => validateTemplateDrivenReport(snapshot, [
  textChapter,
  imageChapter,
  chartChapter,
])).toThrow("report_chapter_order_mismatch");

expect(() => validateTemplateDrivenReport(snapshot, [
  textChapter,
  { ...chartChapter, outputType: "text" },
  imageChapter,
])).toThrow("report_chapter_output_type_mismatch");
```

Also assert that no fixed `executiveSummary`, `methodology`, or other business section is injected when absent from the template.

- [ ] **Step 2: Run the focused tests and confirm failure**

```bash
pnpm --filter @repo/web exec vitest run lib/survey-template-report.test.ts
```

Expected: FAIL because the new contract module does not exist.

- [ ] **Step 3: Implement the discriminated chapter contract**

Use a focused module:

```ts
export type TemplateDrivenReportChapter =
  | TemplateChapterBase & {
      outputType: "text";
      body: string;
      claims: ValidatedReportClaim[];
    }
  | TemplateChapterBase & {
      outputType: "chart";
      chartTemplateId: SurveyReportChartTemplateId;
      option: Record<string, unknown>;
      interpretation: string;
      sampleSize: number;
    }
  | TemplateChapterBase & {
      outputType: "image";
      assetId: string;
      assetUrl?: string;
      altText: string;
      caption: string;
    };

export interface TemplateChapterBase {
  chapterId: string;
  order: number;
  title: string;
  requirement: string;
  evidenceRefs: string[];
  limitations: string[];
}
```

`validateTemplateDrivenReport` must reject:

- duplicate or missing chapter IDs;
- mismatched count, order, title, or output type;
- chart chapters without the exact snapshotted `chartTemplateId`;
- non-chart chapters with a chart option;
- image chapters without a controlled `assetId`;
- evidence refs outside the current evidence bundle.

- [ ] **Step 4: Make the existing professional-report builder return the new contract**

Keep historical sanitation compatibility, but make new reports contain:

```ts
{
  schemaVersion: "template-driven-report-v1",
  title,
  generatedAt,
  sourceRevision,
  templateSnapshot,
  status,
  sample: { responseCount, questionCount, confidence },
  chapters
}
```

Do not create `executiveSummary`, `methodology`, or `actions` for new reports.

- [ ] **Step 5: Run contract tests**

```bash
pnpm --filter @repo/web exec vitest run lib/survey-template-report.test.ts lib/survey-professional-report.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit the report contract**

```bash
git add apps/web/lib/survey-template-report.ts apps/web/lib/survey-template-report.test.ts apps/web/lib/survey-professional-report.ts apps/web/lib/survey-professional-report.test.ts
git commit -m "feat(survey): define template report chapter artifacts"
```

### Task 3: Add controlled Wan image generation and persistence

**Files:**
- Modify: `packages/storage/src/index.ts`
- Modify: `packages/storage/src/index.test.ts`
- Create: `apps/web/lib/wan-image.ts`
- Create: `apps/web/lib/wan-image.test.ts`
- Create: `apps/web/app/api/surveys/[id]/professional-report/[artifactId]/images/[assetId]/route.ts`

**Interfaces:**
- Produces:
  - `buildSurveyReportImageObjectKey({ teamId, surveyId, artifactId, chapterId })`
  - `generateAndStoreSurveyReportImage(input): Promise<{ assetId; objectKey; altText; caption }>`
  - authorized image response route that redirects to a short-lived presigned URL

- [ ] **Step 1: Write failing storage-key and Wan response tests**

```ts
expect(buildSurveyReportImageObjectKey({
  teamId: 7,
  surveyId: 59,
  artifactId: "artifact-id",
  chapterId: "visual-summary",
})).toBe("survey-reports/7/59/artifact-id/visual-summary.png");
```

Mock `fetch` so the Wan response contains:

```json
{
  "output": {
    "choices": [{
      "message": {
        "content": [{ "type": "image", "image": "https://temporary.example/image.png" }]
      }
    }]
  }
}
```

Assert the helper downloads the image bytes, calls `putObject`, and returns no temporary vendor URL.

- [ ] **Step 2: Run focused tests and confirm failure**

```bash
pnpm --filter @repo/storage exec vitest run src/index.test.ts
pnpm --filter @repo/web exec vitest run lib/wan-image.test.ts
```

Expected: FAIL because the storage key and Wan helper do not exist.

- [ ] **Step 3: Implement the official Wan 2.6 request**

Call the documented synchronous endpoint:

```ts
POST ${DASHSCOPE_IMAGE_BASE_URL}/services/aigc/multimodal-generation/generation
{
  "model": "wan2.6-t2i",
  "input": {
    "messages": [{
      "role": "user",
      "content": [{ "text": prompt }]
    }]
  },
  "parameters": {
    "prompt_extend": true,
    "watermark": false,
    "n": 1,
    "negative_prompt": "文字水印，虚构统计数字，品牌标志，人物肖像",
    "size": "1280*1280"
  }
}
```

Use `DASHSCOPE_API_KEY` or `QWEN_API_KEY`, a 120-second timeout, and exact response-shape validation. Download the returned PNG immediately and reject non-image content types or responses larger than 10 MB.

- [ ] **Step 4: Persist the image under the survey-report namespace**

Call `ensureBucket()` and `putObject(objectKey, bytes, "image/png")`. Store only `assetId`/`objectKey` in server-side artifacts; expose the authorized route URL to the browser.

- [ ] **Step 5: Add the authorized image route**

The GET route must:

- require the current user;
- verify `canViewSurvey(surveyId, user.id, currentTeamId())`;
- load the exact `artifactId` from the route and ensure the requested `assetId` belongs to one of its image chapters;
- presign the internal object key for 300 seconds;
- redirect without returning the object key.

- [ ] **Step 6: Run storage and image tests**

```bash
pnpm --filter @repo/storage run test
pnpm --filter @repo/web exec vitest run lib/wan-image.test.ts
```

Expected: all tests pass.

- [ ] **Step 7: Commit image generation**

```bash
git add packages/storage/src/index.ts packages/storage/src/index.test.ts apps/web/lib/wan-image.ts apps/web/lib/wan-image.test.ts apps/web/app/api/surveys
git commit -m "feat(survey): persist generated report images"
```

### Task 4: Generate and validate every template chapter atomically

**Files:**
- Create: `apps/web/lib/survey-report-chapter-generation.ts`
- Create: `apps/web/lib/survey-report-chapter-generation.test.ts`
- Modify: `apps/web/app/api/surveys/[id]/professional-report/route.ts`
- Modify: `apps/web/app/api/surveys/[id]/professional-report/survey-report.route.test.ts`
- Modify: `packages/data/src/surveyReportVersion.ts`
- Modify: `packages/data/src/survey-report-version.test.ts`

**Interfaces:**
- Consumes: `SurveyReportTemplateSnapshot`, one `SurveyReportSourceSnapshot`, one evidence bundle
- Produces:
  - `generateTemplateReportChapters(input): Promise<TemplateDrivenReportChapter[]>`
  - `materializeReportAssetUrls(report, surveyId, artifactId)`
  - `SURVEY_REPORT_TEMPLATE_VERSION = "template-driven-report-v1"`

- [ ] **Step 1: Write failing orchestration tests**

Assert:

```ts
expect(chapters.map((chapter) => [
  chapter.chapterId,
  chapter.order,
  chapter.outputType,
])).toEqual([
  ["summary", 1, "text"],
  ["trend", 2, "chart"],
  ["visual", 3, "image"],
]);
```

Inspect mocked Qwen calls and assert each chapter request includes its own `chapterId`, `title`, `outputType`, and `requirement`. Assert every call receives the same `sourceRevision`.

Add failure tests:

- invalid evidence ID rejects the text chapter;
- invalid chart template or empty real aggregation rejects the chart chapter;
- Wan failure rejects the image chapter;
- any rejected chapter means `createVersionedSurveyReportArtifact` is never called.

- [ ] **Step 2: Run focused tests and confirm failure**

```bash
pnpm --filter @repo/web exec vitest run lib/survey-report-chapter-generation.test.ts 'app/api/surveys/[id]/professional-report/survey-report.route.test.ts'
```

Expected: FAIL because chapter orchestration does not exist.

- [ ] **Step 3: Implement text chapter generation**

Send a chapter-scoped JSON request:

```ts
{
  task: "generate_template_text_chapter",
  sourceRevision,
  chapter: { id, title, requirement, outputType: "text" },
  requiredShape: {
    headline: "string",
    claims: [{
      statement: "string",
      evidenceId: "string",
      value: 1,
      denominator: 10,
      implication: "string",
      recommendation: "string"
    }]
  },
  evidence: modelSafeSurveyReportEvidence(evidence)
}
```

Validate every claim with `validateEvidenceClaims`. Build the chapter body from validated headline, claims, implications, and recommendations so unsupported numeric prose cannot bypass evidence validation.

- [ ] **Step 4: Implement chart chapter generation**

Ask Qwen only to select a valid structured evidence question and produce an interpretation:

```ts
{
  task: "select_template_chart_evidence",
  chapter: { id, title, requirement, chartTemplateId },
  allowedQuestionIds: structuredQuestions.map(({ questionId }) => questionId),
  evidence: modelSafeSurveyReportEvidence(evidence)
}
```

Reject IDs outside the allowlist. Build the ECharts Option server-side with `buildSurveyReportChartOption(snapshot.chartTemplateId, realRows)`.

- [ ] **Step 5: Implement image chapter generation**

Create a prompt from:

- chapter title and requirement;
- validated aggregate findings only;
- explicit instruction to avoid printed statistics, logos, watermarks, and identifiable people.

Call `generateAndStoreSurveyReportImage`; store the controlled asset identity and safe caption.

- [ ] **Step 6: Publish only after complete validation**

The route must:

1. freeze the template snapshot before generation;
2. reserve one `artifactId` before chapter generation so controlled image object keys are stable;
3. generate all chapters against the same source revision and reserved artifact ID;
4. call `validateTemplateDrivenReport`;
5. create the artifact with that reserved ID only after validation succeeds;
6. release the generation claim with the failing chapter ID on any error;
7. return the latest successful report plus a retryable failure status when generation fails.

- [ ] **Step 7: Materialize authorized image URLs on GET and POST**

Before returning a report, map each image `assetId` to:

```text
/api/surveys/{surveyId}/professional-report/{artifactId}/images/{assetId}
```

Do not persist absolute app URLs or presigned URLs.

- [ ] **Step 8: Run generation, route, and version tests**

```bash
pnpm --filter @repo/data exec vitest run src/survey-report-version.test.ts
pnpm --filter @repo/web exec vitest run lib/survey-template-report.test.ts lib/survey-report-chapter-generation.test.ts 'app/api/surveys/[id]/professional-report/survey-report.route.test.ts'
```

Expected: all tests pass.

- [ ] **Step 9: Commit atomic chapter generation**

```bash
git add packages/data/src/surveyReportVersion.ts packages/data/src/survey-report-version.test.ts apps/web/lib apps/web/app/api/surveys
git commit -m "feat(survey): generate reports from template chapters"
```

### Task 5: Build the professional report reading experience

**Files:**
- Create: `apps/web/components/survey/survey-professional-report-workbench.tsx`
- Modify: `apps/web/components/survey/professional-report-document.tsx`
- Modify: `apps/web/components/survey/survey-report-version-history.tsx`
- Modify: `apps/web/app/(app)/surveys/page.tsx`
- Create: `apps/web/lib/survey-report-reading.test.ts`

**Interfaces:**
- Consumes: `TemplateDrivenSurveyReport`, `SurveyReportGenerationStatus`
- Produces:
  - `SurveyProfessionalReportWorkbench`
  - chapter anchors `report-chapter-{chapterId}`
  - compact version control `report-version-menu`

- [ ] **Step 1: Write failing reading-model tests**

Test the pure helpers used by the workbench:

```ts
expect(reportOutlineItems(report)).toEqual([
  { id: "summary", label: "管理层摘要", outputType: "text" },
  { id: "trend", label: "趋势对比", outputType: "chart" },
  { id: "visual", label: "场景视觉", outputType: "image" },
]);
```

Assert there are no outline items for implicit execution summary or methodology sections.

- [ ] **Step 2: Run the focused test and confirm failure**

```bash
pnpm --filter @repo/web exec vitest run lib/survey-report-reading.test.ts
```

Expected: FAIL because the reading helper does not exist.

- [ ] **Step 3: Extract the report workbench from the oversized survey page**

Move report-only rendering and export callbacks into `survey-professional-report-workbench.tsx`. Leave data fetching, current survey selection, and navigation state in `surveys/page.tsx`.

The new desktop layout:

```text
top tools: report name | status | version | regenerate | share | export
metadata: sample count | data cutoff | generated time
body: 220px template outline | minmax(0, 920px) report document
```

Do not render the right-side AI editing panel.

- [ ] **Step 4: Render chapters by their discriminated output**

- `text`: headline, evidence-bound analysis, implications, recommendations, limitations.
- `chart`: stable `aspect-ratio`, real ECharts canvas, interpretation, sample denominator, limitations.
- `image`: controlled `<img>`, meaningful alt text, caption, limitations.

Use one continuous document with section separators. Do not wrap page sections in nested cards.

- [ ] **Step 5: Replace the expanded history list with a compact version control**

The collapsed control shows current version and state. Opening it reveals the existing paginated version summaries and “load more” action. Exact artifact selection semantics remain unchanged.

- [ ] **Step 6: Add mobile behavior**

Below `xl`, convert the outline to a chapter select/menu above the report. Ensure chart and image widths are constrained and all tool buttons wrap without overlap.

- [ ] **Step 7: Run reading tests, typecheck, and design lint**

```bash
pnpm --filter @repo/web exec vitest run lib/survey-report-reading.test.ts
pnpm --filter @repo/web run typecheck
pnpm --filter @repo/web run lint
```

Expected: tests pass, typecheck succeeds, design lint has no blocking errors.

- [ ] **Step 8: Commit the professional reading UI**

```bash
git add apps/web/components/survey apps/web/app/'(app)'/surveys/page.tsx apps/web/lib/survey-report-reading.test.ts
git commit -m "feat(survey): redesign professional report reader"
```

### Task 6: Keep PDF and Word exports template-exact

**Files:**
- Modify: `apps/web/lib/report-export.ts`
- Modify: `apps/web/lib/report-export.test.ts`

**Interfaces:**
- Consumes: `TemplateDrivenSurveyReport`
- Produces: template-ordered HTML/PDF and Word output

- [ ] **Step 1: Write failing export tests**

Build a three-chapter report and assert:

```ts
expect(html.indexOf("管理层摘要")).toBeLessThan(html.indexOf("趋势对比"));
expect(html.indexOf("趋势对比")).toBeLessThan(html.indexOf("场景视觉"));
expect(html).not.toContain("执行摘要");
expect(html).not.toContain("研究方法");
```

Also assert image alt/caption and chart interpretation are exported.

- [ ] **Step 2: Run the focused test and confirm failure**

```bash
pnpm --filter @repo/web exec vitest run lib/report-export.test.ts
```

Expected: FAIL against the legacy report shape.

- [ ] **Step 3: Implement discriminated chapter export**

Use the report template snapshot order and render only the matching output block for each chapter. Keep existing HTML escaping and print-safe styles.

- [ ] **Step 4: Run export tests**

```bash
pnpm --filter @repo/web exec vitest run lib/report-export.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit export parity**

```bash
git add apps/web/lib/report-export.ts apps/web/lib/report-export.test.ts
git commit -m "feat(survey): export template-driven reports"
```

### Task 7: Prove the complete workflow and visual fidelity

**Files:**
- Create: `apps/web/e2e/survey-p25-019-template-driven-professional-report.spec.ts`
- Create through test: `phases/phase-p25-survey/sprints/sprint-19/evidence/report-desktop.png`
- Create through test: `phases/phase-p25-survey/sprints/sprint-19/evidence/report-mobile.png`
- Create: `phases/phase-p25-survey/sprints/sprint-19/evidence/design-qa.md`
- Modify through Harness: `phases/phase-p25-survey/sprints/sprint-19/evidence/F19.verify.log`
- Modify: `phases/phase-p25-survey/sprints/sprint-19/progress.md`
- Modify: `phases/phase-p25-survey/sprints/sprint-19/session-handoff.md`

**Interfaces:**
- Consumes: complete F19 implementation
- Produces: executable browser acceptance and committed evidence

- [ ] **Step 1: Write the failing Playwright workflow**

The test must:

1. create a survey and real responses;
2. save a three-chapter template in `text -> chart -> image` order;
3. mock Qwen and Wan at the HTTP boundary with deterministic valid outputs;
4. generate the report;
5. assert exact chapter count, IDs, order, titles, and output types in the API;
6. assert the report outline matches the same sequence;
7. assert the chart canvas has nonblank pixels and the image request returns image bytes;
8. assert fixed business sections and the right AI editor are absent;
9. modify the template, verify stale state, regenerate, and open both immutable versions;
10. capture desktop and mobile screenshots.

- [ ] **Step 2: Run Playwright and confirm failure**

```bash
pnpm --filter @repo/web exec playwright test e2e/survey-p25-019-template-driven-professional-report.spec.ts
```

Expected: FAIL before all F19 test IDs and behaviors exist.

- [ ] **Step 3: Complete missing implementation details revealed by E2E**

Fix only F19-scoped defects. Do not weaken assertions or replace real API/DOM behavior with source-string checks.

- [ ] **Step 4: Run the complete feature verification set**

```bash
pnpm --filter @repo/storage run test
pnpm --filter @repo/web run test -- survey-template-report survey-report-chapter-generation survey-report
pnpm --filter @repo/web run lint
pnpm --filter @repo/web run typecheck
pnpm --filter @repo/web exec playwright test e2e/survey-p25-019-template-driven-professional-report.spec.ts
pnpm harness doctor --phase p25
```

Expected: every command exits 0.

- [ ] **Step 5: Perform the visual comparison**

Create one side-by-side image using the reference screenshot and desktop result at the same viewport. Review title hierarchy, content width, directory width, spacing, chart framing, action placement, and any overlap. Record fixes and final result in `design-qa.md`.

- [ ] **Step 6: Run Harness verification**

```bash
pnpm harness verify --sprint p25/19 --feature F19 --backfill-evidence
```

Expected: F19 transitions to `passing` only after all verification commands succeed and evidence is committed.

- [ ] **Step 7: Commit implementation and evidence**

```bash
git add apps/web packages/storage phases/phase-p25-survey
git commit -m "test(survey): verify template-driven reports"
```

- [ ] **Step 8: Push and create the independent Delivery PR**

```bash
git push -u origin codex/p25-f19-template-driven-report
gh pr create --base main --head codex/p25-f19-template-driven-report --title "feat(survey): generate professional reports from templates" --body-file /tmp/p25-f19-pr.md
```

The PR body must summarize the chapter contract, atomic publication, professional reader, tests, and include `Refs #648`.
