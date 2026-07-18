import {
  Annotation,
  END,
  START,
  StateGraph,
} from "@langchain/langgraph";
import {
  createSurveyReportWorkspace,
  grepSurveyReportFiles,
  readSurveyReportFile,
  writeSurveyReportFile,
  type SurveyReportFileMatch,
  type SurveyReportSourceSnapshotLike,
  type SurveyReportWorkspace,
} from "./surveyReportWorkspace";

const PROFESSIONAL_CHAPTER_TITLES: Record<string, string> = {
  demographics: "样本画像与结构",
  behavior: "用户行为与关键场景",
  preference: "偏好结构与决策驱动",
  satisfaction: "满意度与体验评价",
  pricing: "价格感知与支付意愿",
  safety: "风险认知与安全信任",
  open_feedback: "开放反馈与改进机会",
};

export interface SurveyReportChapterPlan {
  id: string;
  categoryKey: string;
  title: string;
  goal: string;
  requirement: string;
}

export interface SurveyReportEvidence {
  id: string;
  questionId: number;
  label: string;
  value: number;
  denominator: number;
}

export interface SurveyReportEvidenceRef {
  evidenceId: string;
  value: number;
  denominator: number;
}

export interface SurveyReportChapterDraft {
  conclusion: string;
  evidenceRefs: SurveyReportEvidenceRef[];
  limitations: string[];
  recommendation: string;
}

export interface SurveyReportChapterResult extends SurveyReportChapterDraft {
  id: string;
  title: string;
  categoryKey: string;
  sourceRevision: string;
  status: "accepted" | "rejected";
  validationErrors: string[];
}

export interface SurveyReportAgentTools {
  readFile(path: string): string;
  grep(
    query: string,
    prefix?: "/source/" | "/workspace/" | "/artifacts/"
  ): SurveyReportFileMatch[];
}

export interface SurveyReportChapterAnalysisInput {
  chapter: SurveyReportChapterPlan;
  tools: SurveyReportAgentTools;
}

export interface SurveyReportAgentInput {
  snapshot: SurveyReportSourceSnapshotLike;
  chapters: SurveyReportChapterPlan[];
  evidence: SurveyReportEvidence[];
  maxModelCalls: number;
  analyzeChapter(
    input: SurveyReportChapterAnalysisInput
  ): Promise<SurveyReportChapterDraft>;
}

export interface SurveyReportAgentResult {
  status: "ready" | "partial" | "failed";
  stopReason?: string;
  chapters: SurveyReportChapterResult[];
  workspace: SurveyReportWorkspace;
  audit: {
    sourceReads: string[];
    modelCalls: number;
  };
}

interface RawChapterResult {
  chapter: SurveyReportChapterPlan;
  draft?: SurveyReportChapterDraft;
  error?: string;
}

