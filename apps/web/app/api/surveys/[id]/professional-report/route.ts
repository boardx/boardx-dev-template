import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  SURVEY_REPORT_TEMPLATE_VERSION,
  buildSurveyReportSourceSnapshot,
  canManageSurveyScope,
  canViewSurvey,
  claimSurveyReportGeneration,
  completeSurveyReportGenerationClaim,
  createSurveyAiModelTrace,
  createVersionedSurveyReportArtifact,
  ensureSurveyReportCategoryPlan,
  ensureSurveyReportSourceSnapshot,
  findReadySurveyReportArtifact,
  findReadySurveyReportArtifactById,
  findSurveyReportSourceSnapshot,
  getSurveyWithQuestions,
  hashSurveyReportRequirement,
  listReadySurveyReportArtifacts,
  listSurveyResponses,
  normalizeJsonObject,
  readSurveyReportCategoryPlan,
  releaseSurveyReportGenerationClaim,
  type SurveyReportArtifactVersion,
  type SurveyReportArtifactKey,
} from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";
import { buildSurveyReportEvidence } from "@/lib/survey-report-evidence";
import {
  resolveSurveyReportGenerationStatus,
  type SurveyReportGenerationStatus,
} from "@/lib/survey-report-generation";
import {
  buildProfessionalReportDocument,
  rawTextResponsesFromSourceData,
  sanitizeProfessionalReportDocument,
} from "@/lib/survey-professional-report";
import { buildSurveyReportRequirementPayload } from "@/lib/survey-report-requirement";
import type { ProfessionalSurveyReportDocument } from "@/lib/survey-professional-report";
import {
  generateTemplateReportChapters,
  reportEvidenceRefs,
} from "@/lib/survey-report-chapter-generation";
import {
  assembleTemplateDrivenReport,
  buildSurveyReportTemplateSnapshot,
  materializeReportAssetUrls,
  type TemplateDrivenSurveyReport,
} from "@/lib/survey-template-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSurveyId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
}

function encodeHistoryCursor(
  artifact: SurveyReportArtifactVersion | undefined
): string | null {
  if (!artifact) return null;
  return Buffer.from(JSON.stringify({
    createdAt: artifact.createdAt,
    id: artifact.id,
  })).toString("base64url");
}

function nextHistoryCursorForPage(
  artifacts: SurveyReportArtifactVersion[]
): string | null {
  return artifacts.length === 50
    ? encodeHistoryCursor(artifacts[artifacts.length - 1])
    : null;
}

function decodeHistoryCursor(
  value: string | null
): { createdAt: string; id: string } | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8")
    ) as { createdAt?: unknown; id?: unknown };
    const createdAt = String(parsed.createdAt ?? "");
    const id = String(parsed.id ?? "");
    if (Number.isNaN(new Date(createdAt).getTime()) || !isUuid(id)) {
      return undefined;
    }
    return { createdAt, id };
  } catch {
    return undefined;
  }
}

