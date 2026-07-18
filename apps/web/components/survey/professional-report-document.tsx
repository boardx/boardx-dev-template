"use client";

import type { ProfessionalSurveyReportDocument } from "@/lib/survey-professional-report";

function confidenceLabel(confidence: ProfessionalSurveyReportDocument["methodology"]["confidence"]) {
  return { none: "无数据", low: "方向性", medium: "中等", high: "较高" }[confidence];
}

export function ProfessionalReportDocument({ report }: { report: ProfessionalSurveyReportDocument }) {
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
            <section key={chapter.id} className="break-inside-avoid border-b border-border px-8 py-8">
              <p className="text-11 font-semibold text-muted-foreground">{String(index + 2).padStart(2, "0")} / 分题分析</p>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-22 font-bold">{chapter.title}</h2>
                <p className="text-12 text-muted-foreground">有效回答 n={chapter.validResponseCount}</p>
              </div>
              {chapter.chart ? (
                <div className="mt-6 grid gap-3" data-testid={`professional-chart-${chapter.questionId}`}>
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
