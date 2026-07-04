"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Download, FileText, RefreshCw, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type QType = "text" | "single" | "multiple" | "rating";

interface Question {
  id: number;
  title: string;
  type: QType;
  required: boolean;
  options: string[];
}

interface OptionCount {
  option: string;
  count: number;
}

interface QuestionSummary {
  id: number;
  title: string;
  type: QType;
  required: boolean;
  answeredCount: number;
  skippedCount: number;
  optionCounts?: OptionCount[];
  average?: number;
  textAnswers?: string[];
}

interface ResponseItem {
  id: number;
  submittedAt: string;
  respondentUserId: number | null;
  answers: Record<string, unknown>;
}

interface ResultsPayload {
  survey: { id: number; title: string; description: string; status: "active" | "paused"; questions: Question[] };
  totalResponses: number;
  averageCompletion: number;
  summary: QuestionSummary[];
  responses: ResponseItem[];
}

type Tab = "summary" | "individual" | "report";

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function answerText(question: Question, value: unknown): string {
  if (value == null) return "—";
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "—";
  const s = String(value).trim();
  return s.length > 0 ? s : "—";
}

function OptionBars({ counts, total }: { counts: OptionCount[]; total: number }) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      {counts.map((c) => {
        const pct = total > 0 ? Math.round((c.count / total) * 100) : 0;
        return (
          <div key={c.option} data-testid="option-row" className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-12 text-foreground">{c.option}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-16 shrink-0 text-right text-12 text-muted-foreground">
              {c.count} ({pct}%)
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function SurveyResultsPage() {
  const params = useParams<{ id: string }>();
  const surveyId = params.id;

  const [data, setData] = useState<ResultsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [tab, setTab] = useState<Tab>("summary");
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [exportError, setExportError] = useState("");

  // uc-survey-007 — AI 摘要不持久化：每次进入/切换问卷都重置，只在当前会话内存在。
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryText, setAiSummaryText] = useState("");
  const [aiSummaryError, setAiSummaryError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    setForbidden(false);
    try {
      const res = await fetch(`/api/surveys/${surveyId}/results`);
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (res.status === 403 || res.status === 404) {
        setForbidden(true);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError("加载报告失败，请重试");
        setLoading(false);
        return;
      }
      setData(await res.json());
    } catch {
      setError("加载报告失败，请重试");
    }
    setLoading(false);
  }

  useEffect(() => {
    // code review 加固：surveyId 变化时必须清空上一份问卷生成的 AI 摘要状态。若某次导航
    // 复用了同一个组件实例（不重新挂载，只有这个 effect 的依赖 surveyId 变化），不重置就
    // 会把上一份问卷的摘要文本/失败态误展示成当前问卷的内容——本文件上面的注释早已声明
    // "每次进入/切换问卷都重置"，但重置逻辑此前没有真正写出来。这里的重置对硬导航
    // （组件本就会重新挂载，state 已是初始值）没有副作用，成本几乎为零，是纯防御性写法。
    setAiSummaryLoading(false);
    setAiSummaryText("");
    setAiSummaryError("");
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyId]);

  async function exportCsv() {
    setExporting("csv");
    setExportError("");
    try {
      const res = await fetch(`/api/surveys/${surveyId}/results/export`);
      if (!res.ok) {
        setExportError("导出失败，请重试");
        setExporting(null);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `survey-${surveyId}-responses.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("导出失败，请重试");
    }
    setExporting(null);
  }

  async function generateAiSummary() {
    setAiSummaryLoading(true);
    setAiSummaryError("");
    try {
      const res = await fetch(`/api/surveys/${surveyId}/results/ai-summary`, { method: "POST" });
      if (!res.ok) {
        setAiSummaryError("生成摘要失败，请重试");
        setAiSummaryLoading(false);
        return;
      }
      const body = await res.json();
      setAiSummaryText(String(body.text ?? ""));
    } catch {
      setAiSummaryError("生成摘要失败，请重试");
    }
    setAiSummaryLoading(false);
  }

  function exportPdf() {
    setExporting("pdf");
    setExportError("");
    setTab("report");
    // Report 视图为打印优化布局；浏览器原生打印到 PDF，无需额外依赖。
    window.setTimeout(() => {
      window.print();
      setExporting(null);
    }, 50);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-content px-9 pb-14 pt-7">
        <div data-testid="results-loading" className="mt-5 grid animate-pulse gap-3">
          <div className="h-8 w-1/2 rounded-lg bg-muted" />
          <div className="h-32 rounded-12 border border-border bg-muted/40" />
          <div className="h-32 rounded-12 border border-border bg-muted/40" />
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="mx-auto max-w-content px-9 pb-14 pt-7">
        <Link href="/surveys" className="inline-flex items-center gap-1 text-13 text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          Surveys
        </Link>
        <div data-testid="results-forbidden" className="mt-6 rounded-12 border border-dashed border-border-strong px-6 py-15 text-center">
          <p className="text-15 font-semibold text-foreground">You do not have access to this report</p>
          <p className="mt-2 text-13 text-muted-foreground">Only the survey creator or team members can view responses.</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-content px-9 pb-14 pt-7">
        <p role="alert" data-testid="err-results" className="text-13 text-destructive">
          {error}
        </p>
        <Button data-testid="retry-results" size="sm" variant="outline" className="mt-3 gap-1.5" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
          Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const { survey, totalResponses, averageCompletion, summary, responses } = data;

  return (
    <div className="mx-auto max-w-content px-9 pb-14 pt-7 print:px-0 print:pt-0">
      <div className="flex items-center gap-3 print:hidden">
        <Link href="/surveys" className="inline-flex items-center gap-1 text-13 text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          Surveys
        </Link>
        <div className="flex-1" />
        <Button data-testid="export-csv" variant="outline" size="sm" disabled={exporting !== null} onClick={() => void exportCsv()} className="gap-1.5">
          <Download className="h-4 w-4" strokeWidth={1.5} />
          {exporting === "csv" ? "Exporting…" : "Export CSV"}
        </Button>
        <Button data-testid="export-pdf" variant="outline" size="sm" disabled={exporting !== null} onClick={exportPdf} className="gap-1.5">
          <FileText className="h-4 w-4" strokeWidth={1.5} />
          {exporting === "pdf" ? "Preparing…" : "Export PDF"}
        </Button>
      </div>

      {exportError && (
        <div className="mt-3 flex items-center gap-3 print:hidden">
          <p role="alert" data-testid="err-export" className="text-13 text-destructive">
            {exportError}
          </p>
          <Button data-testid="retry-export" size="sm" variant="outline" onClick={() => void exportCsv()}>
            Retry
          </Button>
        </div>
      )}

      <header className="mt-5">
        <h1 data-testid="results-title" className="text-26 font-bold tracking-tight text-foreground">
          {survey.title}
        </h1>
        {survey.description && <p className="mt-1 text-13 text-muted-foreground">{survey.description}</p>}
        <div className="mt-3 flex items-center gap-3">
          <Badge variant={survey.status === "active" ? "success" : "muted"}>{survey.status === "active" ? "Active" : "Paused"}</Badge>
          <span data-testid="results-total" className="flex items-center gap-1.5 text-13 text-muted-foreground">
            <Users className="h-4 w-4" strokeWidth={1.5} />
            {totalResponses} responses collected
          </span>
        </div>
      </header>

      {totalResponses === 0 ? (
        <div data-testid="results-empty" className="mt-8 rounded-12 border border-dashed border-border-strong px-6 py-15 text-center">
          <p className="text-15 font-semibold text-foreground">No responses yet</p>
          <p className="mt-2 text-13 text-muted-foreground">Share the survey link to start collecting answers.</p>
          <div data-testid="report-ai-summary" className="mt-5 flex flex-col items-center gap-2">
            <Button data-testid="report-ai-summary-generate" size="sm" variant="outline" disabled className="gap-1.5">
              <Sparkles className="h-4 w-4" strokeWidth={1.5} />
              Generate summary
            </Button>
            <p className="text-12 text-muted-foreground">Collect at least one response before generating an AI summary.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6 flex items-center gap-2 print:hidden" role="tablist" aria-label="Results view">
            <Button data-testid="tab-summary" size="sm" variant={tab === "summary" ? "default" : "outline"} onClick={() => setTab("summary")}>
              Summary
            </Button>
            <Button data-testid="tab-individual" size="sm" variant={tab === "individual" ? "default" : "outline"} onClick={() => setTab("individual")}>
              Individual
            </Button>
            <Button data-testid="tab-report" size="sm" variant={tab === "report" ? "default" : "outline"} onClick={() => setTab("report")}>
              Report
            </Button>
          </div>

          {tab === "summary" && (
            <section data-testid="summary-view" className="mt-6 flex flex-col gap-4 print:hidden">
              {summary.map((q) => (
                <div key={q.id} data-testid={`summary-question-${q.id}`} className="rounded-12 border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-14 font-semibold text-foreground">{q.title}</p>
                    <span data-testid={`summary-answered-${q.id}`} className="shrink-0 text-12 text-muted-foreground">
                      {q.answeredCount} answered · {q.skippedCount} skipped
                    </span>
                  </div>

                  {(q.type === "single" || q.type === "multiple" || q.type === "rating") && q.optionCounts && (
                    <OptionBars counts={q.optionCounts} total={q.answeredCount} />
                  )}

                  {q.type === "rating" && (
                    <p data-testid={`summary-average-${q.id}`} className="mt-2 text-13 text-muted-foreground">
                      Average rating: <span className="font-semibold text-foreground">{q.average}</span> / 5
                    </p>
                  )}

                  {q.type === "text" && (
                    <div className="mt-3 flex flex-col gap-1.5">
                      {(q.textAnswers ?? []).length === 0 ? (
                        <p className="text-12 text-muted-foreground">No answers yet.</p>
                      ) : (
                        (q.textAnswers ?? []).slice(0, 5).map((t, idx) => (
                          <p key={idx} className="truncate rounded-lg border border-border bg-background px-3 py-1.5 text-12 text-foreground">
                            {t}
                          </p>
                        ))
                      )}
                      {(q.textAnswers ?? []).length > 5 && (
                        <p className="text-11 text-muted-foreground">+{(q.textAnswers ?? []).length - 5} more in Individual view</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          {tab === "individual" && (
            <section data-testid="individual-view" className="mt-6 flex flex-col gap-4 print:hidden">
              {responses.map((r, idx) => (
                <div key={r.id} data-testid={`response-${r.id}`} className="rounded-12 border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-13 font-semibold text-foreground">Response #{idx + 1}</p>
                    <span className="text-12 text-muted-foreground">{formatDate(r.submittedAt)}</span>
                  </div>
                  <div className="mt-3 flex flex-col gap-2">
                    {survey.questions.map((q) => (
                      <div key={q.id} className="text-12">
                        <p className="text-muted-foreground">{q.title}</p>
                        <p data-testid={`response-${r.id}-answer-${q.id}`} className="mt-0.5 font-medium text-foreground">
                          {answerText(q, r.answers[String(q.id)])}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {tab === "report" && (
            <section data-testid="report-view" className="mt-6 flex flex-col gap-5">
              <div className="rounded-12 border border-border bg-card p-5 print:border-0 print:p-0">
                <h2 className="text-18 font-bold text-foreground">Report: {survey.title}</h2>
                <p className="mt-1 text-13 text-muted-foreground">Generated {formatDate(new Date().toISOString())}</p>
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-12 text-muted-foreground">Total responses</p>
                    <p data-testid="report-total" className="text-20 font-bold text-foreground">{totalResponses}</p>
                  </div>
                  <div>
                    <p className="text-12 text-muted-foreground">Avg. completion</p>
                    <p data-testid="report-completion" className="text-20 font-bold text-foreground">{averageCompletion}%</p>
                  </div>
                  <div>
                    <p className="text-12 text-muted-foreground">Questions</p>
                    <p className="text-20 font-bold text-foreground">{survey.questions.length}</p>
                  </div>
                </div>
              </div>

              <div data-testid="report-ai-summary" className="rounded-12 border border-border bg-card p-5 print:break-inside-avoid">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" strokeWidth={1.5} />
                    <h3 className="text-14 font-semibold text-foreground">AI Summary</h3>
                  </div>
                  <Button
                    data-testid="report-ai-summary-generate"
                    size="sm"
                    variant="outline"
                    disabled={totalResponses === 0 || aiSummaryLoading}
                    onClick={() => void generateAiSummary()}
                    className="gap-1.5 print:hidden"
                  >
                    <Sparkles className="h-4 w-4" strokeWidth={1.5} />
                    {aiSummaryLoading ? "Generating…" : aiSummaryText || aiSummaryError ? "Regenerate" : "Generate summary"}
                  </Button>
                </div>

                {aiSummaryLoading && (
                  <div data-testid="report-ai-summary-loading" className="mt-3 grid animate-pulse gap-2">
                    <div className="h-3 w-full rounded bg-muted" />
                    <div className="h-3 w-5/6 rounded bg-muted" />
                    <div className="h-3 w-2/3 rounded bg-muted" />
                  </div>
                )}

                {!aiSummaryLoading && aiSummaryError && (
                  <div className="mt-3 flex items-center gap-3">
                    <p role="alert" data-testid="err-report-ai-summary" className="text-13 text-destructive">
                      {aiSummaryError}
                    </p>
                    <Button
                      data-testid="retry-report-ai-summary"
                      size="sm"
                      variant="outline"
                      className="print:hidden"
                      onClick={() => void generateAiSummary()}
                    >
                      Retry
                    </Button>
                  </div>
                )}

                {!aiSummaryLoading && !aiSummaryError && aiSummaryText && (
                  <p data-testid="report-ai-summary-text" className="mt-3 text-13 leading-relaxed text-foreground">
                    {aiSummaryText}
                  </p>
                )}

                {!aiSummaryLoading && !aiSummaryError && !aiSummaryText && (
                  <p className="mt-3 text-13 text-muted-foreground">
                    {totalResponses === 0
                      ? "Collect at least one response before generating an AI summary."
                      : "Click Generate summary to get an AI-written overview of this report."}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-4">
                {summary.map((q) => (
                  <div key={q.id} data-testid={`report-question-${q.id}`} className="rounded-12 border border-border p-4 print:break-inside-avoid">
                    <p className="text-14 font-semibold text-foreground">{q.title}</p>
                    <p className="mt-1 text-12 text-muted-foreground">{q.answeredCount} answered · {q.skippedCount} skipped</p>
                    {(q.type === "single" || q.type === "multiple" || q.type === "rating") && q.optionCounts && (
                      <OptionBars counts={q.optionCounts} total={q.answeredCount} />
                    )}
                    {q.type === "rating" && <p className="mt-2 text-13 text-muted-foreground">Average rating: {q.average} / 5</p>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
