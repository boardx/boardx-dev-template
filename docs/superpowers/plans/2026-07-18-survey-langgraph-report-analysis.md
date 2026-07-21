# Survey LangGraph Report Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a LangGraph-orchestrated report pipeline that lets every chapter retrieve evidence from one immutable whole-survey snapshot and only persists evidence-validated report content.

**Architecture:** `@repo/data` remains the durable source snapshot and artifact authority. `@repo/ai` receives that snapshot as a thread-scoped virtual file map, orchestrates planning, retrieval, analysis, and validation with `StateGraph`, and returns structured chapter artifacts; the Web route keeps the existing artifact-key cache and deterministic fallback.

**Tech Stack:** TypeScript, `@langchain/langgraph`, Vitest, Next.js route handlers, Playwright, pnpm harness.

## Global Constraints

- Production Web/API code must not use a host-path `FilesystemBackend`.
- `/source` is immutable; only `/workspace` and `/artifacts` may be written during one graph run.
- Every chapter can retrieve from the complete survey and every authorized response.
- A chapter cannot enter a successful artifact without valid evidence references.
- Existing `sourceRevision + requirementHash + templateVersion` reuse semantics remain unchanged.
- Model access continues through the `@repo/ai` gateway; tests use deterministic generators.
- F17 does not implement the F13 image/chart/text output selector UI.

---

### Task 1: Thread-Scoped Survey Virtual Filesystem

**Files:**
- Modify: `packages/ai/package.json`
- Create: `packages/ai/src/surveyReportWorkspace.ts`
- Create: `packages/ai/src/surveyReportWorkspace.test.ts`
- Modify: `packages/ai/src/index.ts`

**Interfaces:**
- Consumes: `SurveyReportSourceSnapshot["sourceData"]` from `@repo/data`.
- Produces: `createSurveyReportWorkspace()`, `readSurveyReportFile()`, `grepSurveyReportFiles()`, and `writeSurveyReportFile()`.

- [ ] **Step 1: Write failing permission and whole-source tests**

```ts
it("mounts the complete survey snapshot in one read-only source file", () => {
  const workspace = createSurveyReportWorkspace(snapshot);
  expect(readSurveyReportFile(workspace, "/source/survey-source.jsonl"))
    .toContain('"type":"response"');
});

it("rejects source writes and path traversal", () => {
  const workspace = createSurveyReportWorkspace(snapshot);
  expect(() => writeSurveyReportFile(workspace, "/source/manifest.json", "{}"))
    .toThrow("survey_report_source_read_only");
  expect(() => readSurveyReportFile(workspace, "/source/../secret"))
    .toThrow("survey_report_path_denied");
});
```

- [ ] **Step 2: Run the workspace tests and confirm failure**

Run: `pnpm --filter @repo/ai run test -- surveyReportWorkspace`

Expected: FAIL because `surveyReportWorkspace.ts` does not exist.

- [ ] **Step 3: Add LangGraph dependencies and the virtual file contract**

Add `@langchain/langgraph` and `@langchain/core` to `@repo/ai`. Implement:

```ts
export interface SurveyReportWorkspace {
  files: Record<string, { content: string; readOnly: boolean }>;
}

export function createSurveyReportWorkspace(
  snapshot: SurveyReportSourceSnapshot
): SurveyReportWorkspace;

export function readSurveyReportFile(
  workspace: SurveyReportWorkspace,
  path: string
): string;

export function grepSurveyReportFiles(
  workspace: SurveyReportWorkspace,
  query: string,
  prefix?: "/source/" | "/workspace/" | "/artifacts/"
): Array<{ path: string; line: number; text: string }>;

export function writeSurveyReportFile(
  workspace: SurveyReportWorkspace,
  path: string,
  content: string
): SurveyReportWorkspace;
```

Normalize every path, reject `..`, reject unknown roots, and reject every write under `/source/`. Mount `/source/survey-source.jsonl` as newline-delimited records and `/source/manifest.json` as the immutable revision manifest.

- [ ] **Step 4: Run workspace tests**

Run: `pnpm --filter @repo/ai run test -- surveyReportWorkspace`

Expected: PASS.

- [ ] **Step 5: Commit the filesystem boundary**

```bash
git add packages/ai/package.json pnpm-lock.yaml packages/ai/src/surveyReportWorkspace.ts packages/ai/src/surveyReportWorkspace.test.ts packages/ai/src/index.ts
git commit -m "feat(survey): add report analysis virtual filesystem"
```

