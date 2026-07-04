// packages/ai/src/reportSummaryGenerator.ts — CAP-AI 问卷报告摘要生成器（P13 F07）
//
// 同 studioGenerator.ts / presentationGenerator.ts 的 sanctioned stub 模式——未接入真实生成
// 管线时，产出确定性的自然语言摘要文本，使上层可在无供应商额度环境下跑通「生成 → loading →
// 摘要文本/失败 + 重试」端到端闭环。真实管线接入（未来换成真实 LLM 撰写）不改变本层契约
// （generateReportSummary 的输入输出形状），只需替换内部实现。
//
// 输入是 Report 视图已有的聚合数据（复用 packages/data/src/survey.ts 的
// listSurveyResponses/getSurveyWithQuestions 派生结果，见 apps/web 的
// app/api/surveys/[id]/results/ai-summary/route.ts），不重新派生一套聚合逻辑。
// 摘要不持久化落库——每次调用都是即时生成（F07 范围纪律：无历史版本管理）。

export type ReportSummaryQuestionType = "text" | "single" | "multiple" | "rating";

export interface ReportSummaryOptionCount {
  option: string;
  count: number;
}

export interface ReportSummaryQuestionInput {
  id: number;
  title: string;
  type: ReportSummaryQuestionType;
  answeredCount: number;
  skippedCount: number;
  optionCounts?: ReportSummaryOptionCount[];
  average?: number;
}

export interface ReportSummaryGenerateInput {
  surveyTitle: string;
  totalResponses: number;
  averageCompletion: number;
  questions: ReportSummaryQuestionInput[];
}

export interface ReportSummaryGenerateResult {
  text: string;
}

/** e2e/测试专用触发词：survey 标题含此串时生成器主动抛错，用于确定性验证「生成失败 + 重试」
 *  （F07 验收）。与 studioGenerator.ts 的 STUDIO_FORCE_FAIL_MARKER 同一 sanctioned 模式。 */
export const REPORT_SUMMARY_FORCE_FAIL_MARKER = "__report_summary_force_fail__";

function topOption(counts: ReportSummaryOptionCount[] | undefined): ReportSummaryOptionCount | undefined {
  if (!counts || counts.length === 0) return undefined;
  return [...counts].sort((a, b) => b.count - a.count)[0];
}

/** 确定性生成一段基于当前回收数据的自然语言摘要（stub，无真实 AI 撰写管线）。
 *  失败态由 REPORT_SUMMARY_FORCE_FAIL_MARKER 触发，供 e2e 确定性验证失败 + 重试分支。 */
export async function generateReportSummary(
  input: ReportSummaryGenerateInput
): Promise<ReportSummaryGenerateResult> {
  if (input.surveyTitle.includes(REPORT_SUMMARY_FORCE_FAIL_MARKER)) {
    throw new Error("报告摘要生成失败（测试触发）");
  }

  const { surveyTitle, totalResponses, averageCompletion, questions } = input;

  const sentences: string[] = [];
  sentences.push(
    `“${surveyTitle}” 目前共收到 ${totalResponses} 份回收，平均完成率 ${averageCompletion}%。`
  );

  const highlights: string[] = [];
  for (const q of questions) {
    if ((q.type === "single" || q.type === "multiple") && q.optionCounts) {
      const top = topOption(q.optionCounts);
      if (top && top.count > 0) {
        highlights.push(`「${q.title}」中最多人选择「${top.option}」（${top.count} 次）`);
      }
    } else if (q.type === "rating" && typeof q.average === "number") {
      highlights.push(`「${q.title}」平均评分为 ${q.average} 分`);
    } else if (q.type === "text" && q.answeredCount > 0) {
      highlights.push(`「${q.title}」收到 ${q.answeredCount} 条文本反馈`);
    }
    if (q.skippedCount > 0) {
      highlights.push(`「${q.title}」有 ${q.skippedCount} 份跳过`);
    }
  }

  if (highlights.length > 0) {
    sentences.push(`关键发现：${highlights.slice(0, 5).join("；")}。`);
  } else {
    sentences.push("目前尚无足够的题目分布数据用于提炼关键发现。");
  }

  sentences.push("建议持续关注回收率变化，并在样本量增长后重新生成摘要以获取最新趋势。");

  return { text: sentences.join(" ") };
}