function professionalChapterTitle(chapter: SurveyReportChapterPlan): string {
  const mapped = PROFESSIONAL_CHAPTER_TITLES[chapter.categoryKey];
  if (mapped) return mapped;

  const title = chapter.title.trim();
  if (title && !/^[a-z0-9_-]+$/i.test(title)) return title;
  return "主题洞察与行动建议";
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function validateChapter(
  raw: RawChapterResult,
  evidence: SurveyReportEvidence[],
  sourceRevision: string
): SurveyReportChapterResult {
  const chapter = raw.chapter;
  const draft = raw.draft ?? {
    conclusion: "",
    evidenceRefs: [],
    limitations: [],
    recommendation: "",
  };
  const validationErrors: string[] = [];
  if (raw.error) validationErrors.push(raw.error);
  if (!draft.conclusion.trim()) validationErrors.push("conclusion_required");
  if (!draft.recommendation.trim()) {
    validationErrors.push("recommendation_required");
  }
  if (draft.evidenceRefs.length === 0) {
    validationErrors.push("evidence_required");
  }

  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  for (const reference of draft.evidenceRefs) {
    const item = evidenceById.get(reference.evidenceId);
    if (!item) {
      validationErrors.push("evidence_not_found");
      continue;
    }
    if (item.value !== reference.value) {
      validationErrors.push("evidence_value_mismatch");
    }
    if (item.denominator !== reference.denominator) {
      validationErrors.push("evidence_denominator_mismatch");
    }
  }

  return {
    id: chapter.id,
    title: chapter.title,
    categoryKey: chapter.categoryKey,
    sourceRevision,
    conclusion: draft.conclusion,
    evidenceRefs: draft.evidenceRefs,
    limitations: draft.limitations,
    recommendation: draft.recommendation,
    status: validationErrors.length === 0 ? "accepted" : "rejected",
    validationErrors: unique(validationErrors),
  };
}

export async function runSurveyReportAgent(
  input: SurveyReportAgentInput
): Promise<SurveyReportAgentResult> {
  const initialWorkspace = createSurveyReportWorkspace(input.snapshot);
  const ReportState = Annotation.Root({
    workspace: Annotation<SurveyReportWorkspace>(),
    chapters: Annotation<SurveyReportChapterPlan[]>(),
    rawResults: Annotation<RawChapterResult[]>({
      reducer: (_current, update) => update,
      default: () => [],
    }),
    results: Annotation<SurveyReportChapterResult[]>({
      reducer: (_current, update) => update,
      default: () => [],
    }),
    sourceReads: Annotation<string[]>({
      reducer: (_current, update) => update,
      default: () => [],
    }),
    modelCalls: Annotation<number>({
      reducer: (_current, update) => update,
      default: () => 0,
    }),
    status: Annotation<"running" | "ready" | "partial" | "failed">(),
    stopReason: Annotation<string | undefined>(),
  });

  const graph = new StateGraph(ReportState)
    .addNode("plan", (state) => {
      const chapters = state.chapters.map((chapter) => ({
        ...chapter,
        title: professionalChapterTitle(chapter),
      }));
      return {
        chapters,
        workspace: writeSurveyReportFile(
          state.workspace,
          "/workspace/chapter-plan.json",
          JSON.stringify(chapters)
        ),
      };
    })
    .addNode("analyze", async (state) => {
      const rawResults: RawChapterResult[] = [];
      const sourceReads: string[] = [];
      let modelCalls = 0;
      let stopReason: string | undefined;

      const tools: SurveyReportAgentTools = {
        readFile(path) {
          const content = readSurveyReportFile(state.workspace, path);
          if (path.startsWith("/source/")) sourceReads.push(path);
          return content;
        },
        grep(query, prefix) {
          const matches = grepSurveyReportFiles(
            state.workspace,
            query,
            prefix
          );
          sourceReads.push(
            ...matches
              .map((match) => match.path)
              .filter((path) => path.startsWith("/source/"))
          );
          return matches;
        },
      };

      for (const chapter of state.chapters) {
        if (modelCalls >= Math.max(0, input.maxModelCalls)) {
          stopReason = "model_call_budget_exhausted";
          break;
        }
        modelCalls += 1;
        try {
          rawResults.push({
            chapter,
            draft: await input.analyzeChapter({ chapter, tools }),
          });
        } catch {
          rawResults.push({ chapter, error: "analysis_failed" });
        }
      }

      return {
        rawResults,
        sourceReads: unique(sourceReads),
        modelCalls,
        stopReason,
      };
    })
    .addNode("validate", (state) => ({
      results: state.rawResults.map((raw) =>
        validateChapter(raw, input.evidence, input.snapshot.sourceRevision)
      ),
    }))
    .addNode("finalize", (state) => {
      const accepted = state.results.filter(
        (chapter) => chapter.status === "accepted"
      );
      const status =
        accepted.length === state.chapters.length && !state.stopReason
          ? "ready"
          : accepted.length > 0
            ? "partial"
            : "failed";
      const stopReason =
        state.stopReason ??
        (status === "failed" ? "evidence_validation_failed" : undefined);
      const workspace =
        accepted.length > 0
          ? writeSurveyReportFile(
              state.workspace,
              "/artifacts/report.json",
              JSON.stringify({
                sourceRevision: input.snapshot.sourceRevision,
                chapters: accepted,
              })
            )
          : state.workspace;
      return { status, stopReason, workspace };
    })
    .addEdge(START, "plan")
    .addEdge("plan", "analyze")
    .addEdge("analyze", "validate")
    .addEdge("validate", "finalize")
    .addEdge("finalize", END)
    .compile();

  const result = await graph.invoke({
    workspace: initialWorkspace,
    chapters: input.chapters,
    rawResults: [],
    results: [],
    sourceReads: [],
    modelCalls: 0,
    status: "running",
    stopReason: undefined,
  });

  if (result.status === "running") {
    throw new Error("survey_report_graph_incomplete");
  }

  return {
    status: result.status,
    stopReason: result.stopReason,
    chapters: result.results,
    workspace: result.workspace,
    audit: {
      sourceReads: result.sourceReads,
      modelCalls: result.modelCalls,
    },
  };
}