### Task 2: LangGraph Chapter Analysis and Evidence Validation

**Files:**
- Create: `packages/ai/src/surveyReportAgent.ts`
- Create: `packages/ai/src/surveyReportAgent.test.ts`
- Modify: `packages/ai/src/index.ts`

**Interfaces:**
- Consumes: `SurveyReportWorkspace`, chapter goals, natural-language requirements, evidence catalog, model ID, budgets, and a gateway-compatible structured generator.
- Produces: `runSurveyReportAgent(input): Promise<SurveyReportAgentResult>`.

- [ ] **Step 1: Write failing orchestration tests**

```ts
it("lets each chapter retrieve from the same whole-survey source", async () => {
  const result = await runSurveyReportAgent(deterministicInput);
  expect(result.chapters.every((chapter) =>
    chapter.sourceRevision === deterministicInput.snapshot.sourceRevision
  )).toBe(true);
  expect(result.audit.sourceReads).toContain("/source/survey-source.jsonl");
});

it("rejects claims with missing or mismatched evidence", async () => {
  const result = await runSurveyReportAgent(inputWithInvalidClaim);
  expect(result.chapters[0]?.status).toBe("rejected");
  expect(result.chapters[0]?.validationErrors).toContain("evidence_value_mismatch");
});

it("stops with a recoverable partial result when budget is exhausted", async () => {
  const result = await runSurveyReportAgent({ ...deterministicInput, maxModelCalls: 1 });
  expect(result.status).toBe("partial");
  expect(result.stopReason).toBe("model_call_budget_exhausted");
});
```

- [ ] **Step 2: Run the agent tests and confirm failure**

Run: `pnpm --filter @repo/ai run test -- survey-report-agent`

Expected: FAIL because `runSurveyReportAgent` does not exist.

- [ ] **Step 3: Implement the typed graph state**

Use `Annotation.Root` and `StateGraph`:

```ts
const SurveyReportState = Annotation.Root({
  workspace: Annotation<SurveyReportWorkspace>,
  chapters: Annotation<SurveyReportChapterPlan[]>,
  results: Annotation<SurveyReportChapterResult[]>({ default: () => [] }),
  modelCalls: Annotation<number>({ default: () => 0 }),
  status: Annotation<"running" | "ready" | "partial" | "failed">,
  stopReason: Annotation<string | undefined>,
});
```

Create explicit nodes for `plan`, `retrieve`, `analyze`, `validate`, and `finalize`. The retrieval node receives the chapter goal and searches the shared `/source` file. The validation node checks evidence ID, value, denominator, source revision, and question scope against the deterministic evidence catalog before writing `/artifacts/report.json`.

- [ ] **Step 4: Add professional chapter-title rules**

Use deterministic fallbacks for common internal keys and allow the planner to refine them:

```ts
const PROFESSIONAL_CHAPTER_TITLES = {
  demographics: "样本画像与结构",
  behavior: "用户行为与关键场景",
  preference: "偏好结构与决策驱动",
  satisfaction: "满意度与体验评价",
  pricing: "价格感知与支付意愿",
  safety: "风险认知与安全信任",
  open_feedback: "开放反馈与改进机会",
} as const;
```

Never expose a raw internal key as the final title. Unknown keys fall back to a title inferred from question wording, then to `主题洞察与行动建议`.

- [ ] **Step 5: Run agent tests and typecheck**

Run: `pnpm --filter @repo/ai run test -- survey-report-agent`

Expected: PASS.

Run: `pnpm --filter @repo/ai run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit the LangGraph pipeline**

```bash
git add packages/ai/src/surveyReportAgent.ts packages/ai/src/surveyReportAgent.test.ts packages/ai/src/index.ts
git commit -m "feat(survey): orchestrate evidence-bound report chapters"
```

### Task 3: Professional Report Route Integration

**Files:**
- Modify: `apps/web/app/api/surveys/[id]/professional-report/route.ts`
- Create: `apps/web/lib/survey-report-agent-adapter.ts`
- Create: `apps/web/lib/survey-report-agent-adapter.test.ts`

**Interfaces:**
- Consumes: `runSurveyReportAgent()`, the existing source snapshot, report category plan, evidence catalog, and model gateway.
- Produces: validated AI chapter claims passed to `buildProfessionalReportDocument()`.

- [ ] **Step 1: Write failing route-adapter tests**

```ts
it("reuses a ready artifact without starting a graph run", async () => {
  await generateVersionedReport({ ...fixture, existingArtifact });
  expect(runAgent).not.toHaveBeenCalled();
});

