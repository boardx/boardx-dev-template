"use client";

import { useState } from "react";
import { Download, Link2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfessionalReportDocument } from "./professional-report-document";
import { SurveyReportVersionHistory } from "./survey-report-version-history";
import type { SurveyReportGenerationStatus } from "@/lib/survey-report-generation";
import {
  isTemplateDrivenSurveyReport,
  type SurveyReportDocument,
} from "@/lib/survey-report-document";

interface SurveyProfessionalReportWorkbenchProps {
  report: SurveyReportDocument;
  generation?: SurveyReportGenerationStatus;
  generating: boolean;
  error: string;
  onGenerateReport: () => void;
  onSelectVersion: (artifactId: string) => Promise<boolean>;
  onLoadMoreVersions: () => Promise<boolean>;
  onExportPdf: () => void;
  onExportWord: () => void;
}

function formatGeneratedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SurveyProfessionalReportWorkbench({
  report,
  generation,
  generating,
  error,
  onGenerateReport,
  onSelectVersion,
  onLoadMoreVersions,
  onExportPdf,
  onExportWord,
}: SurveyProfessionalReportWorkbenchProps) {
  const [shareStatus, setShareStatus] = useState("");
  const responseCount = isTemplateDrivenSurveyReport(report)
    ? report.sample.responseCount
    : report.methodology.sampleSize;
  const currentResponseCount =
    generation?.currentResponseCount ?? responseCount;
  const canGenerate = currentResponseCount > 0;
  const chapterCount = report.chapters.length;

  async function shareReport() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareStatus("报告链接已复制");
    } catch {
      setShareStatus("无法复制链接，请使用浏览器地址栏");
    }
  }

  return (
    <div
      data-testid="survey-professional-report-workbench"
      className="min-w-0 bg-secondary/30"
    >
      <header className="border-b border-border bg-background px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-11 font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Analysis Report
              </p>
              <span className="rounded-full bg-success/10 px-2 py-0.5 text-11 font-semibold text-success">
                {report.status === "ready"
                  ? "已生成"
                  : report.status === "directional"
                    ? "方向性"
                    : "无数据"}
              </span>
            </div>
            <h2 className="mt-1 text-20 font-bold text-foreground">
              {report.title}
            </h2>
            <p className="mt-1 text-12 text-muted-foreground">
              {responseCount} 份有效答卷 · {chapterCount} 个模板章节 · 生成于{" "}
              {formatGeneratedAt(report.generatedAt)}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <SurveyReportVersionHistory
              generation={generation}
              report={report}
              disabled={generating}
              onSelectVersion={onSelectVersion}
              onLoadMore={onLoadMoreVersions}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-2"
              onClick={() => void shareReport()}
            >
              <Link2 className="h-4 w-4" strokeWidth={1.6} />
              分享
            </Button>
            <div className="flex items-center rounded-md border border-border bg-background">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 rounded-r-none px-3"
                onClick={onExportPdf}
              >
                <Download className="h-4 w-4" strokeWidth={1.6} />
                PDF
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 rounded-l-none border-l border-border px-3"
                onClick={onExportWord}
              >
                Word
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={generating || !canGenerate}
              onClick={onGenerateReport}
              aria-describedby={
                canGenerate ? undefined : "report-generation-empty-state"
              }
              className="h-9 gap-2 bg-foreground px-3 text-background transition-colors duration-200 hover:bg-foreground/90"
            >
              <Sparkles className="h-4 w-4" strokeWidth={1.6} />
              {generating ? "生成中" : "重新生成"}
            </Button>
          </div>
        </div>
        {shareStatus ? (
          <p role="status" className="mx-auto mt-2 max-w-6xl text-right text-11 text-muted-foreground">
            {shareStatus}
          </p>
        ) : null}
      </header>

      {!canGenerate ? (
        <div
          id="report-generation-empty-state"
          data-testid="report-generation-empty-state"
          role="status"
          className="mx-auto mt-4 max-w-5xl border border-border bg-background px-4 py-3"
        >
          <p className="text-13 font-semibold text-foreground">
            收到至少 1 份有效答卷后可生成报告
          </p>
          <p className="mt-1 text-12 text-muted-foreground">
            请先发布问卷并回收答卷。现有报告版本会保留，系统不会使用模拟数据生成结论。
          </p>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mx-auto mt-4 max-w-6xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-13 text-destructive"
        >
          {error}
        </p>
      ) : null}

      <main
        data-testid="professional-report-reading-surface"
        className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6"
      >
        <div className="min-w-0 overflow-hidden border border-border bg-background shadow-sm">
          <ProfessionalReportDocument report={report} />
        </div>
      </main>
    </div>
  );
}
