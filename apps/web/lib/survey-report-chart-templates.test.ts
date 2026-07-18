import { describe, expect, it } from "vitest";
import {
  getSurveyReportChartTemplate,
  stringifySurveyReportChartOption,
  SURVEY_REPORT_CHART_TEMPLATES,
} from "./survey-report-chart-templates";

describe("survey report chart templates", () => {
  it("keeps the official line-simple option shape", () => {
    expect(getSurveyReportChartTemplate("line-simple").option).toEqual({
      xAxis: {
        type: "category",
        data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      },
      yAxis: { type: "value" },
      series: [{
        data: [150, 230, 224, 218, 135, 147, 260],
        type: "line",
      }],
    });
  });

  it("only exposes serializable allowlisted options", () => {
    expect(SURVEY_REPORT_CHART_TEMPLATES).toHaveLength(8);
    for (const template of SURVEY_REPORT_CHART_TEMPLATES) {
      const json = JSON.stringify(template.option);
      expect(json).not.toContain("function");
      expect(json).not.toContain("http://");
      expect(json).not.toContain("https://");
      expect(JSON.parse(json)).toEqual(template.option);
    }
  });

  it("links every template to its official Chinese editor example", () => {
    for (const template of SURVEY_REPORT_CHART_TEMPLATES) {
      expect(template.sourceUrl).toBe(
        `https://echarts.apache.org/examples/zh/editor.html?c=${template.id}`,
      );
    }
  });

  it("stringifies a template option as JSON", () => {
    expect(JSON.parse(stringifySurveyReportChartOption("line-simple"))).toEqual(
      getSurveyReportChartTemplate("line-simple").option,
    );
  });
});
