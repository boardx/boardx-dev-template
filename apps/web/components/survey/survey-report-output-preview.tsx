"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import * as echarts from "echarts/core";
import {
  BarChart,
  FunnelChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  PieChart,
  RadarChart,
  ScatterChart,
} from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  RadarComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { BarChart3, Check, Copy, FileText, ImageIcon } from "lucide-react";
import type { SurveyReportCategoryInput } from "@repo/data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSurveyReportChartTemplate } from "@/lib/survey-report-chart-templates";

echarts.use([
  BarChart,
  FunnelChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  PieChart,
  RadarChart,
  ScatterChart,
  GridComponent,
  LegendComponent,
  RadarComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

interface SurveyReportOutputPreviewProps {
  category: SurveyReportCategoryInput;
  responseCount: number;
}

function EChartsOptionCanvas({ option }: { option: Record<string, unknown> }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const instance = echarts.init(container, undefined, { renderer: "canvas" });
    instance.setOption(option, true);
    const resizeObserver = new ResizeObserver(() => instance.resize());
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      instance.dispose();
    };
  }, [option]);

  return (
    <div
      ref={containerRef}
      data-testid="report-chart-canvas"
      className="h-80 min-h-80 w-full"
      role="img"
      aria-label="章节图表配置预览"
    />
  );
}

function PreviewBoundary({ responseCount }: { responseCount: number }) {
  return (
    <div className="border-l-2 border-foreground bg-secondary/50 px-4 py-3">
      <p className="text-12 font-semibold text-foreground">数据与证据边界</p>
      <p className="mt-1 text-12 leading-5 text-muted-foreground">
        生成时从整份问卷与全部授权答卷中检索证据。当前事实库包含 {responseCount} 份答卷。
      </p>
    </div>
  );
}

function ChartOutputPreview({
  category,
  responseCount,
}: SurveyReportOutputPreviewProps) {
  const [view, setView] = useState<"preview" | "json">("preview");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const template = getSurveyReportChartTemplate(
    category.chartTemplateId ?? "line-simple"
  );
  const optionJson = JSON.stringify(template.option, null, 2);

  async function copyOption() {
    try {
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(optionJson);
      setCopied(true);
      setCopyError("");
    } catch {
      setCopied(false);
      setCopyError("复制失败，请检查浏览器剪贴板权限。");
    }
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const nextView = view === "preview" ? "json" : "preview";
    setView(nextView);
    const target = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(
      `[data-report-preview-tab="${nextView}"]`
    );
    target?.focus();
  }

  return (
    <div className="grid min-w-0 gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-11 font-semibold text-muted-foreground">图表配置草稿</p>
          <h4 className="mt-1 text-17 font-bold text-foreground">{category.name}</h4>
          <p className="mt-1 text-12 text-muted-foreground">{template.label}</p>
        </div>
        <Badge variant="outline">预览数据</Badge>
      </div>

      <div
        role="tablist"
        aria-label="图表预览方式"
        className="grid grid-cols-2 border border-border bg-secondary/30 p-1"
      >
        <Button
          type="button"
          size="sm"
          variant={view === "preview" ? "default" : "ghost"}
          role="tab"
          aria-selected={view === "preview"}
          aria-controls="report-chart-preview-panel"
          tabIndex={view === "preview" ? 0 : -1}
          data-report-preview-tab="preview"
          className="rounded-md"
          onClick={() => setView("preview")}
          onKeyDown={handleTabKeyDown}
        >
          效果预览
        </Button>
        <Button
          type="button"
          size="sm"
          variant={view === "json" ? "default" : "ghost"}
          role="tab"
          aria-selected={view === "json"}
          aria-controls="report-chart-json-panel"
          tabIndex={view === "json" ? 0 : -1}
          data-report-preview-tab="json"
          className="rounded-md"
          onClick={() => setView("json")}
          onKeyDown={handleTabKeyDown}
        >
          Option JSON
        </Button>
      </div>

      {view === "preview" ? (
        <div
          id="report-chart-preview-panel"
          role="tabpanel"
          className="min-w-0 overflow-hidden border border-border bg-background p-3"
        >
          <EChartsOptionCanvas option={template.option} />
        </div>
      ) : (
        <div
          id="report-chart-json-panel"
          role="tabpanel"
          className="min-w-0 overflow-hidden border border-border bg-background"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
            <p className="text-12 font-semibold text-foreground">完整只读 Option</p>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              aria-label={copied ? "Option JSON 已复制" : "复制 Option JSON"}
              onClick={() => void copyOption()}
            >
              {copied
                ? <Check className="h-4 w-4" strokeWidth={1.7} />
                : <Copy className="h-4 w-4" strokeWidth={1.7} />}
            </Button>
          </div>
          <div className="max-h-96 overflow-auto">
            <pre
              data-testid="report-chart-option-json"
              className="min-w-max whitespace-pre p-4 font-mono text-11 leading-5 text-foreground"
            >
              {optionJson}
            </pre>
          </div>
          <p aria-live="polite" className={copyError ? "px-3 pb-3 text-11 text-destructive" : "sr-only"}>
            {copyError || (copied ? "Option JSON 已复制" : "")}
          </p>
        </div>
      )}

      <PreviewBoundary responseCount={responseCount} />
      <p className="text-11 leading-5 text-muted-foreground">
        当前图形使用模板内的模拟数据，仅用于配置预览，不会写入报告证据或生成请求。
      </p>
    </div>
  );
}

