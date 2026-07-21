export interface DesignSummaryQuestion {
  id: string;
  title: string;
  category?: string;
}

export interface SurveyDesignSummary {
  categories: string[];
  questionCount: number;
  estimatedMinutes: number;
  segmentVariables: string[];
  hypotheses: Array<{ id: string; title: string; category?: string }>;
}

const SEGMENT_CATEGORY_PATTERN =
  /demographic|user_info|basic|profile|department|role|基本|人口|用户信息|部门|角色|画像/i;

export function buildSurveyDesignSummary(
  questions: DesignSummaryQuestion[]
): SurveyDesignSummary {
  const categories = Array.from(
    new Set(
      questions
        .map((question) => question.category?.trim())
        .filter((category): category is string => Boolean(category))
    )
  );

  return {
    categories,
    questionCount: questions.length,
    estimatedMinutes: questions.length
      ? Math.max(1, Math.ceil(questions.length / 2))
      : 0,
    segmentVariables: categories.filter((category) =>
      SEGMENT_CATEGORY_PATTERN.test(category)
    ),
    hypotheses: questions
      .filter((question) => question.title.trim())
      .slice(0, 3)
      .map((question, index) => ({
        id: `H${index + 1}`,
        title: question.title.trim(),
        category: question.category?.trim() || undefined,
      })),
  };
}
