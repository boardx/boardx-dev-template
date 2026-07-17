import type {
  SurveyEvidenceClaim,
  SurveyQuestionEvidence,
  SurveyReportEvidenceBundle,
} from "./survey-report-evidence";

export interface AiEvidenceClaimCandidate {
  statement: string;
  evidenceId: string;
  value: number;
  denominator: number;
  implication?: string;
  recommendation?: string;
}

export interface ValidatedReportClaim extends SurveyEvidenceClaim {
  implication?: string;
  recommendation?: string;
}

export interface ProfessionalReportChart {
  questionId: number;
  title: string;
  type: "bar" | "score";
  denominator: number;
  denominatorLabel: string;
  rows: Array<{ label: string; count: number; percentage: number }>;
}

export interface ProfessionalReportChapter {
  id: string;
  title: string;
  questionId: number;
  validResponseCount: number;
  missingResponseCount: number;
  chart?: ProfessionalReportChart;
  textResponses?: string[];
  claims: ValidatedReportClaim[];
  limitations: string[];
}

export interface ProfessionalSurveyReportDocument {
  title: string;
  generatedAt: string;
  status: "empty" | "directional" | "ready";
  emptyState?: string;
  executiveSummary: { claims: ValidatedReportClaim[] };
  methodology: {
    sampleSize: number;
    questionCount: number;
    confidence: SurveyReportEvidenceBundle["sample"]["confidence"];
    statement: string;
  };
  chapters: ProfessionalReportChapter[];
  limitations: string[];
  actions: Array<{ priority: "high" | "medium"; action: string; evidenceIds: string[] }>;
}

export function validateEvidenceClaims(
  evidence: SurveyReportEvidenceBundle,
  candidates: AiEvidenceClaimCandidate[]
): ValidatedReportClaim[] {
  const source = new Map(evidence.claims.map((claim) => [claim.id, claim]));
  return candidates.flatMap((candidate) => {
    const matched = source.get(candidate.evidenceId);
    if (!matched || matched.value !== candidate.value || matched.denominator !== candidate.denominator) return [];
    return [{
      ...matched,
      statement: candidate.statement.trim() || matched.statement,
      implication: candidate.implication?.trim() || undefined,
      recommendation: candidate.recommendation?.trim() || undefined,
    }];
  });
}

function chartForQuestion(question: SurveyQuestionEvidence): ProfessionalReportChart | undefined {
  const rows = question.distribution ?? question.score?.distribution;
  if (!rows?.length || question.validResponseCount === 0) return undefined;
  return {
    questionId: question.questionId,
    title: question.title,
    type: question.score ? "score" : "bar",
    denominator: question.validResponseCount,
    denominatorLabel: question.type === "multiple" ? "有效答题人数" : "有效回答数",
    rows: rows.map((row) => ({ label: row.label, count: row.count, percentage: row.percentage })),
  };
}

function chapterForQuestion(
  question: SurveyQuestionEvidence,
  claims: ValidatedReportClaim[],
  lowSample: boolean
): ProfessionalReportChapter {
  const limitations: string[] = [];
  if (!question.validResponseCount) limitations.push("该题暂无有效回答。");
  else if (lowSample) limitations.push("该题样本不足 30，结果仅作为方向性信号。");
  if (question.missingResponseCount > 0) limitations.push(`该题有 ${question.missingResponseCount} 份缺失回答。`);
  return {
    id: `question-${question.questionId}`,
    title: question.title,
    questionId: question.questionId,
    validResponseCount: question.validResponseCount,
    missingResponseCount: question.missingResponseCount,
    chart: chartForQuestion(question),
    textResponses: question.textResponses?.slice(0, 8),
    claims: claims.filter((claim) => claim.questionId === question.questionId),
    limitations,
  };
}

export function buildProfessionalReportDocument({
  evidence,
  generatedAt,
  aiClaims = [],
}: {
  evidence: SurveyReportEvidenceBundle;
  generatedAt: string;
  aiClaims?: AiEvidenceClaimCandidate[];
}): ProfessionalSurveyReportDocument {
  const validatedAiClaims = validateEvidenceClaims(evidence, aiClaims);
  const claims: ValidatedReportClaim[] = validatedAiClaims.length ? validatedAiClaims : evidence.claims;
  const lowSample = evidence.sample.responseCount > 0 && evidence.sample.responseCount < 30;
  const status = evidence.sample.responseCount === 0 ? "empty" : lowSample ? "directional" : "ready";
  return {
    title: `${evidence.survey.title} 分析报告`,
    generatedAt,
    status,
    emptyState: status === "empty" ? "尚无真实答卷，无法生成分析结论。" : undefined,
    executiveSummary: { claims: status === "empty" ? [] : claims.slice(0, 5) },
    methodology: {
      sampleSize: evidence.sample.responseCount,
      questionCount: evidence.survey.questionCount,
      confidence: evidence.sample.confidence,
      statement: "报告仅使用已提交的真实答卷；每张图表按单个题目独立聚合。",
    },
    chapters: evidence.questions.map((question) => chapterForQuestion(question, claims, lowSample)),
    limitations: evidence.limitations,
    actions: status === "empty"
      ? []
      : claims.slice(0, 3).map((claim) => ({
          priority: claim.directional ? "medium" : "high",
          action: claim.recommendation ?? `进一步验证「${claim.evidenceLabel}」背后的原因。`,
          evidenceIds: [claim.id],
        })),
  };
}
