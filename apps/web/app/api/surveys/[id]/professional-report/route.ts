import { NextResponse } from "next/server";
import { canViewSurvey, getSurveyWithQuestions, listSurveyResponses } from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";
import { buildSurveyReportEvidence } from "@/lib/survey-report-evidence";
import { buildProfessionalReportDocument } from "@/lib/survey-professional-report";
import type { AiEvidenceClaimCandidate } from "@/lib/survey-professional-report";
import { callQwenJson } from "@/lib/qwen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSurveyId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function loadEvidenceReportContext(rawId: string) {
  const user = await currentUser();
  if (!user) return { response: NextResponse.json({ error: "未登录" }, { status: 401 }) };
  const surveyId = parseSurveyId(rawId);
  if (!surveyId) return { response: NextResponse.json({ error: "问卷不存在" }, { status: 404 }) };
  if (!(await canViewSurvey(surveyId, user.id, currentTeamId()))) {
    return { response: NextResponse.json({ error: "无权限" }, { status: 403 }) };
  }

  const [survey, responses] = await Promise.all([
    getSurveyWithQuestions(surveyId),
    listSurveyResponses(surveyId),
  ]);
  if (!survey) return { response: NextResponse.json({ error: "问卷不存在" }, { status: 404 }) };

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
    responses: responses.map((response) => ({ id: response.id, answers: response.answers })),
  });
  return { evidence };
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const context = await loadEvidenceReportContext(params.id);
  if (context.response) return context.response;
  const report = buildProfessionalReportDocument({ evidence: context.evidence!, generatedAt: new Date().toISOString() });
  return NextResponse.json({ report });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const context = await loadEvidenceReportContext(params.id);
  if (context.response) return context.response;
  const evidence = context.evidence!;
  const body = (await request.json().catch(() => ({}))) as { instruction?: unknown; model?: unknown };
  const instruction = String(body.instruction ?? "").trim();
  const model = String(body.model ?? "qwen3.7-max").trim() || "qwen3.7-max";
  let aiClaims: AiEvidenceClaimCandidate[] = [];
  let warning: string | undefined;

  if (evidence.sample.responseCount > 0 && evidence.claims.length > 0) {
    try {
      const generated = await callQwenJson<{ claims?: AiEvidenceClaimCandidate[] }>({
        model,
        temperature: 0.15,
        messages: [
          {
            role: "system",
            content: "你是专业调研分析师。只输出严格 JSON。不得补数、合并不同题目口径、暗示因果关系。每条结论必须原样引用给定 evidenceId、value 和 denominator。",
          },
          {
            role: "user",
            content: JSON.stringify({
              task: "generate_evidence_bound_survey_claims",
              instruction,
              requiredShape: { claims: [{ statement: "结论", evidenceId: "证据ID", value: 1, denominator: 10, implication: "业务含义", recommendation: "行动建议" }] },
              evidence,
            }),
          },
        ],
      });
      aiClaims = Array.isArray(generated.claims) ? generated.claims : [];
    } catch {
      warning = "千问暂不可用，已保留真实统计结果；可稍后重新生成 AI 解读。";
    }
  }

  const report = buildProfessionalReportDocument({ evidence, generatedAt: new Date().toISOString(), aiClaims });
  return NextResponse.json({ report, warning, model });
}
