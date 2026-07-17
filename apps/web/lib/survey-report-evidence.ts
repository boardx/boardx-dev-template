import type {
  ReportQuestion,
  ReportQuestionType,
  ReportResponseDefinition,
  ReportSurveyDefinition,
} from "./survey-report-planner";

export type SurveyEvidenceConfidence = "none" | "low" | "medium" | "high";
export const SURVEY_MIN_RELIABLE_SAMPLE = 30;

export interface SurveyDistributionDatum {
  label: string;
  count: number;
  percentage: number;
  denominator: number;
}

export interface SurveyScoreSummary {
  mean: number;
  median: number;
  minimum: number;
  maximum: number;
  distribution: SurveyDistributionDatum[];
}

export interface SurveyQuestionEvidence {
  questionId: number;
  title: string;
  type: ReportQuestionType;
  validResponseCount: number;
  missingResponseCount: number;
  distribution?: SurveyDistributionDatum[];
  score?: SurveyScoreSummary;
  textResponses?: string[];
}

export interface SurveyEvidenceClaim {
  id: string;
  questionId: number;
  statement: string;
  evidenceLabel: string;
  value: number;
  denominator: number;
  confidence: Exclude<SurveyEvidenceConfidence, "none">;
  directional: boolean;
}

export interface SurveyReportEvidenceBundle {
  survey: { title: string; description: string; questionCount: number };
  sample: {
    responseCount: number;
    confidence: SurveyEvidenceConfidence;
  };
  questions: SurveyQuestionEvidence[];
  claims: SurveyEvidenceClaim[];
  limitations: string[];
}

export interface BuildSurveyReportEvidenceInput {
  survey: ReportSurveyDefinition;
  responses: ReportResponseDefinition[];
}

const choiceTypes = new Set<ReportQuestionType>(["single", "multiple", "dropdown"]);
const scoreTypes = new Set<ReportQuestionType>(["rating", "linear_scale", "nps", "number"]);
const textTypes = new Set<ReportQuestionType>(["short_text", "text"]);

function answerFor(question: ReportQuestion, response: ReportResponseDefinition) {
  return response.answers[String(question.id)] ?? response.answers[question.id];
}

function isPresent(value: unknown) {
  if (value === null || value === undefined || value === "") return false;
  return !Array.isArray(value) || value.length > 0;
}

function percentage(count: number, denominator: number) {
  return denominator ? Math.round((count / denominator) * 1000) / 10 : 0;
}

function confidenceFor(responseCount: number): SurveyEvidenceConfidence {
  if (responseCount === 0) return "none";
  if (responseCount < SURVEY_MIN_RELIABLE_SAMPLE) return "low";
  if (responseCount < 100) return "medium";
  return "high";
}

function choiceEvidence(question: ReportQuestion, values: unknown[]): SurveyDistributionDatum[] {
  const selected = values.flatMap((value) => Array.isArray(value) ? value : [value]).map(String);
  const labels = question.options.length
    ? question.options
    : Array.from(new Set(selected));
  return labels.map((label) => {
    const count = selected.filter((value) => value === label).length;
    return { label, count, percentage: percentage(count, values.length), denominator: values.length };
  });
}

function scoreEvidence(values: unknown[]): SurveyScoreSummary | undefined {
  const numbers = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!numbers.length) return undefined;
  const counts = new Map<number, number>();
  numbers.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  const middle = Math.floor(numbers.length / 2);
  const median = numbers.length % 2
    ? numbers[middle]!
    : (numbers[middle - 1]! + numbers[middle]!) / 2;
  return {
    mean: Math.round((numbers.reduce((sum, value) => sum + value, 0) / numbers.length) * 100) / 100,
    median,
    minimum: numbers[0]!,
    maximum: numbers[numbers.length - 1]!,
    distribution: Array.from(counts.entries()).map(([value, count]) => ({
      label: String(value),
      count,
      percentage: percentage(count, numbers.length),
      denominator: numbers.length,
    })),
  };
}

function buildQuestionEvidence(
  question: ReportQuestion,
  responses: ReportResponseDefinition[]
): SurveyQuestionEvidence {
  const values = responses.map((response) => answerFor(question, response)).filter(isPresent);
  const base: SurveyQuestionEvidence = {
    questionId: question.id,
    title: question.title,
    type: question.type,
    validResponseCount: values.length,
    missingResponseCount: responses.length - values.length,
  };
  if (!values.length) return base;
  if (choiceTypes.has(question.type)) return { ...base, distribution: choiceEvidence(question, values) };
  if (scoreTypes.has(question.type)) return { ...base, score: scoreEvidence(values) };
  if (textTypes.has(question.type)) {
    return { ...base, textResponses: values.map(String).map((value) => value.trim()).filter(Boolean) };
  }
  return base;
}

function claimsFromQuestions(
  questions: SurveyQuestionEvidence[],
  confidence: SurveyEvidenceConfidence
): SurveyEvidenceClaim[] {
  if (confidence === "none") return [];
  return questions.flatMap((question) => {
    const ranked = [...(question.distribution ?? [])].sort((a, b) => b.count - a.count);
    const top = ranked[0];
    if (!top || top.denominator === 0) return [];
    return [{
      id: `question-${question.questionId}-top`,
      questionId: question.questionId,
      statement: `在「${question.title}」中，「${top.label}」为占比最高的回答。`,
      evidenceLabel: top.label,
      value: top.count,
      denominator: top.denominator,
      confidence,
      directional: confidence === "low",
    }];
  });
}

export function buildSurveyReportEvidence({
  survey,
  responses,
}: BuildSurveyReportEvidenceInput): SurveyReportEvidenceBundle {
  const confidence = confidenceFor(responses.length);
  const limitations: string[] = [];
  if (!responses.length) limitations.push("尚无真实答卷，无法生成分析结论。");
  else if (responses.length < SURVEY_MIN_RELIABLE_SAMPLE) {
    limitations.push(`有效样本少于 ${SURVEY_MIN_RELIABLE_SAMPLE} 份，结论仅作为方向性信号。`);
  }

  const questions = survey.questions.map((question) => buildQuestionEvidence(question, responses));
  return {
    survey: { title: survey.title, description: survey.description, questionCount: survey.questions.length },
    sample: { responseCount: responses.length, confidence },
    questions,
    claims: claimsFromQuestions(questions, confidence),
    limitations,
  };
}
