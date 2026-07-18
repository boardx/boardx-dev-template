"use client";

import Image from "next/image";
import type { ProfessionalSurveyReportDocument } from "@/lib/survey-professional-report";
import {
  isTemplateDrivenSurveyReport,
  type SurveyReportDocument,
} from "@/lib/survey-report-document";
import type { PublicTemplateDrivenSurveyReport } from "@/lib/survey-template-report";
import { SurveyEChartsCanvas } from "@/components/survey/survey-echarts-canvas";

function confidenceLabel(confidence: ProfessionalSurveyReportDocument["methodology"]["confidence"]) {
  return { none: "无数据", low: "方向性", medium: "中等", high: "较高" }[confidence];
}

function LegacyProfessionalReportDocument({ report }: { report: ProfessionalSurveyReportDocument }) {
  return (
    <article data-testid="professional-report-document" className="bg-background text-foreground">
      <header className="border-b border-border px-8 py-10">
        <p className="text-11 font-semibold uppercase tracking-[0.16em] text-muted-foreground">Survey Research Report</p>
        <h1 className="mt-3 max-w-4xl text-30 font-bold leading-tight">{report.title}</h1>
        <div className="mt-8 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-3">
          {[
            ["有效样本", `${report.methodology.sampleSize} 份`],
            ["问题数量", `${report.methodology.questionCount} 题`],
            ["结论强度", confidenceLabel(report.methodology.confidence)],
          ].map(([label, value]) => (
            <div key={label} className="bg-background px-4 py-3">
              <p className="text-11 text-muted-foreground">{label}</p>
              <p className="mt-1 text-18 font-bold">{value}</p>
            </div>
          ))}
        </div>
      </header>

      {report.emptyState ? (
        <section className="px-8 py-16 text-center">
          <h2 className="text-20 font-bold">暂无真实答卷</h2>
          <p className="mx-auto mt-3 max-w-xl text-14 leading-6 text-muted-foreground">{report.emptyState}</p>
          <p className="mx-auto mt-2 max-w-xl text-12 text-muted-foreground">报告模板已经保留，收到答卷后将按题目独立生成图表和证据化结论。</p>
        </section>
      ) : (
        <>
          <section className="border-b border-border px-8 py-8">
            <p className="text-11 font-semibold text-muted-foreground">01 / 执行摘要</p>
            <h2 className="mt-2 text-22 font-bold">关键发现</h2>
            <div className="mt-5 grid gap-4">
              {report.executiveSummary.claims.map((claim) => (
                <div key={claim.id} className="grid gap-2 border-l-2 border-foreground pl-4 lg:grid-cols-[minmax(0,1fr)_180px]">
                  <div>
                    <p className="text-15 font-semibold leading-6">{claim.statement}</p>
                    {claim.implication ? <p className="mt-1 text-13 leading-6 text-muted-foreground">{claim.implication}</p> : null}
                  </div>
                  <p className="text-12 text-muted-foreground">证据：{claim.value}/{claim.denominator}{claim.directional ? " · 方向性" : ""}</p>
                </div>
              ))}
            </div>
          </section>

          {report.chapters.map((chapter, index) => (
            <section
              key={chapter.id}
              data-testid={`professional-report-chapter-${chapter.categoryId ?? chapter.id}`}
              data-output-type={chapter.outputType ?? "text"}
              className="break-inside-avoid border-b border-border px-8 py-8"
            >
              <p className="text-11 font-semibold text-muted-foreground">
                {String(index + 2).padStart(2, "0")} / {
                  chapter.outputType === "chart"
                    ? "图表章节"
                    : chapter.outputType === "image"
                      ? "图片章节"
                      : "文本章节"
                }
              </p>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-22 font-bold">{chapter.title}</h2>
                <p className="text-12 text-muted-foreground">有效回答 n={chapter.validResponseCount}</p>
              </div>
              {chapter.requirement ? (
                <p className="mt-3 text-12 leading-5 text-muted-foreground">
                  生成要求：{chapter.requirement}
                </p>
              ) : null}
              {chapter.outputType === "chart" && chapter.chart ? (
                <div className="mt-6 grid gap-3" data-testid={`professional-chart-${chapter.questionId}`}>
                  {chapter.chartTemplateId ? (
                    <p className="text-11 font-semibold text-muted-foreground">
                      ECharts 模板：{chapter.chartTemplateId}
                    </p>
                  ) : null}
                  {chapter.chart.option ? (
                    <SurveyEChartsCanvas
                      option={chapter.chart.option}
                      testId={`professional-echarts-${chapter.categoryId ?? chapter.id}`}
                      ariaLabel={`${chapter.title} 正式报告图表`}
                      className="h-96 min-h-96 w-full"
                    />
                  ) : null}
                  {chapter.chart.rows.map((row) => (
                    <div key={row.label} className="grid grid-cols-[120px_minmax(120px,1fr)_88px] items-center gap-3 text-12">
                      <span className="truncate">{row.label}</span>
                      <span className="h-3 overflow-hidden bg-muted">
                        <span className="block h-full bg-foreground" style={{ width: `${row.percentage}%` }} />
                      </span>
                      <strong className="text-right">{row.count} · {row.percentage}%</strong>
                    </div>
                  ))}
                  <p className="border-t border-border pt-2 text-11 text-muted-foreground">口径：{chapter.chart.denominatorLabel} n={chapter.chart.denominator}</p>
                </div>
              ) : null}
              {chapter.outputType === "image" && chapter.imagePrompt ? (
                <div
                  data-testid={`professional-image-requirement-${chapter.categoryId ?? chapter.id}`}
                  className="mt-6 border-l-2 border-foreground bg-secondary/40 px-4 py-3"
                >
                  <p className="text-12 font-semibold">图片生成约束</p>
                  <p className="mt-1 text-13 leading-6 text-muted-foreground">
                    {chapter.imagePrompt}
                  </p>
                </div>
              ) : null}
              {chapter.claims.map((claim) => <p key={claim.id} className="mt-5 text-14 leading-7"><strong>结论：</strong>{claim.statement}</p>)}
              {chapter.limitations.length ? <p className="mt-4 text-12 leading-5 text-muted-foreground">限制：{chapter.limitations.join(" ")}</p> : null}
            </section>
          ))}
        </>
      )}

      <section className="grid gap-6 px-8 py-8 lg:grid-cols-2">
        <div>
          <p className="text-11 font-semibold text-muted-foreground">方法与口径</p>
          <h2 className="mt-2 text-18 font-bold">研究方法</h2>
          <p className="mt-3 text-13 leading-6 text-muted-foreground">{report.methodology.statement}</p>
        </div>
        <div>
          <p className="text-11 font-semibold text-muted-foreground">限制条件</p>
          <h2 className="mt-2 text-18 font-bold">解读边界</h2>
          <ul className="mt-3 grid gap-2 text-13 leading-6 text-muted-foreground">
            {(report.limitations.length ? report.limitations : ["未识别额外样本限制。"]).map((limitation) => <li key={limitation}>{limitation}</li>)}
          </ul>
        </div>
      </section>
    </article>
  );
}

