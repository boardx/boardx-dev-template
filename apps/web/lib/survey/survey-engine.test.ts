import { describe, expect, it } from "vitest";
import {
  calculateSurveyReport,
  generateReportTemplate,
  sampleSurvey,
  sampleResponses,
  validateSurveyForPublish,
} from "./survey-engine";

describe("survey engine", () => {
  it("requires questions and a report template before publishing", () => {
    const result = validateSurveyForPublish({
      survey: { ...sampleSurvey.survey, title: "" },
      sections: sampleSurvey.sections,
      questions: [],
      reportTemplate: undefined,
    });

    expect(result.passed).toBe(false);
    expect(result.errors).toEqual([
      "问卷必须有标题",
      "至少包含 1 个问题",
      "报告模板必须存在",
    ]);
  });

  it("generates a report template from question analysis roles", () => {
    const template = generateReportTemplate(sampleSurvey);

    expect(template.reportTemplate.reportType).toBe("business_diagnosis_report");
    expect(template.reportTemplate.sections.map((section) => section.type)).toEqual([
      "executive_summary",
      "sample_profile",
      "key_metrics",
      "dimension_analysis",
      "cross_analysis",
      "recommendation",
      "appendix",
    ]);
    expect(template.reportTemplate.metrics.map((metric) => metric.key)).toEqual([
      "response_count",
      "completion_rate",
      "digital_maturity_score",
    ]);
    expect(template.warnings).toEqual([]);
    expect(template.suggestions).toContain("可增加开放题，用于提炼企业转型痛点和行动建议。");
  });

  it("calculates professional report metrics and option distributions", () => {
    const template = generateReportTemplate(sampleSurvey).reportTemplate;
    const report = calculateSurveyReport(sampleSurvey, sampleResponses, template);

    expect(report.summary).toContain("共回收 5 份样本");
    expect(report.sections[0]?.metrics).toEqual([
      { label: "样本总数", value: "5", tone: "blue" },
      { label: "有效样本", value: "4", tone: "green" },
      { label: "完成率", value: "80%", tone: "violet" },
      { label: "平均用时", value: "7分55秒", tone: "amber" },
    ]);
    expect(report.charts.industryDistribution).toEqual([
      { label: "制造业", value: 2, percent: 50 },
      { label: "服务业", value: 1, percent: 25 },
      { label: "IT/互联网", value: 1, percent: 25 },
    ]);
    expect(report.charts.blockerDistribution).toEqual([
      { label: "缺少数字化人才", value: 2, percent: 33 },
      { label: "预算不足", value: 1, percent: 17 },
      { label: "数据孤岛", value: 2, percent: 33 },
      { label: "流程复杂", value: 1, percent: 17 },
    ]);
    expect(report.charts.digitalMaturityScore).toBe(3.6);
    expect(report.charts.dimensionScores).toEqual([
      {
        key: "digital_maturity",
        label: "贵企业已形成清晰的数字化战略",
        score: 3.6,
        level: "成熟阶段",
        sampleCount: 4,
      },
    ]);
    expect(report.charts.questionDistributions).toHaveLength(5);
    expect(report.charts.questionDistributions.map((item) => item.questionId)).toEqual([
      "q_industry",
      "q_company_size",
      "q_strategy",
      "q_data",
      "q_pain_points",
    ]);
    expect(report.sections[0]?.insights).toContain(
      "受访者最集中的转型阻碍是“缺少数字化人才”，占比 33%，需要进入管理层专项治理议题。"
    );
    expect(report.executiveSummary).toMatchObject({
      maturityScore: 3.6,
      maturityLevel: "成熟阶段",
      confidenceLabel: "方向性参考",
      recommendedFocus: "缺少数字化人才",
    });
    expect(report.methodology).toMatchObject({
      sampleSize: 5,
      validResponses: 4,
      completionRate: 80,
      averageDuration: "7分55秒",
    });
    expect(report.methodology.limitations).toContain(
      "样本量低于 30 份，建议将结论定位为方向性诊断，并通过访谈或追加样本复核。"
    );
    expect(report.diagnostics.narratives[0]).toMatchObject({
      key: "digital_maturity",
      score: 3.6,
      level: "成熟阶段",
    });
    expect(report.consultingFindings.map((item) => item.title)).toEqual([
      "成熟度判断",
      "核心短板",
      "主要阻碍",
      "样本画像",
    ]);
    expect(report.priorityMatrix[0]).toMatchObject({
      category: "转型阻碍",
      label: "缺少数字化人才",
      priority: "P1",
    });
    expect(report.actionPlan.map((item) => item.phase)).toEqual(["30天", "60天", "90天"]);
    expect(report.chapters.map((chapter) => chapter.title)).toEqual([
      "一、管理层摘要",
      "二、样本与方法说明",
      "三、核心诊断",
      "四、关键风险与机会",
      "五、行动路线",
    ]);
    expect(report.chapters[0]?.evidence.length).toBeGreaterThan(1);
    expect(report.chapters[4]?.recommendations[0]).toContain("衡量指标");
  });
});
