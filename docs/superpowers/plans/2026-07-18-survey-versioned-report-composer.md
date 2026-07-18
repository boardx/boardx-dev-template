# Survey Versioned Report Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver F16 as an independently reviewable feature: a simplified report-requirement workspace backed by versioned survey fact-base snapshots, explicit stale state, cache reuse, and immutable report history.

**Architecture:** Add pure canonicalization and hashing helpers plus Postgres repositories in `@repo/data`, then make the professional-report API the sole server-side coordinator for source revisions and artifact reuse. Replace the current three-column report composer with a compact chapter list and a same-screen requirement/preview workspace; the browser receives report artifacts and metadata, never the full source snapshot.

**Tech Stack:** TypeScript, Next.js 14 route handlers, React 18, PostgreSQL migrations, Vitest, Playwright, existing `@repo/data` SQL layer, existing Survey evidence/report builders.

## Global Constraints

- F16 does not add Deep Agents, LangGraph, or a host `FilesystemBackend`.
- A source snapshot is created only when normalized survey or response content changes.
- `artifactKey = sourceRevision + requirementHash + templateVersion`.
- New responses mark the latest report stale; they do not invoke Qwen.
- Only an explicit POST generates or updates a report.
- Successful report artifacts are immutable and old versions remain readable.
- Complete responses and source snapshots never enter browser payloads.
- Existing `canViewSurvey` / `canManageSurveyScope` authorization order remains intact.
- Existing report-category fields remain readable during migration, but the new UI only edits chapter title and natural-language requirement.
- F17 remains pending and receives no runtime code in this branch.

---

### Task 1: Canonical source revision and requirement hashing

**Files:**
- Create: `packages/data/src/surveyReportVersion.ts`
- Create: `packages/data/src/survey-report-version.test.ts`
- Modify: `packages/data/src/index.ts`

**Interfaces:**
- Consumes: persisted survey, question, and response values already returned by `@repo/data`.
- Produces:

```ts
export interface SurveyReportSourceSnapshotInput {
  survey: {
    id: number;
    title: string;
    description: string;
    updatedAt: string;
  };
  questions: Array<{
    id: number;
    position: number;
    title: string;
    type: string;
    required: boolean;
    options: string[];
    category: string;
  }>;
  responses: Array<{
    id: number;
    submittedAt: string;
    answers: Record<string, unknown>;
  }>;
}

export interface SurveyReportSourceSnapshot {
  surveyId: number;
  sourceRevision: string;
  contentHash: string;
  schemaVersion: "survey-source-v2";
  generatedAt: string;
  responseCount: number;
  sourceData: Record<string, unknown>;
}

export function buildSurveyReportSourceSnapshot(
  input: SurveyReportSourceSnapshotInput,
  generatedAt?: string
): SurveyReportSourceSnapshot;

export function hashSurveyReportRequirement(input: unknown): string;
```

- [x] **Step 1: Write the failing pure-function tests**

```ts
it("reuses a source revision when only input order changes", () => {
  const first = buildSurveyReportSourceSnapshot(sourceWithResponses([response2, response1]), now);
  const second = buildSurveyReportSourceSnapshot(sourceWithResponses([response1, response2]), later);
  expect(second.sourceRevision).toBe(first.sourceRevision);
  expect(second.contentHash).toBe(first.contentHash);
});

it("changes source revision when an answer changes", () => {
  const first = buildSurveyReportSourceSnapshot(sourceWithAnswer("A"), now);
  const second = buildSurveyReportSourceSnapshot(sourceWithAnswer("B"), later);
  expect(second.sourceRevision).not.toBe(first.sourceRevision);
});

it("does not persist respondent identity in source data", () => {
  const source = buildSurveyReportSourceSnapshot(sourceWithRespondentUserId(42), now);
  expect(JSON.stringify(source.sourceData)).not.toContain("respondent_user_id");
  expect(JSON.stringify(source.sourceData)).not.toContain("42");
});

it("normalizes whitespace before hashing requirements", () => {
  expect(hashSurveyReportRequirement("先结论  后证据"))
    .toBe(hashSurveyReportRequirement(" 先结论 后证据 "));
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm --filter @repo/data run test -- survey-report-version
```

Expected: FAIL because `surveyReportVersion.ts` and its exports do not exist.

- [x] **Step 3: Implement stable recursive canonicalization**

