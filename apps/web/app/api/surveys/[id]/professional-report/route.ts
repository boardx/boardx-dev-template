import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  SURVEY_REPORT_TEMPLATE_VERSION,
  buildSurveyReportSourceSnapshot,
  canManageSurveyScope,
  canViewSurvey,
  createSurveyAiModelTrace,
  createSurveyAiSession,
  createVersionedSurveyReportArtifact,
  ensureSurveyReportCategoryPlan,
  ensureSurveyReportSourceSnapshot,
  findReadySurveyReportArtifact,
  getSurveyWithQuestions,
  hashSurveyReportRequirement,
  listReadySurveyReportArtifacts,
  listSurveyResponses,
  normalizeJsonObject,
  updateSurveyAiSessionStatus,
  type SurveyReportArtifactVersion,
} from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";
import { buildSurveyReportEvidence } from "@/lib/survey-report-evidence";
import {
  resolveSurveyReportGenerationStatus,
  type SurveyReportGenerationStatus,
} from "@/lib/survey-report-generation";
import { buildProfessionalReportDocument } from "@/lib/survey-professional-report";
import { buildSurveyReportRequirementPayload } from "@/lib/survey-report-requirement";
import { selectExactReportVersion } from "@/lib/survey-report-version-navigation";
import type { AiEvidenceClaimCandidate } from "@/lib/survey-professional-report";
import type { ProfessionalSurveyReportDocument } from "@/lib/survey-professional-report";
import { callQwenJson } from "@/lib/qwen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSurveyId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
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
  const reportCategoryPlan = await ensureSurveyReportCategoryPlan(
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
      submittedAt: response.submitted_at,
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

function artifactReport(
  artifact: SurveyReportArtifactVersion | undefined
): ProfessionalSurveyReportDocument | undefined {
  return artifact?.report as unknown as ProfessionalSurveyReportDocument | undefined;
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const context = await loadReportContext(params.id, false);
    if ("response" in context) return context.response;
    const status = generationStatus(context);
    const requestedArtifact = selectExactReportVersion(
      context.artifacts,
      new URL(request.url).searchParams.get("artifactId")
    );
    if (requestedArtifact.isExplicitRequest && !requestedArtifact.artifact) {
      return NextResponse.json({ error: "report_version_not_found" }, { status: 404 });
    }
    const currentArtifact = await findReadySurveyReportArtifact({
      surveyId: context.survey.id,
      sourceRevision: context.sourceSnapshot.sourceRevision,
      requirementHash: context.requirementHash,
      templateVersion: SURVEY_REPORT_TEMPLATE_VERSION,
    });
    const artifact = requestedArtifact.artifact ?? currentArtifact ?? context.artifacts[0];
    const report = artifactReport(artifact) ?? buildProfessionalReportDocument({
      evidence: context.evidence,
      generatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      report,
      preview: !artifact,
      selectedArtifactId: artifact?.id ?? null,
      generation: status,
    });
  } catch (error) {
    console.error("[api] professional-report load failed", error);
    return NextResponse.json({ error: "professional_report_load_failed" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const context = await loadReportContext(params.id, true);
    if ("response" in context) return context.response;
    const body = (await request.json().catch(() => ({}))) as {
      instruction?: unknown;
      model?: unknown;
    };
    const instruction = String(body.instruction ?? "").trim();
    const model = String(body.model ?? "qwen3.7-max").trim() || "qwen3.7-max";
    const requirementHash = instruction
      ? hashSurveyReportRequirement({
          plan: context.requirementPayload,
          instruction,
        })
      : context.requirementHash;
    const artifactKey = {
      surveyId: context.survey.id,
      sourceRevision: context.sourceSnapshot.sourceRevision,
      requirementHash,
      templateVersion: SURVEY_REPORT_TEMPLATE_VERSION,
    };
    const existing = await findReadySurveyReportArtifact(artifactKey);
    if (existing) {
      return NextResponse.json({
        report: artifactReport(existing),
        reused: true,
        model: existing.modelId,
        generation: generationStatus(
          { ...context, artifacts: await listReadySurveyReportArtifacts(context.survey.id) },
          requirementHash
        ),
      });
    }

    const session = await createSurveyAiSession({
      id: randomUUID(),
      actorUserId: context.user.id,
      kind: "report",
      goal: instruction || "生成专业问卷报告",
      surveyId: context.survey.id,
      teamId: context.survey.team_id,
      status: "generating",
      selectedModelId: model,
      provider: "qwen",
      context: {
        source: "versioned_survey_report",
        sourceRevision: context.sourceSnapshot.sourceRevision,
        requirementHash,
      },
    });
    const startedAt = Date.now();
    let aiClaims: AiEvidenceClaimCandidate[] = [];
    let warning: string | undefined;
    let artifactModel = model;
    let artifactProvider = "qwen";

    if (context.evidence.sample.responseCount > 0 && context.evidence.claims.length > 0) {
      try {
        const generated = await callQwenJson<{ claims?: AiEvidenceClaimCandidate[] }>({
          model,
          temperature: 0.15,
          messages: [
            {
              role: "system",
              content:
                "你是专业调研分析师。只输出严格 JSON。不得补数、合并不同题目口径、暗示因果关系。每条结论必须原样引用给定 evidenceId、value 和 denominator。",
            },
            {
              role: "user",
              content: JSON.stringify({
                task: "generate_evidence_bound_survey_claims",
                requirement: instruction || context.requirementPayload,
                requiredShape: {
                  claims: [{
                    statement: "结论",
                    evidenceId: "证据ID",
                    value: 1,
                    denominator: 10,
                    implication: "业务含义",
                    recommendation: "行动建议",
                  }],
                },
                evidence: context.evidence,
              }),
            },
          ],
        });
        aiClaims = Array.isArray(generated.claims) ? generated.claims : [];
        await createSurveyAiModelTrace({
          id: randomUUID(),
          sessionId: session.id,
          provider: "qwen",
          modelId: model,
          prompt: {
            sourceRevision: context.sourceSnapshot.sourceRevision,
            requirementHash,
            responseCount: context.sourceSnapshot.responseCount,
          },
          response: normalizeJsonObject(generated),
          status: "succeeded",
          latencyMs: Date.now() - startedAt,
        });
      } catch (error) {
        warning = "千问暂不可用，已保存基于真实统计的报告版本；可稍后重新生成 AI 解读。";
        artifactModel = "deterministic:evidence";
        artifactProvider = "deterministic";
        await createSurveyAiModelTrace({
          id: randomUUID(),
          sessionId: session.id,
          provider: "qwen",
          modelId: model,
          prompt: {
            sourceRevision: context.sourceSnapshot.sourceRevision,
            requirementHash,
            responseCount: context.sourceSnapshot.responseCount,
          },
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "model_failed",
          latencyMs: Date.now() - startedAt,
        });
      }
    }

    const generatedAt = new Date().toISOString();
    const report = buildProfessionalReportDocument({
      evidence: context.evidence,
      generatedAt,
      aiClaims,
    });
    const artifact = await createVersionedSurveyReportArtifact({
      id: randomUUID(),
      sessionId: session.id,
      surveyId: context.survey.id,
      sourceRevision: context.sourceSnapshot.sourceRevision,
      requirementHash,
      templateVersion: SURVEY_REPORT_TEMPLATE_VERSION,
      responseCount: context.sourceSnapshot.responseCount,
      report: normalizeJsonObject(report),
      modelId: artifactModel,
      provider: artifactProvider,
    });
    await updateSurveyAiSessionStatus(session.id, "ready");
    const artifacts = await listReadySurveyReportArtifacts(context.survey.id);

    return NextResponse.json({
      report: artifactReport(artifact),
      reused: false,
      warning,
      model: artifact.modelId,
      generation: generationStatus({ ...context, artifacts }, requirementHash),
    });
  } catch (error) {
    console.error("[api] professional-report generation failed", error);
    return NextResponse.json({ error: "professional_report_generation_failed" }, { status: 500 });
  }
}
