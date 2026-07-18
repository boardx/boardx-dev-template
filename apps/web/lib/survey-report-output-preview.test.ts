import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type {
  SurveyReportCategoryInput,
  SurveyReportChartTemplateId,
} from "@repo/data";
import { SurveyReportOutputPreview } from "@/components/survey/survey-report-output-preview";

vi.stubGlobal("React", React);

function chartCategory(
  chartTemplateId: SurveyReportChartTemplateId
): SurveyReportCategoryInput {
  return {
    id: "summary",
    name: "核心结论",
    description: "总结主要发现",
    requirement: "使用真实答卷展示主要趋势。",
    questionIds: [],
    outputType: "chart",
    inputModes: ["chart"],
    chartTemplateId,
    prompt: "使用真实答卷展示主要趋势。",
    order: 1,
    isCustom: false,
  };
}

function renderPreview(category: SurveyReportCategoryInput) {
  return renderToStaticMarkup(
    React.createElement(SurveyReportOutputPreview, {
      category,
      responseCount: 12,
    })
  );
}

describe("SurveyReportOutputPreview", () => {
  it("renders a recoverable validation error for an invalid chart template", () => {
    const category = chartCategory(
      "not-allowlisted" as SurveyReportChartTemplateId
    );

    expect(() => renderPreview(category)).not.toThrow();

    const markup = renderPreview(category);
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("图表模板无效");
    expect(markup).toContain("请重新选择图表模板");
  });

  it("keeps the normal allowlisted chart preview path unchanged", () => {
    const markup = renderPreview(chartCategory("line-simple"));

    expect(markup).toContain("Simple line");
    expect(markup).toContain('data-testid="report-chart-canvas"');
    expect(markup).not.toContain("图表模板无效");
  });
});