Use sorted object keys, sorted questions by `(position, id)`, sorted responses by `(submittedAt, id)`, and SHA-256 from `node:crypto`. Exclude `generatedAt` and respondent identity from the hash input. Represent the source as records with `type: "manifest" | "survey" | "question" | "response"` so F17 can serialize the same object to `survey-source.jsonl`.

- [x] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
pnpm --filter @repo/data run test -- survey-report-version
```

Expected: the four versioning tests pass.

- [x] **Step 5: Commit the pure contract**

```bash
git add packages/data/src/surveyReportVersion.ts packages/data/src/survey-report-version.test.ts packages/data/src/index.ts
git commit -m "feat(survey): add report source revision contract"
```

---

### Task 2: Persist fact-base snapshots and immutable report artifacts

**Files:**
- Create: `packages/data/migrations/048_survey_report_versions.sql`
- Modify: `packages/data/src/surveyReportVersion.ts`
- Modify: `packages/data/src/survey-report-version.test.ts`

**Interfaces:**
- Consumes: `SurveyReportSourceSnapshot` from Task 1 and the existing `survey_ai_report_artifacts` table.
- Produces:

```ts
export interface SurveyReportArtifactVersion {
  id: string;
  surveyId: number;
  sourceRevision: string;
  requirementHash: string;
  templateVersion: string;
  responseCount: number;
  report: Record<string, unknown>;
  status: string;
  modelId: string;
  provider: string;
  createdAt: string;
}

export async function ensureSurveyReportSourceSnapshot(
  snapshot: SurveyReportSourceSnapshot
): Promise<SurveyReportSourceSnapshotRecord>;

export async function findReadySurveyReportArtifact(input: {
  surveyId: number;
  sourceRevision: string;
  requirementHash: string;
  templateVersion: string;
}): Promise<SurveyReportArtifactVersion | undefined>;

export async function listReadySurveyReportArtifacts(
  surveyId: number,
  limit?: number
): Promise<SurveyReportArtifactVersion[]>;

export async function createVersionedSurveyReportArtifact(input: {
  id: string;
  sessionId: string;
  surveyId: number;
  sourceRevision: string;
  requirementHash: string;
  templateVersion: string;
  responseCount: number;
  report: Record<string, unknown>;
  modelId: string;
  provider: string;
}): Promise<SurveyReportArtifactVersion>;
```

- [x] **Step 1: Add failing SQL contract assertions**

Read `048_survey_report_versions.sql` in the test and assert it contains:

```ts
expect(sql).toContain("CREATE TABLE IF NOT EXISTS survey_report_source_snapshots");
expect(sql).toContain("UNIQUE (survey_id, content_hash)");
expect(sql).toContain("source_revision");
expect(sql).toContain("requirement_hash");
expect(sql).toContain("template_version");
expect(sql).toContain("WHERE status = 'ready'");
```

- [x] **Step 2: Run the focused data test and verify RED**

Expected: FAIL because migration 048 does not exist.

- [x] **Step 3: Add migration and repositories**

The migration must:

```sql
CREATE TABLE IF NOT EXISTS survey_report_source_snapshots (
  source_revision text PRIMARY KEY,
  survey_id bigint NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  content_hash text NOT NULL,
  schema_version text NOT NULL,
  response_count integer NOT NULL,
  source_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (survey_id, content_hash)
);

ALTER TABLE survey_ai_report_artifacts
  ADD COLUMN IF NOT EXISTS source_revision text,
  ADD COLUMN IF NOT EXISTS requirement_hash text,
  ADD COLUMN IF NOT EXISTS template_version text NOT NULL DEFAULT 'survey-report-v1';

CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_report_ready_artifact_key
  ON survey_ai_report_artifacts (
    survey_id, source_revision, requirement_hash, template_version
  )
  WHERE status = 'ready'
    AND source_revision IS NOT NULL
    AND requirement_hash IS NOT NULL;