function templateConfidenceLabel(
  confidence: PublicTemplateDrivenSurveyReport["sample"]["confidence"]
) {
  return {
    none: "无数据",
    low: "方向性",
    medium: "中等",
    high: "较高",
  }[confidence];
}

function TemplateDrivenReportDocument({
  report,
}: {
  report: PublicTemplateDrivenSurveyReport;
}) {
  return (
    <article
      data-testid="professional-report-document"
      data-report-schema={report.schemaVersion}
      className="bg-background text-foreground"
    >
      <header className="border-b border-border px-6 py-8 sm:px-10 sm:py-10">
        <p className="text-11 font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Survey Research Report
        </p>
        <h1 className="mt-3 max-w-4xl text-30 font-bold leading-tight">
          {report.title}
        </h1>
        {report.templateSnapshot.description ? (
          <p className="mt-3 max-w-3xl text-14 leading-6 text-muted-foreground">
            {report.templateSnapshot.description}
          </p>
        ) : null}
        <div className="mt-8 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-3">
          {[
            ["有效样本", `${report.sample.responseCount} 份`],
            ["问题数量", `${report.sample.questionCount} 题`],
            ["结论强度", templateConfidenceLabel(report.sample.confidence)],
          ].map(([label, value]) => (
            <div key={label} className="bg-background px-4 py-3">
              <p className="text-11 text-muted-foreground">{label}</p>
              <p className="mt-1 text-18 font-bold">{value}</p>
            </div>
          ))}
        </div>
      </header>

      {report.chapters.map((chapter, index) => (
        <section
          id={`report-chapter-${chapter.chapterId}`}
          key={chapter.chapterId}
          data-testid={`professional-report-chapter-${chapter.chapterId}`}
          data-output-type={chapter.outputType}
          className="scroll-mt-24 break-inside-avoid border-b border-border px-6 py-8 last:border-b-0 sm:px-10 sm:py-10"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-11 font-semibold text-muted-foreground">
                {String(index + 1).padStart(2, "0")} / {
                  chapter.outputType === "chart"
                    ? "数据图表"
                    : chapter.outputType === "image"
                      ? "研究视觉"
                      : "分析结论"
                }
              </p>
              <h2 className="mt-2 text-22 font-bold">{chapter.title}</h2>
            </div>
            {chapter.outputType === "chart" ? (
              <p className="text-12 text-muted-foreground">
                有效回答 n={chapter.sampleSize}
              </p>
            ) : null}
          </div>

          {chapter.outputType === "text" ? (
            <div className="mt-6">
              <h3 className="max-w-3xl text-18 font-bold leading-7">
                {chapter.headline}
              </h3>
              <div className="mt-4 grid max-w-3xl gap-4">
                {chapter.body.split(/\n{2,}/).filter(Boolean).map((paragraph) => (
                  <p key={paragraph} className="text-14 leading-7 text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
              </div>
              {chapter.claims.length ? (
                <div className="mt-6 grid gap-4">
                  {chapter.claims.map((claim) => (
                    <div
                      key={claim.id}
                      className="grid gap-2 border-l-2 border-foreground pl-4 lg:grid-cols-[minmax(0,1fr)_160px]"
                    >
                      <div>
                        <p className="text-14 font-semibold leading-6">
                          {claim.statement}
                        </p>
                        {claim.recommendation ? (
                          <p className="mt-1 text-13 leading-6 text-muted-foreground">
                            {claim.recommendation}
                          </p>
                        ) : null}
                      </div>
                      <p className="text-12 text-muted-foreground">
                        证据 {claim.value}/{claim.denominator}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {chapter.outputType === "chart" ? (
            <div className="mt-6" data-testid={`professional-chart-${chapter.chapterId}`}>
              <div className="aspect-[16/9] min-h-72 w-full">
                <SurveyEChartsCanvas
                  option={chapter.option}
                  testId={`professional-echarts-${chapter.chapterId}`}
                  ariaLabel={`${chapter.title}报告图表`}
                  className="h-full min-h-72 w-full"
                />
              </div>
              <p className="mt-4 max-w-3xl text-14 leading-7 text-muted-foreground">
                {chapter.interpretation}
              </p>
            </div>
          ) : null}

          {chapter.outputType === "image" ? (
            <figure
              data-testid={`professional-image-${chapter.chapterId}`}
              className="mt-6"
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-secondary">
                <Image
                  src={chapter.assetUrl}
                  alt={chapter.altText}
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
              <figcaption className="mt-3 text-12 leading-5 text-muted-foreground">
                {chapter.caption}
              </figcaption>
            </figure>
          ) : null}

          {chapter.limitations.length ? (
            <p className="mt-6 border-t border-border pt-4 text-12 leading-5 text-muted-foreground">
              解读限制：{chapter.limitations.join(" ")}
            </p>
          ) : null}
        </section>
      ))}
    </article>
  );
}

export function ProfessionalReportDocument({
  report,
}: {
  report: SurveyReportDocument;
}) {
  return isTemplateDrivenSurveyReport(report)
    ? <TemplateDrivenReportDocument report={report} />
    : <LegacyProfessionalReportDocument report={report} />;
}