function isoTimestamp(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

async function loadReportContext(rawId: string, requireManage: boolean) {
  const user = await currentUser();
  if (!user) {
    return { response: NextResponse.json({ error: "未登录" }, { status: 401 }) };
  }
  const surveyId = parseSurveyId(rawId);
  if (!surveyId) {
    return { response: NextResponse.json({ error: "问卷不存在" }, { status: 404 }) };
  }
  if (!(await canViewSurvey(surveyId, user.id, currentTeamId()))) {
    return { response: NextResponse.json({ error: "无权限" }, { status: 403 }) };
  }
  if (requireManage && !(await canManageSurveyScope(surveyId, user.id))) {
    return { response: NextResponse.json({ error: "无管理权限" }, { status: 403 }) };
  }

  const [survey, responses] = await Promise.all([
    getSurveyWithQuestions(surveyId),
    listSurveyResponses(surveyId),
  ]);
  if (!survey) {
    return { response: NextResponse.json({ error: "问卷不存在" }, { status: 404 }) };
  }
  const reportCategoryPlan = requireManage
    ? await ensureSurveyReportCategoryPlan(
        surveyId,
        survey.title,
        survey.questions
      )
    : await readSurveyReportCategoryPlan(
        surveyId,
        survey.title,
        survey.questions
      );
  const sourceSnapshot = buildSurveyReportSourceSnapshot({
    survey: {
      id: survey.id,
      title: survey.title,
      description: survey.description,
      updatedAt: survey.updated_at,
      responseMode: survey.response_mode,
      publishStartAt: survey.publish_start_at
        ? isoTimestamp(survey.publish_start_at)
        : null,
      publishEndAt: survey.publish_end_at
        ? isoTimestamp(survey.publish_end_at)
        : null,
      responseLimit: survey.response_limit,
      oneResponsePerUser: survey.one_response_per_user,
    },
    questions: survey.questions.map((question) => ({
      id: question.id,
      position: question.position,
      title: question.title,
      type: question.type,
      required: question.required,
      options: question.options,
      category: question.category,
    })),
    responses: responses.map((response) => ({
      id: response.id,
      submittedAt: isoTimestamp(response.submitted_at),
      answers: response.answers,
    })),
  });
  await ensureSurveyReportSourceSnapshot(sourceSnapshot);
  const requirementPayload = buildSurveyReportRequirementPayload(reportCategoryPlan);
  const requirementHash = hashSurveyReportRequirement(requirementPayload);
  const artifacts = await listReadySurveyReportArtifacts(surveyId);
  const evidence = buildSurveyReportEvidence({
    survey: {
      title: survey.title,
      description: survey.description,
      questions: survey.questions.map((question) => ({
        id: question.id,
        title: question.title,
        type: question.type,
        required: question.required,
        options: question.options,
      })),
    },
    responses: responses.map((response) => ({
      id: response.id,
      answers: response.answers,
    })),
  });

  return {
    user,
    survey,
    evidence,
    reportCategoryPlan,
    sourceSnapshot,
    requirementPayload,
    requirementHash,
    artifacts,
  };
}

function generationStatus(
  context: Awaited<ReturnType<typeof loadReportContext>>,
  requirementHash: string = (
    "requirementHash" in context ? String(context.requirementHash ?? "") : ""
  )
): SurveyReportGenerationStatus {
  if (
    !("sourceSnapshot" in context) ||
    !context.sourceSnapshot ||
    !("artifacts" in context) ||
    !context.artifacts
  ) {
    throw new Error("报告上下文不完整");
  }
  return resolveSurveyReportGenerationStatus({
    currentSourceRevision: context.sourceSnapshot.sourceRevision,
    currentRequirementHash: requirementHash,
    currentResponseCount: context.sourceSnapshot.responseCount,
    artifacts: context.artifacts,
  });
}

function includeArtifactInStatus(
  artifacts: SurveyReportArtifactVersion[],
  artifact: SurveyReportArtifactVersion | undefined
): SurveyReportArtifactVersion[] {
  if (!artifact || artifacts.some((item) => item.id === artifact.id)) {
    return artifacts;
  }
  return [...artifacts, artifact];
}

async function artifactReport(
  artifact: SurveyReportArtifactVersion | undefined
): Promise<
  ProfessionalSurveyReportDocument
  | ReturnType<typeof materializeReportAssetUrls>
  | undefined
> {
  const report = artifact?.report;
  if (!artifact || !report) return undefined;
  const sourceSnapshot = await findSurveyReportSourceSnapshot(
    artifact.sourceRevision
  );
  if (!sourceSnapshot) {
    throw new Error("survey_report_source_snapshot_missing");
  }
  if (report.schemaVersion === "template-driven-report-v1") {
    return materializeReportAssetUrls(
      report as unknown as TemplateDrivenSurveyReport,
      artifact.surveyId,
      artifact.id
    );
  }
  return sanitizeProfessionalReportDocument(
    report as unknown as ProfessionalSurveyReportDocument,
    rawTextResponsesFromSourceData(sourceSnapshot?.sourceData)
  );
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const context = await loadReportContext(params.id, false);
    if ("response" in context) return context.response;
    const requestUrl = new URL(request.url);
    const requestedArtifactId = requestUrl.searchParams.get("artifactId");
    if (requestedArtifactId && !isUuid(requestedArtifactId)) {
      return NextResponse.json({ error: "report_version_not_found" }, { status: 404 });
    }
    const historyBefore = requestUrl.searchParams.get("historyBefore");
    const historyCursor = decodeHistoryCursor(historyBefore);
    if (historyBefore && !historyCursor) {
      return NextResponse.json({ error: "invalid_history_cursor" }, { status: 400 });
    }
    if (historyCursor) {
      const historyArtifacts = await listReadySurveyReportArtifacts(
        context.survey.id,
        { before: historyCursor }
      );
      return NextResponse.json({
        historyPage: generationStatus({
          ...context,
          artifacts: historyArtifacts,
        }).versions,
        nextHistoryCursor: nextHistoryCursorForPage(historyArtifacts),
      });
    }
    const currentArtifact = await findReadySurveyReportArtifact({
      surveyId: context.survey.id,
      sourceRevision: context.sourceSnapshot.sourceRevision,
      requirementHash: context.requirementHash,
      templateVersion: SURVEY_REPORT_TEMPLATE_VERSION,
    });
    const requestedArtifact = requestedArtifactId
      ? await findReadySurveyReportArtifactById(
          context.survey.id,
          requestedArtifactId
        )
      : undefined;
    if (requestedArtifactId && !requestedArtifact) {
      return NextResponse.json({ error: "report_version_not_found" }, { status: 404 });
    }
    const latestArtifact = !requestedArtifact && !currentArtifact && context.artifacts[0]
      ? await findReadySurveyReportArtifactById(
          context.survey.id,
          context.artifacts[0].id
        )
      : undefined;
    const artifact = requestedArtifact ?? currentArtifact ?? latestArtifact;
    const status = generationStatus({
      ...context,
      artifacts: includeArtifactInStatus(context.artifacts, currentArtifact),
    });
    const report = await artifactReport(artifact) ?? buildProfessionalReportDocument({
      evidence: context.evidence,
      generatedAt: new Date().toISOString(),
      reportPlan: context.reportCategoryPlan,
    });
    const historyArtifacts = context.artifacts;
    const nextHistoryCursor = nextHistoryCursorForPage(historyArtifacts);
    const historyPage = generationStatus({
      ...context,
      artifacts: historyArtifacts,
    }).versions;

    return NextResponse.json({
      report,
      preview: !artifact,
      selectedArtifactId: artifact?.id ?? null,
      generation: { ...status, nextHistoryCursor },
      historyPage,
      nextHistoryCursor,
    });
  } catch (error) {
    console.error("[api] professional-report load failed", error);
    return NextResponse.json({ error: "professional_report_load_failed" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  let claimedGeneration:
    | { artifactKey: SurveyReportArtifactKey; sessionId: string }
    | undefined;
  try {
    const context = await loadReportContext(params.id, true);
    if ("response" in context) return context.response;
    const body = (await request.json().catch(() => ({}))) as {
      model?: unknown;
    };
    const model = String(body.model ?? "qwen3.7-max").trim() || "qwen3.7-max";
    const requirementHash = context.requirementHash;
    const artifactKey = {
      surveyId: context.survey.id,
      sourceRevision: context.sourceSnapshot.sourceRevision,
      requirementHash,
      templateVersion: SURVEY_REPORT_TEMPLATE_VERSION,
    };
    const existing = await findReadySurveyReportArtifact(artifactKey);
    if (existing) {
      const historyPage = await listReadySurveyReportArtifacts(context.survey.id);
      const artifacts = includeArtifactInStatus(
        historyPage,
        existing
      );
      return NextResponse.json({
        report: await artifactReport(existing),
        reused: true,
        model: existing.modelId,
        generation: {
          ...generationStatus({ ...context, artifacts }, requirementHash),
          nextHistoryCursor: nextHistoryCursorForPage(historyPage),
        },
      });
    }

    if (context.evidence.sample.responseCount === 0) {
      return NextResponse.json(
        {
          error: "report_requires_responses",
          minimumResponseCount: 1,
        },
        { status: 422 }
      );
    }

    const claim = await claimSurveyReportGeneration({
      ...artifactKey,
      sessionId: randomUUID(),
      actorUserId: context.user.id,
      goal: "按已保存的章节计划生成专业问卷报告",
      teamId: context.survey.team_id,
      selectedModelId: model,
      provider: "qwen",
      context: {
        source: "versioned_survey_report",
        sourceRevision: context.sourceSnapshot.sourceRevision,
        requirementHash,
      },
    });
    if (claim.status === "ready") {
      const historyPage = await listReadySurveyReportArtifacts(context.survey.id);
      const artifacts = includeArtifactInStatus(
        historyPage,
        claim.artifact
      );
      return NextResponse.json({
        report: await artifactReport(claim.artifact),
        reused: true,
        model: claim.artifact.modelId,
        generation: {
          ...generationStatus({ ...context, artifacts }, requirementHash),
          nextHistoryCursor: nextHistoryCursorForPage(historyPage),
        },
      });
    }
    if (claim.status === "in_progress") {
      return NextResponse.json({
        status: "in_progress",
        sessionId: claim.sessionId,
        reused: false,
        generation: {
          ...generationStatus(context, requirementHash),
          nextHistoryCursor: nextHistoryCursorForPage(context.artifacts),
        },
      }, { status: 202 });
    }
    const session = { id: claim.sessionId };
    claimedGeneration = { artifactKey, sessionId: session.id };
    const startedAt = Date.now();

    const artifactId = randomUUID();
    const generatedAt = new Date().toISOString();
    const snapshot = buildSurveyReportTemplateSnapshot(
      context.reportCategoryPlan
    );
    const chapters = await generateTemplateReportChapters({
      snapshot,
      evidence: context.evidence,
      sourceRevision: context.sourceSnapshot.sourceRevision,
      teamId:
        context.survey.team_id
        ?? currentTeamId()
        ?? `personal-${context.user.id}`,
      surveyId: context.survey.id,
      artifactId,
      model,
    });
    const report = assembleTemplateDrivenReport({
      title: snapshot.title || context.survey.title,
      generatedAt,
      sourceRevision: context.sourceSnapshot.sourceRevision,
      snapshot,
      chapters,
      allowedEvidenceRefs: reportEvidenceRefs(context.evidence),
      sample: {
        responseCount: context.evidence.sample.responseCount,
        questionCount: context.evidence.survey.questionCount,
        confidence: context.evidence.sample.confidence,
      },
    });
    await createSurveyAiModelTrace({
      id: randomUUID(),
      sessionId: session.id,
      provider: "qwen",
      modelId: model,
      prompt: {
        sourceRevision: context.sourceSnapshot.sourceRevision,
        requirementHash,
        responseCount: context.sourceSnapshot.responseCount,
        chapterCount: snapshot.chapters.length,
      },
      response: normalizeJsonObject({
        schemaVersion: report.schemaVersion,
        chapters: report.chapters.map((chapter) => ({
          chapterId: chapter.chapterId,
          outputType: chapter.outputType,
          evidenceRefs: chapter.evidenceRefs,
        })),
      }),
      status: "succeeded",
      latencyMs: Date.now() - startedAt,
    });
    const artifact = await createVersionedSurveyReportArtifact({
      id: artifactId,
      sessionId: session.id,
      surveyId: context.survey.id,
      sourceRevision: context.sourceSnapshot.sourceRevision,
      requirementHash,
      templateVersion: SURVEY_REPORT_TEMPLATE_VERSION,
      responseCount: context.sourceSnapshot.responseCount,
      report: normalizeJsonObject(report),
      modelId: model,
      provider: "qwen",
    });
    await completeSurveyReportGenerationClaim({
      ...artifactKey,
      sessionId: session.id,
      artifactId: artifact.id,
    });
    const artifacts = await listReadySurveyReportArtifacts(context.survey.id);

    return NextResponse.json({
      report: await artifactReport(artifact),
      reused: false,
      model: artifact.modelId,
      generation: {
        ...generationStatus({ ...context, artifacts }, requirementHash),
        nextHistoryCursor: nextHistoryCursorForPage(artifacts),
      },
    });
  } catch (error) {
    if (claimedGeneration) {
      await releaseSurveyReportGenerationClaim({
        ...claimedGeneration.artifactKey,
        sessionId: claimedGeneration.sessionId,
        errorMessage:
          error instanceof Error ? error.message : "report_generation_failed",
      }).catch((releaseError) => {
        console.error("[api] professional-report claim release failed", releaseError);
      });
    }
    console.error("[api] professional-report generation failed", error);
    return NextResponse.json({ error: "professional_report_generation_failed" }, { status: 500 });
  }
}