```

Repository inserts use `ON CONFLICT` for source snapshots and return the existing ready artifact when a concurrent insert wins.

- [x] **Step 4: Run migration and focused tests**

```bash
pnpm --filter @repo/data run migrate
pnpm --filter @repo/data run test -- survey-report-version
pnpm --filter @repo/data run typecheck
```

Expected: migration succeeds, focused tests pass, typecheck exits 0.

- [x] **Step 5: Commit persistence**

```bash
git add packages/data/migrations/048_survey_report_versions.sql packages/data/src/surveyReportVersion.ts packages/data/src/survey-report-version.test.ts
git commit -m "feat(survey): persist report fact bases and versions"
```

---

### Task 3: Make professional-report generation cache-aware and explicit

**Files:**
- Create: `apps/web/lib/survey-report-generation.test.ts`
- Create: `apps/web/lib/survey-report-generation.ts`
- Modify: `apps/web/app/api/surveys/[id]/professional-report/route.ts`

**Interfaces:**
- Consumes: Task 1 hashing, Task 2 repositories, existing `buildSurveyReportEvidence`, `buildProfessionalReportDocument`, `callQwenJson`, and Survey authorization functions.
- Produces:

```ts
export interface SurveyReportGenerationStatus {
  currentSourceRevision: string;
  currentRequirementHash: string;
  currentResponseCount: number;
  stale: boolean;
  requirementChanged: boolean;
  latestArtifact: SurveyReportArtifactSummary | null;
  versions: SurveyReportArtifactSummary[];
}

export function resolveSurveyReportGenerationStatus(input: {
  currentSourceRevision: string;
  currentRequirementHash: string;
  currentResponseCount: number;
  artifacts: SurveyReportArtifactVersion[];
}): SurveyReportGenerationStatus;
```

GET response:

```ts
{
  report: ProfessionalSurveyReportDocument;
  preview: boolean;
  selectedArtifactId: string | null;
  generation: SurveyReportGenerationStatus;
}
```

POST response:

```ts
{
  report: ProfessionalSurveyReportDocument;
  reused: boolean;
  warning?: string;
  model: string;
  generation: SurveyReportGenerationStatus;
}
```

- [x] **Step 1: Write failing status tests**

```ts
it("marks a report stale when source revision changes", () => {
  const status = resolveSurveyReportGenerationStatus({
    currentSourceRevision: "rev-2",
    currentRequirementHash: "req-1",
    currentResponseCount: 12,
    artifacts: [artifact({ sourceRevision: "rev-1", requirementHash: "req-1", responseCount: 10 })],
  });
  expect(status.stale).toBe(true);
  expect(status.latestArtifact?.newResponseCount).toBe(2);
});