it("uses the complete snapshot for every planned chapter", async () => {
  await generateVersionedReport(fixture);
  expect(runAgent).toHaveBeenCalledWith(expect.objectContaining({
    snapshot: fixture.sourceSnapshot,
  }));
});

it("keeps deterministic evidence when the graph fails", async () => {
  runAgent.mockRejectedValue(new Error("provider unavailable"));
  const result = await generateVersionedReport(fixture);
  expect(result.provider).toBe("deterministic");
  expect(result.warning).toContain("可稍后重新生成");
});
```

- [ ] **Step 2: Run Web report tests and confirm failure**

Run: `pnpm --filter @repo/web run test -- survey-report`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement the server-only adapter**

Move graph invocation and gateway JSON parsing behind `generateVersionedReport()`. Pass one source snapshot and all chapter goals to `runSurveyReportAgent()`. Convert only validated chapter claims to `AiEvidenceClaimCandidate[]`; preserve the existing deterministic document and warning when the graph returns partial/failed output.

- [ ] **Step 4: Replace the direct one-shot Qwen prompt**

Keep artifact lookup before graph creation. Record source revision, requirement hash, model-call count, stop reason, validation failures, and latency in the existing AI session/model trace. Do not return raw answers or workspace files to the browser.

- [ ] **Step 5: Run Web tests and typecheck**

Run: `pnpm --filter @repo/web run test -- survey-report`

Expected: PASS.

Run: `pnpm --filter @repo/web run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit route integration**

```bash
git add apps/web/app/api/surveys/[id]/professional-report/route.ts apps/web/lib/survey-report-agent-adapter.ts apps/web/lib/survey-report-agent-adapter.test.ts
git commit -m "feat(survey): generate reports from shared fact snapshots"
```

### Task 4: End-to-End Recovery and Harness Evidence

**Files:**
- Create: `apps/web/e2e/survey-p25-017-langgraph-report-analysis.spec.ts`
- Modify: `phases/phase-p25-survey/sprints/sprint-17/progress.md`
- Modify: `phases/phase-p25-survey/sprints/sprint-17/session-handoff.md`
- Create: `phases/phase-p25-survey/sprints/sprint-17/evidence/F17.verify.log`

**Interfaces:**
- Consumes: the professional-report API and report composer generation controls.
- Produces: user-visible cache reuse, stale/update, failure recovery, and evidence-validation acceptance proof.

- [ ] **Step 1: Write the failing Playwright scenario**

The scenario must:

```ts
test("generates from the whole fact snapshot and preserves the latest report on failure", async ({ page }) => {
  await seedSurveyWithCrossQuestionEvidence(page);
  await openReportComposer(page);
  await page.getByTestId("report-generate-button").click();
  await expect(page.getByTestId("professional-report-document")).toContainText("用户行为与关键场景");
  await triggerDeterministicAgentFailure(page);
  await page.getByTestId("report-generate-button").click();
  await expect(page.getByTestId("report-generation-warning")).toBeVisible();
  await expect(page.getByTestId("professional-report-document")).toContainText("最近成功版本");
});
```

- [ ] **Step 2: Run the Playwright test and fix only acceptance failures**

Run: `pnpm --filter @repo/web exec playwright test e2e/survey-p25-017-langgraph-report-analysis.spec.ts`

Expected: PASS.

- [ ] **Step 3: Run all F17 verification commands and save output**

Run each command from `feature_list.json`, append its command, exit code, and summary to `phases/phase-p25-survey/sprints/sprint-17/evidence/F17.verify.log`.

- [ ] **Step 4: Run the harness gate**

Run: `pnpm harness verify --sprint p25/17 --feature F17`

Expected: PASS and F17 transitions to `passing`.

- [ ] **Step 5: Complete clean-state records**

Update sprint progress and handoff with the artifact key behavior, virtual path restrictions, deterministic fallback, test commands, evidence path, and the next F13 dependency.

- [ ] **Step 6: Commit verification evidence**

```bash
git add apps/web/e2e/survey-p25-017-langgraph-report-analysis.spec.ts phases/phase-p25-survey/sprints/sprint-17 phases/phase-p25-survey/feature_list.json phases/phase-p25-survey/progress.md
git commit -m "test(survey): verify autonomous report analysis"
```