function TextOutputPreview({
  category,
  responseCount,
}: SurveyReportOutputPreviewProps) {
  const requirement = category.requirement?.trim() || category.prompt.trim();

  return (
    <article className="grid gap-6">
      <header className="border-b border-border pb-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-11 font-semibold text-muted-foreground">文本章节草稿</p>
          <Badge variant="outline">待生成</Badge>
        </div>
        <h4 className="mt-3 text-20 font-bold text-foreground">{category.name}</h4>
        <p className="mt-3 text-13 leading-6 text-foreground">
          {requirement || "尚未填写本章文本要求。"}
        </p>
      </header>

      <PreviewBoundary responseCount={responseCount} />

      <div
        data-testid="report-output-empty"
        role="status"
        className="grid min-h-56 place-items-center border border-dashed border-border px-6 py-10 text-center"
      >
        <div>
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.4} />
          <h5 className="mt-3 text-14 font-bold text-foreground">生成报告后显示章节文本</h5>
          <p className="mx-auto mt-2 max-w-sm text-12 leading-5 text-muted-foreground">
            结论、支持证据、限制条件和建议只会来自已生成的不可变报告版本。
          </p>
        </div>
      </div>
    </article>
  );
}

function ImageOutputPreview({
  category,
  responseCount,
}: SurveyReportOutputPreviewProps) {
  const requirement = category.requirement?.trim() || category.prompt.trim();

  return (
    <article className="grid gap-6">
      <header>
        <div className="flex items-center justify-between gap-3">
          <p className="text-11 font-semibold text-muted-foreground">图片章节草稿</p>
          <Badge variant="outline">待生成</Badge>
        </div>
        <h4 className="mt-3 text-20 font-bold text-foreground">{category.name}</h4>
        <p className="mt-3 text-13 leading-6 text-foreground">
          {requirement || "尚未填写本章图片要求。"}
        </p>
      </header>

      <PreviewBoundary responseCount={responseCount} />

      <div
        data-testid="report-output-empty"
        role="status"
        className="grid min-h-64 place-items-center border border-dashed border-border px-6 py-10 text-center"
      >
        <div>
          <ImageIcon className="mx-auto h-9 w-9 text-muted-foreground" strokeWidth={1.4} />
          <h5 className="mt-3 text-14 font-bold text-foreground">生成报告后显示图片</h5>
          <p className="mx-auto mt-2 max-w-sm text-12 leading-5 text-muted-foreground">
            当前不展示占位素材；真实图片将在报告版本成功生成后出现。
          </p>
        </div>
      </div>
    </article>
  );
}

export function SurveyReportOutputPreview(
  props: SurveyReportOutputPreviewProps
) {
  if (props.category.outputType === "chart") {
    return <ChartOutputPreview {...props} />;
  }
  if (props.category.outputType === "image") {
    return <ImageOutputPreview {...props} />;
  }
  return <TextOutputPreview {...props} />;
}