it("marks changed requirements without treating the old artifact as current", () => {
  const status = resolveSurveyReportGenerationStatus({
    currentSourceRevision: "rev-1",
    currentRequirementHash: "req-2",
    currentResponseCount: 10,
    artifacts: [artifact({ sourceRevision: "rev-1", requirementHash: "req-1", responseCount: 10 })],
  });
  expect(status.requirementChanged).toBe(true);
});
```

- [x] **Step 2: Run tests and verify RED**

```bash
pnpm --filter @repo/web run test -- survey-report-generation
```

Expected: FAIL because generation status helpers do not exist.

- [x] **Step 3: Implement GET without model generation**

GET must:

1. authenticate and authorize with `canViewSurvey`;
2. build and ensure the current source snapshot;
3. load the saved report category plan and compute its requirement hash;
4. load ready artifact versions;
5. return the latest successful artifact report, or an unpersisted deterministic preview when no artifact exists;
6. never call Qwen and never include `sourceData` or raw responses in JSON.

- [x] **Step 4: Implement POST with cache reuse and a generation claim**

POST must additionally require `canManageSurveyScope`. It builds the same artifact key and returns the existing artifact before creating a session or calling Qwen. On cache miss, it atomically claims the artifact key before creating a session or invoking Qwen. The claimant generates evidence-bound claims, builds the professional report, persists a ready immutable artifact, and completes the claim. A concurrent request for an active claim returns `202 in_progress`; a stale claim can be taken over after its lease expires. Qwen failure uses the deterministic evidence report, releases the claim, and records a warning without deleting prior artifacts.

- [x] **Step 5: Run focused and route-adjacent tests**

```bash
pnpm --filter @repo/web run test -- survey-report
pnpm --filter @repo/web run typecheck
```

Expected: report generation, evidence, and professional document tests pass.

- [x] **Step 6: Commit the API coordinator**

```bash
git add apps/web/lib/survey-report-generation.ts apps/web/lib/survey-report-generation.test.ts 'apps/web/app/api/surveys/[id]/professional-report/route.ts'
git commit -m "feat(survey): reuse versioned professional reports"
```

---

### Task 4: Migrate report plans to one natural-language requirement

**Files:**
- Modify: `packages/data/src/survey.ts`
- Modify: `packages/data/src/survey-source-contract.test.ts`
- Modify: `apps/web/app/api/surveys/[id]/report-categories/route.ts`
- Modify: `apps/web/lib/survey-report-category-plan.ts`

**Interfaces:**
- Consumes: legacy `prompt`, `dataPrompt`, and `modulePrompts`.
- Produces: `SurveyReportCategoryInput.requirement?: string`, while keeping legacy fields readable.

- [x] **Step 1: Write failing migration tests**

```ts
it("folds legacy module prompts into one natural-language requirement", () => {
  const plan = cleanSurveyReportCategoryPlan({
    categories: [{
      name: "安全",
      prompt: "先给结论",
      dataPrompt: "标注样本量",
      modulePrompts: { chart: "突出差异", text: "给出行动" },
    }],
  }, "商品调研", questions);
  expect(plan.categories[0]?.requirement).toContain("先给结论");
  expect(plan.categories[0]?.requirement).toContain("标注样本量");
  expect(plan.categories[0]?.requirement).toContain("突出差异");
  expect(plan.categories[0]?.requirement).toContain("给出行动");
});
```

- [x] **Step 2: Verify RED**

```bash
pnpm --filter @repo/data run test -- survey-source-contract
```

Expected: FAIL because `requirement` is absent.

- [x] **Step 3: Implement compatibility normalization**

New input prefers `requirement`. When absent, combine unique non-empty legacy prompts with newline separators and cap the result at 2000 characters. Default chapters use a concise professional requirement. POST classification asks Qwen only for `name`, `description`, and `requirement`; the cleaner still accepts old payloads.

- [x] **Step 4: Remove simulated-data semantics from composer preview helpers**

`buildReportComposerPreview` must not create pseudo values or labels. It returns chapter title, requirement, source scope (`"整份问卷与全部授权答卷"`), and a read-only “generate to preview” state. Existing professional report charts continue to come from real evidence.

- [x] **Step 5: Verify GREEN**

```bash
pnpm --filter @repo/data run test -- survey-source-contract
pnpm --filter @repo/web run test -- survey-report
pnpm --filter @repo/web run typecheck
```

- [x] **Step 6: Commit compatibility migration**

```bash
git add packages/data/src/survey.ts packages/data/src/survey-source-contract.test.ts 'apps/web/app/api/surveys/[id]/report-categories/route.ts' apps/web/lib/survey-report-category-plan.ts
git commit -m "feat(survey): simplify report chapter requirements"
```

---

### Task 5: Replace the long three-column composer with a same-screen workspace

**Files:**
- Modify: `apps/web/app/(app)/surveys/page.tsx`
- Modify: `apps/web/e2e/survey-p25-012-report-composer.spec.ts`
- Create: `apps/web/e2e/survey-p25-016-versioned-report-composer.spec.ts`

**Interfaces:**
- Consumes: `ReportCategoryPlanDraft`, `ProfessionalSurveyReportDocument`, and `SurveyReportGenerationStatus`.
- Produces stable UI test IDs:
  - composer:
    - `report-template-builder`
    - `report-module-list`
    - `report-requirement-panel`
    - `report-requirement-input`
    - `report-preview-panel`
    - `report-generation-status`
    - `save-report-plan`
    - `generate-versioned-report`
  - analysis report:
    - `professional-report-document`
    - `report-version-history`

- [x] **Step 1: Write the failing F16 Playwright test**

The test creates a survey, opens `step=template`, and asserts:

```ts
await expect(page.getByText("问题来源")).toHaveCount(0);
await expect(page.getByText("输出模块")).toHaveCount(0);
await expect(page.getByTestId("report-mapping-panel")).toHaveCount(0);
await expect(page.getByTestId("report-requirement-input")).toBeVisible();

const [requirement, preview] = await Promise.all([
  page.getByTestId("report-requirement-panel").boundingBox(),
  page.getByTestId("report-preview-panel").boundingBox(),
]);
expect(requirement!.x).toBeLessThan(preview!.x);
```

It saves a requirement, generates once, generates again, and asserts the second response has `reused: true` and only one version. It submits another response, asserts GET returns `stale: true`, then clicks update and asserts two immutable versions. The composer asserts that complete report content and history are absent; the `分析报告` workspace asserts that both are present and owns exact artifact selection.

- [x] **Step 2: Run F16 Playwright and verify RED**

```bash
pnpm --filter @repo/web exec playwright test e2e/survey-p25-016-versioned-report-composer.spec.ts
```

Expected: FAIL on missing F16 controls and versioning behavior.

- [x] **Step 3: Simplify local UI types and state**

Add `requirement` to `ReportCategoryDraft`. Store generation metadata by survey id beside professional reports. GET hydrates both report and generation state. POST updates both.

- [x] **Step 4: Replace `WorkspaceReportComposer`**

Desktop layout:

```text
report-module-list | report-requirement-panel | report-preview-panel
```

The composer contains only the chapter list, chapter requirement editor, chapter effect
preview, and a short generation summary. It does not render the complete
`ProfessionalReportDocument` or own version selection. `分析报告` renders
`WorkspaceReportWorkbench`, which owns the complete report and a bounded, scrollable
immutable version history. Selecting a historical version uses exact artifact selection
and replaces the displayed report only after that exact version loads successfully;
failed or mismatched responses leave the current report unchanged.

At widths below `xl`, the composer order is chapters, requirement, preview, then the
generation summary. The analysis report keeps its version list scrollable without
hiding the complete report or primary controls. No fixed-height nested scroller may
hide the primary controls.

- [x] **Step 5: Update superseded F12 UI assertions**

Keep F12 API and zero-sample assertions, but remove checks for the old assistant, output-module cards, mapping tab, and manual chart controls. Replace them with assertions that the F16 requirement and preview panels exist.

- [x] **Step 6: Run Playwright and responsive assertions**

```bash
pnpm --filter @repo/web exec playwright test \
  e2e/survey-p25-012-report-composer.spec.ts \
  e2e/survey-p25-016-versioned-report-composer.spec.ts
```

Expected: both specs pass at desktop, tablet, and mobile; `documentElement.scrollWidth <= innerWidth`.

- [x] **Step 7: Commit the user-visible feature**

```bash
git add 'apps/web/app/(app)/surveys/page.tsx' apps/web/e2e/survey-p25-012-report-composer.spec.ts apps/web/e2e/survey-p25-016-versioned-report-composer.spec.ts
git commit -m "feat(survey): simplify versioned report composer"
```

---

### Task 6: Verify, capture evidence, and prepare the F16-only PR

**Files:**
- Modify: `phases/phase-p25-survey/sprints/sprint-16/progress.md`
- Modify: `phases/phase-p25-survey/sprints/sprint-16/session-handoff.md`
- Create through harness: `phases/phase-p25-survey/sprints/sprint-16/evidence/F16.verify.log`
- Create: `phases/phase-p25-survey/sprints/sprint-16/evidence/2026-07-18-f16-report-composer.md`
- Create: same-state source and implementation screenshots under sprint evidence.

- [x] **Step 1: Run every feature verification command**

```bash
pnpm --filter @repo/data run test -- survey-report-version
pnpm --filter @repo/web run test -- survey-report
pnpm --filter @repo/web run lint
pnpm --filter @repo/web run typecheck
pnpm --filter @repo/web exec playwright test e2e/survey-p25-016-versioned-report-composer.spec.ts
pnpm harness doctor --phase p25
```

- [x] **Step 2: Run the base regression**

```bash
./init.sh
```

Expected: all base typecheck, lint, and unit-test tasks pass.

- [x] **Step 3: Capture same-state design evidence**

At the same desktop viewport and selected chapter, capture the user source screenshot and implemented composer. Combine them in the evidence note and inspect for alignment, overflow, typography, border, and control hierarchy issues before accepting.

- [x] **Step 4: Let harness transition the feature**

```bash
pnpm harness verify --sprint p25/16 --feature F16
```

Expected: F16 becomes `passing`; do not edit status or evidence manually.

- [x] **Step 5: Check evidence is committed**

```bash
git ls-tree HEAD -- phases/phase-p25-survey/sprints/sprint-16/evidence/
```

Expected: non-empty F16 log and visual evidence are present in the tree after the final commit.

- [x] **Step 6: Create the Delivery PR**

Push only `codex/p25-f16-survey-report-fact-base`. The PR closes the dedicated F16 feature issue and includes `Refs #648`. It must not close F17 or include LangGraph runtime code.
