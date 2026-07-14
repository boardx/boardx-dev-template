"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, ChevronLeft, Download, FileText, ListChecks, PieChart, RefreshCw, Sparkles, Target, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type QuestionType =
  | "short_text"
  | "text"
  | "email"
  | "number"
  | "phone"
  | "single"
  | "multiple"
  | "dropdown"
  | "rating"
  | "linear_scale"
  | "nps"
  | "date"
  | "time"
  | "file";

interface Question {
  id: number;
  title: string;
  type: QuestionType;
  required: boolean;
  options: string[];
}

interface Survey {
  id: number;
  title: string;
  description: string;
  status: "active" | "paused";
  questions: Question[];
  reportTemplate?: ReportTemplate;
}

interface SurveyResponse {
  id: number;
  answers: Record<string, unknown>;
  submittedAt: string;
}

type ResultsData = { survey: Survey; responses: SurveyResponse[] };
type Tab = "summary" | "individual" | "report";

interface AiSurveyReport {
  title: string;
  executiveSummary: string;
  metricHighlights: string[];
  segmentInsights: string[];
  opportunityAreas: string[];
  keyFindings: string[];
  risks: string[];
  recommendations: string[];
  followUpQuestions: string[];
  methodology: string;
  confidence: "low" | "medium" | "high";
}

interface ReportTemplate {
  title: string;
  sections: string[];
  metrics: string[];
  chartSlots: string[];
  caveats: string[];
}

interface AiReportEnvelope {
  report: AiSurveyReport;
  model: string;
  generatedAt: string;
  sampleSize: number;
  reportTemplate?: ReportTemplate;
}

interface EChartDatum {
  label: string;
  value: number;
}

type EChartType = "bar" | "donut";

function formatAnswer(question: Question, value: unknown): string {
  if (question.type === "multiple" || question.type === "file") return Array.isArray(value) ? value.join(", ") : "";
  if (["rating", "linear_scale", "nps", "number"].includes(question.type)) return typeof value === "number" ? String(value) : "";
  return typeof value === "string" ? value : "";
}

function average(values: number[]) {
  if (values.length === 0) return "0";
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Number.isInteger(avg) ? String(avg) : avg.toFixed(1);
}

function percent(count: number, total: number) {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
}

function typeLabel(type: QuestionType) {
  const labels: Record<QuestionType, string> = {
    short_text: "短文本",
    text: "长文本",
    email: "邮箱",
    number: "数字",
    phone: "电话",
    single: "单选",
    multiple: "多选",
    dropdown: "下拉",
    rating: "评分",
    linear_scale: "线性量表",
    nps: "NPS",
    date: "日期",
    time: "时间",
    file: "文件",
  };
  return labels[type];
}

function chartColor(index: number) {
  const colors = ["bg-primary", "bg-secondary", "bg-accent", "bg-muted-foreground", "bg-destructive", "bg-border-strong"];
  return colors[index % colors.length];
}

function chartHex(index: number) {
  const colors = ["#7c3aed", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#64748b"];
  return colors[index % colors.length];
}

function ratingMax(type: QuestionType) {
  if (type === "nps") return 10;
  return 5;
}

function hasAnswer(question: Question, value: unknown) {
  return Boolean(formatAnswer(question, value));
}

function answerRate(question: Question, responses: SurveyResponse[]) {
  return percent(responses.filter((response) => hasAnswer(question, response.answers[String(question.id)])).length, responses.length);
}

function questionTypeCounts(questions: Question[]) {
  return questions.reduce<Record<string, number>>((acc, question) => {
    const label = typeLabel(question.type);
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});
}

function optionCount(values: unknown[], option: string) {
  return values.filter((value) => (Array.isArray(value) ? value.includes(option) : value === option)).length;
}

function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: string) {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

function buildCsv(data: ResultsData) {
  const header = ["response_id", "submitted_at", ...data.survey.questions.map((q) => q.title)];
  const rows = data.responses.map((response) => [
    String(response.id),
    response.submittedAt,
    ...data.survey.questions.map((question) => formatAnswer(question, response.answers[String(question.id)])),
  ]);
  return [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
}

function printReport() {
  window.print();
}

function EChartPanel({
  title,
  description,
  type,
  data,
  unit = "",
  testId,
}: {
  title: string;
  description?: string;
  type: EChartType;
  data: EChartDatum[];
  unit?: string;
  testId: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const maxValue = Math.max(1, ...data.map((item) => item.value));
  const barWidth = data.length ? 240 / data.length : 240;
  const donutRadius = 44;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let donutOffset = 0;

  return (
    <article data-testid={testId} className="rounded-12 border border-border bg-background p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-14 font-bold text-foreground">{title}</h3>
          {description && <p className="mt-1 text-12 leading-5 text-muted-foreground">{description}</p>}
        </div>
        <Badge variant="outline">EChart</Badge>
      </div>

      {type === "bar" ? (
        <div className="mt-4">
          <svg aria-label={title} role="img" viewBox="0 0 280 150" className="h-40 w-full overflow-visible">
            <line x1="20" y1="124" x2="270" y2="124" stroke="hsl(var(--border))" strokeWidth="1" />
            {data.map((item, index) => {
              const height = Math.max(8, Math.round((item.value / maxValue) * 96));
              const x = 28 + index * barWidth;
              const width = Math.max(16, Math.min(42, barWidth - 14));
              return (
                <g key={`${item.label}-${index}`}>
                  <rect x={x} y={124 - height} width={width} height={height} rx="6" fill={chartHex(index)} />
                  <text x={x + width / 2} y={116 - height} textAnchor="middle" className="fill-foreground text-10 font-semibold">
                    {item.value}{unit}
                  </text>
                  <text x={x + width / 2} y="142" textAnchor="middle" className="fill-muted-foreground text-10">
                    {item.label.slice(0, 8)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-[150px_1fr]">
          <svg aria-label={title} role="img" viewBox="0 0 120 120" className="h-36 w-36">
            <circle cx="60" cy="60" r={donutRadius} fill="none" stroke="hsl(var(--muted))" strokeWidth="16" />
            {data.map((item, index) => {
              const length = total > 0 ? (item.value / total) * donutCircumference : 0;
              const circle = (
                <circle
                  key={`${item.label}-${index}`}
                  cx="60"
                  cy="60"
                  r={donutRadius}
                  fill="none"
                  stroke={chartHex(index)}
                  strokeWidth="16"
                  strokeDasharray={`${length} ${donutCircumference - length}`}
                  strokeDashoffset={-donutOffset}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                />
              );
              donutOffset += length;
              return circle;
            })}
            <text x="60" y="57" textAnchor="middle" className="fill-foreground text-18 font-bold">
              {total}
            </text>
            <text x="60" y="74" textAnchor="middle" className="fill-muted-foreground text-10">
              total
            </text>
          </svg>
          <div className="flex flex-col justify-center gap-2">
            {data.map((item, index) => (
              <div key={`${item.label}-${index}`} className="flex items-center justify-between gap-3 text-12">
                <span className="flex min-w-0 items-center gap-2 text-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartHex(index) }} />
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="font-medium text-muted-foreground">{item.value}{unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function ReportTemplatePanel({ template, fallbackTitle }: { template?: ReportTemplate; fallbackTitle: string }) {
  const fallback: ReportTemplate = {
    title: `${fallbackTitle} 分析报告`,
    sections: ["样本概览", "关键指标", "行动建议"],
    metrics: ["response_count"],
    chartSlots: ["题目回答分布"],
    caveats: ["样本量低时仅输出方向性判断。"],
  };
  const current = template ?? fallback;
  return (
    <section data-testid="report-template-panel" className="rounded-12 border border-border bg-background p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-12 font-medium uppercase tracking-wide text-muted-foreground">Report Template</p>
          <h3 data-testid="report-template-title" className="mt-1 text-15 font-bold text-foreground">
            {current.title}
          </h3>
        </div>
        <Badge variant="outline">{current.chartSlots.length} charts</Badge>
      </div>
      <div data-testid="report-template-sections" className="mt-3 flex flex-wrap gap-2">
        {current.sections.map((section) => (
          <Badge key={section} variant="muted">
            {section}
          </Badge>
        ))}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface-1 px-3 py-2">
          <p className="text-12 text-muted-foreground">Metrics</p>
          <p className="mt-1 text-13 text-foreground">{current.metrics.join(" / ")}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-1 px-3 py-2">
          <p className="text-12 text-muted-foreground">Caveats</p>
          <p className="mt-1 text-13 text-foreground">{current.caveats.join(" / ")}</p>
        </div>
      </div>
    </section>
  );
}

export default function SurveyResultsPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("summary");
  const [returnToEditor, setReturnToEditor] = useState(false);
  const [aiReport, setAiReport] = useState<AiReportEnvelope | null>(null);
  const [reportModel, setReportModel] = useState("qwen3.7-max");
  const [reportInstruction, setReportInstruction] = useState("");
  const [reportSessionId, setReportSessionId] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/surveys/${params.id}/responses`);
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        setError(res.status === 403 ? "你无权查看该问卷结果" : "加载结果失败，请重试");
        setLoading(false);
        return;
      }
      setData(await res.json());
    } catch {
      setError("加载结果失败，请重试");
    }
    setLoading(false);
  }

  useEffect(() => {
    setReturnToEditor(new URLSearchParams(window.location.search).get("from") === "editor");
    void load();
  }, [params.id]);

  function returnToSurveyWorkspace() {
    window.location.href = returnToEditor ? `/surveys?edit=${params.id}` : "/surveys";
  }

  const ratingAverage = useMemo(() => {
    if (!data) return "0";
    const ratings = data.responses.flatMap((response) =>
      data.survey.questions
        .filter((question) => question.type === "rating" || question.type === "linear_scale" || question.type === "nps")
        .map((question) => response.answers[String(question.id)])
        .filter((value): value is number => typeof value === "number")
    );
    return average(ratings);
  }, [data]);

  const reportMetrics = useMemo(() => {
    if (!data) return null;
    const rates = data.survey.questions.map((question) => answerRate(question, data.responses));
    const avgCompletion = rates.length ? Math.round(rates.reduce((sum, value) => sum + value, 0) / rates.length) : 0;
    const numericQuestions = data.survey.questions.filter((question) => ["rating", "linear_scale", "nps", "number"].includes(question.type));
    const choiceQuestions = data.survey.questions.filter((question) => ["single", "multiple", "dropdown"].includes(question.type));
    const textQuestions = data.survey.questions.filter((question) => ["short_text", "text", "email", "phone"].includes(question.type));
    const typeCounts = questionTypeCounts(data.survey.questions);
    return {
      avgCompletion,
      numericQuestions,
      choiceQuestions,
      textQuestions,
      typeCounts,
      topQuestionRate: Math.max(0, ...rates),
      lowQuestionRate: rates.length ? Math.min(...rates) : 0,
    };
  }, [data]);

  async function generateAiReport(instruction = "") {
    setReportError("");
    setReportLoading(true);
    try {
      const res = await fetch(`/api/surveys/${params.id}/ai-report`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: reportModel, instruction, currentReport: aiReport?.report ?? null }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReportError(payload.error ?? "AI 报告生成失败，请确认 QWEN_API_KEY / DASHSCOPE_API_KEY 已配置。");
        return;
      }
      setAiReport(payload as AiReportEnvelope);
      if (typeof payload.sessionId === "string") setReportSessionId(payload.sessionId);
      setReportInstruction("");
    } catch {
      setReportError("AI 报告服务暂时不可用，请稍后重试。");
    } finally {
      setReportLoading(false);
    }
  }

  if (loading) {
    return (
      <main data-testid="loading" className="mx-auto max-w-content animate-pulse px-9 py-7">
        <div className="h-10 w-72 rounded-lg bg-muted" />
        <div className="mt-5 h-64 rounded-12 border border-border bg-muted/40" />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-content px-9 py-7">
        <Button data-testid="back-to-survey-workspace" size="sm" variant="ghost" onClick={returnToSurveyWorkspace} className="mb-4 gap-1.5">
          <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          {returnToEditor ? "返回问卷编辑" : "返回问卷列表"}
        </Button>
        <p role="alert" data-testid="err-results" className="text-13 text-destructive">
          {error || "加载结果失败，请重试"}
        </p>
        <Button size="sm" variant="outline" onClick={() => void load()} className="mt-3 gap-1.5">
          <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
          重试
        </Button>
      </main>
    );
  }

  if (data.responses.length === 0) {
    return (
      <main className="mx-auto max-w-content px-9 py-7">
        <Button data-testid="back-to-survey-workspace" size="sm" variant="ghost" onClick={returnToSurveyWorkspace} className="mb-4 gap-1.5">
          <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          {returnToEditor ? "返回问卷编辑" : "返回问卷列表"}
        </Button>
        <section data-testid="survey-results-page" className="rounded-12 border border-border bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Badge variant="outline">Report</Badge>
              <h1 className="mt-3 text-22 font-bold text-foreground">{data.survey.title}</h1>
              {data.survey.description && <p className="mt-1 text-13 text-muted-foreground">{data.survey.description}</p>}
            </div>
            <Badge variant={data.survey.status === "active" ? "success" : "muted"}>{data.survey.status}</Badge>
          </div>
          <section className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-12 border border-border bg-background p-4">
              <p className="text-12 text-muted-foreground">Responses</p>
              <p data-testid="results-count" className="mt-1 text-22 font-bold text-foreground">0</p>
            </div>
            <div className="rounded-12 border border-border bg-background p-4">
              <p className="text-12 text-muted-foreground">Questions</p>
              <p className="mt-1 text-22 font-bold text-foreground">{data.survey.questions.length}</p>
            </div>
            <div className="rounded-12 border border-border bg-background p-4">
              <p className="text-12 text-muted-foreground">Status</p>
              <p className="mt-1 text-22 font-bold text-foreground">{data.survey.status === "active" ? "Collecting" : "Paused"}</p>
            </div>
          </section>
          <div data-testid="results-empty" className="mt-5 rounded-12 border border-dashed border-border-strong p-8 text-center">
            <p className="text-15 font-semibold text-foreground">还没有答卷</p>
            <p className="mt-1 text-13 text-muted-foreground">发布并分享问卷后，摘要、个体答卷和 AI 报告会自动填充。</p>
          </div>
          <div className="mt-5 flex gap-2" role="tablist" aria-label="Survey result views">
            <Button data-testid="tab-summary" size="sm" variant={tab === "summary" ? "default" : "outline"} onClick={() => setTab("summary")}>
              概览
            </Button>
            <Button data-testid="tab-individual" size="sm" variant={tab === "individual" ? "default" : "outline"} onClick={() => setTab("individual")}>
              单份答卷
            </Button>
            <Button data-testid="tab-report" size="sm" variant={tab === "report" ? "default" : "outline"} onClick={() => setTab("report")}>
              AI 报告
            </Button>
          </div>
          <div data-testid="report-panel" className="mt-5 rounded-12 border border-border bg-surface-1 p-5">
            <h2 className="text-18 font-bold text-foreground">报告框架</h2>
            <div className="mt-4">
              <ReportTemplatePanel template={data.survey.reportTemplate} fallbackTitle={data.survey.title} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Select
                data-testid="report-model"
                aria-label="Report model"
                value={reportModel}
                onChange={(event) => setReportModel(event.target.value)}
                className="h-9 w-56"
              >
                <option value="qwen3.7-max">qwen3.7-max</option>
                <option value="mock-survey-quality">Mock Survey Quality</option>
                <option value="mock-survey-fast">Mock Survey Fast</option>
              </Select>
              <Button data-testid="generate-ai-report" type="button" className="gap-1.5" disabled={reportLoading} onClick={() => void generateAiReport()}>
                <Sparkles className="h-4 w-4" strokeWidth={1.5} />
                {reportLoading ? "生成中…" : aiReport ? "重新生成" : "生成 AI 报告"}
              </Button>
            </div>
            {reportError && (
              <p role="alert" data-testid="ai-report-error" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-13 text-destructive">
                {reportError}
              </p>
            )}
            {aiReport && (
              <article className="mt-4 rounded-12 border border-border bg-background p-5 shadow-sm">
                <h3 className="text-15 font-bold text-foreground">{aiReport.report.title}</h3>
                <p className="mt-2 text-14 leading-7 text-muted-foreground">{aiReport.report.executiveSummary}</p>
              </article>
            )}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {["样本规模与回收进度", "关键指标与评分趋势", "选择题分布与偏好", "开放反馈主题归纳", "风险信号与异常回答", "下一步行动建议"].map((item) => (
                <div key={item} className="rounded-lg border border-border bg-background px-3 py-2 text-13 text-foreground">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main data-testid="survey-results-page" className="mx-auto max-w-content px-9 py-7">
      <Button data-testid="back-to-survey-workspace" size="sm" variant="ghost" onClick={returnToSurveyWorkspace} className="mb-4 gap-1.5">
        <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
        {returnToEditor ? "返回问卷编辑" : "返回问卷列表"}
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge variant={data.survey.status === "active" ? "success" : "muted"}>{data.survey.status}</Badge>
          <h1 className="mt-3 text-26 font-bold tracking-tight text-foreground">{data.survey.title}</h1>
          {data.survey.description && <p className="mt-1 text-13 text-muted-foreground">{data.survey.description}</p>}
        </div>
        <div className="flex gap-2">
          <Button
            data-testid="export-csv"
            size="sm"
            variant="outline"
            onClick={() => downloadText(`survey-results-${data.survey.id}.csv`, buildCsv(data), "text/csv;charset=utf-8")}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" strokeWidth={1.5} />
            Export CSV
          </Button>
          <Button
            data-testid="export-pdf"
            size="sm"
            variant="outline"
            onClick={printReport}
            className="gap-1.5"
          >
            <FileText className="h-4 w-4" strokeWidth={1.5} />
            Print / PDF
          </Button>
        </div>
      </div>

      <section className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-12 border border-border bg-card p-4">
          <p className="text-12 text-muted-foreground">Responses</p>
          <p data-testid="results-count" className="mt-1 text-22 font-bold text-foreground">{data.responses.length}</p>
        </div>
        <div className="rounded-12 border border-border bg-card p-4">
          <p className="text-12 text-muted-foreground">Questions</p>
          <p className="mt-1 text-22 font-bold text-foreground">{data.survey.questions.length}</p>
        </div>
        <div className="rounded-12 border border-border bg-card p-4">
          <p className="text-12 text-muted-foreground">Average rating</p>
          <p className="mt-1 text-22 font-bold text-foreground">{ratingAverage}</p>
        </div>
      </section>

      <div className="mt-5 flex gap-2" role="tablist" aria-label="Survey result views">
        <Button data-testid="tab-summary" size="sm" variant={tab === "summary" ? "default" : "outline"} onClick={() => setTab("summary")}>
          概览
        </Button>
        <Button data-testid="tab-individual" size="sm" variant={tab === "individual" ? "default" : "outline"} onClick={() => setTab("individual")}>
          单份答卷
        </Button>
        <Button data-testid="tab-report" size="sm" variant={tab === "report" ? "default" : "outline"} onClick={() => setTab("report")}>
          AI 报告
        </Button>
      </div>

      {tab === "summary" && (
        <section data-testid="summary-panel" className="mt-4 flex flex-col gap-4">
          {reportMetrics && (
            <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
              <article className="rounded-12 border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-18 font-bold text-foreground">结果概览</h2>
                    <p className="mt-1 text-13 text-muted-foreground">参考 Google Forms 的 Summary 视图，先看整体质量，再下钻单题。</p>
                  </div>
                  <BarChart3 className="h-5 w-5 text-primary" strokeWidth={1.5} />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-surface-1 p-3">
                    <p className="text-12 text-muted-foreground">平均完成率</p>
                    <p className="mt-1 text-22 font-bold text-foreground">{reportMetrics.avgCompletion}%</p>
                    <div className="mt-3 h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${reportMetrics.avgCompletion}%` }} />
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface-1 p-3">
                    <p className="text-12 text-muted-foreground">量化题</p>
                    <p className="mt-1 text-22 font-bold text-foreground">{reportMetrics.numericQuestions.length}</p>
                    <p className="mt-2 text-12 text-muted-foreground">评分 / NPS / 数字</p>
                  </div>
                  <div className="rounded-lg border border-border bg-surface-1 p-3">
                    <p className="text-12 text-muted-foreground">开放反馈题</p>
                    <p className="mt-1 text-22 font-bold text-foreground">{reportMetrics.textQuestions.length}</p>
                    <p className="mt-2 text-12 text-muted-foreground">短答 / 长答 / 联系方式</p>
                  </div>
                </div>
                <div data-testid="echat-summary-charts" className="mt-4 grid gap-3 lg:grid-cols-2">
                  <EChartPanel
                    testId="echat-completion-chart"
                    title="回答完成率图表"
                    description="平均完成率、最高回答率和最低回答率。"
                    type="bar"
                    unit="%"
                    data={[
                      { label: "平均", value: reportMetrics.avgCompletion },
                      { label: "最高", value: reportMetrics.topQuestionRate },
                      { label: "最低", value: reportMetrics.lowQuestionRate },
                    ]}
                  />
                  <EChartPanel
                    testId="echat-question-type-chart"
                    title="题型分布图表"
                    description="按题型聚合，辅助判断报告素材结构。"
                    type="donut"
                    data={Object.entries(reportMetrics.typeCounts).map(([label, value]) => ({ label, value }))}
                  />
                </div>
              </article>

              <article className="rounded-12 border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-18 font-bold text-foreground">题型结构</h2>
                    <p className="mt-1 text-13 text-muted-foreground">问卷覆盖的题型与分析素材。</p>
                  </div>
                  <PieChart className="h-5 w-5 text-sky-600" strokeWidth={1.5} />
                </div>
                <div className="mt-4 space-y-3">
                  {Object.entries(reportMetrics.typeCounts).map(([label, count], index) => (
                    <div key={label}>
                      <div className="flex items-center justify-between text-13">
                        <span className="text-foreground">{label}</span>
                        <span className="text-muted-foreground">{count} 题</span>
                      </div>
                      <div className="mt-1.5 h-2 rounded-full bg-muted">
                        <div className={`h-2 rounded-full ${chartColor(index)}`} style={{ width: `${percent(count, data.survey.questions.length)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          )}

          {data.survey.questions.map((question, questionIndex) => {
            const values = data.responses.map((response) => response.answers[String(question.id)]);
            const ratingValues = values.filter((value): value is number => typeof value === "number");
            const answeredRate = answerRate(question, data.responses);
            return (
              <article key={question.id} className="rounded-12 border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-15 font-semibold text-foreground">{question.title}</h2>
                      <Badge variant="outline">{typeLabel(question.type)}</Badge>
                    </div>
                    <p className="mt-1 text-12 text-muted-foreground">{answeredRate}% 回答率 · {question.required ? "必答" : "选答"}</p>
                  </div>
                  <div className="min-w-32">
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${answeredRate}%` }} />
                    </div>
                  </div>
                </div>
                {(question.type === "rating" || question.type === "linear_scale" || question.type === "nps") && (
                  <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr]">
                    <div className="rounded-lg border border-border bg-surface-1 p-4">
                      <p className="text-12 text-muted-foreground">平均分</p>
                      <p className="mt-1 text-30 font-bold text-foreground">{average(ratingValues)}</p>
                      <p className="text-12 text-muted-foreground">满分 {ratingMax(question.type)}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-4">
                      <EChartPanel
                        testId={`echat-question-chart-${questionIndex}`}
                        title="评分分布"
                        description="按分值统计回答数量。"
                        type="bar"
                        data={Array.from({ length: ratingMax(question.type) }, (_, idx) => {
                          const score = idx + 1;
                          return { label: String(score), value: ratingValues.filter((value) => value === score).length };
                        })}
                      />
                    </div>
                  </div>
                )}
                {(question.type === "single" || question.type === "multiple" || question.type === "dropdown") && (
                  <div className="mt-4">
                    <EChartPanel
                      testId={`echat-question-chart-${questionIndex}`}
                      title="选项分布"
                      description="每个选项的回答数量。"
                      type="bar"
                      data={question.options.map((option) => ({ label: option, value: optionCount(values, option) }))}
                    />
                  </div>
                )}
                {!["single", "multiple", "dropdown", "rating", "linear_scale", "nps"].includes(question.type) && (
                  <div className="mt-4 rounded-lg border border-border bg-surface-1 p-4">
                    <p className="text-13 text-muted-foreground">{values.filter((value) => formatAnswer(question, value)).length} 条回答</p>
                    <div className="mt-3 space-y-2">
                      {values
                        .map((value) => formatAnswer(question, value))
                        .filter(Boolean)
                        .slice(0, 3)
                        .map((answer, index) => (
                          <p key={`${question.id}-${index}`} className="rounded-md bg-background px-3 py-2 text-13 text-foreground">
                            {answer}
                          </p>
                        ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      {tab === "individual" && (
        <section data-testid="individual-panel" className="mt-4 flex flex-col gap-3">
          {data.responses.map((response, responseIdx) => (
            <article key={response.id} className="rounded-12 border border-border bg-card p-4">
              <h2 className="text-15 font-semibold text-foreground">Response {responseIdx + 1}</h2>
              <dl className="mt-3 flex flex-col gap-2">
                {data.survey.questions.map((question) => (
                  <div key={question.id} className="rounded-lg bg-surface-1 px-3 py-2">
                    <dt className="text-12 text-muted-foreground">{question.title}</dt>
                    <dd className="mt-1 text-13 text-foreground">{formatAnswer(question, response.answers[String(question.id)]) || "-"}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </section>
      )}

      {tab === "report" && (
        <section data-testid="report-panel" className="mt-4 overflow-hidden rounded-12 border border-border bg-card">
          <div className="border-b border-border bg-surface-1 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-12 font-medium text-primary">
                  <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {reportModel}
                </div>
                <h2 className="mt-3 text-20 font-bold text-foreground">AI 专业调研报告</h2>
                <p className="mt-1 text-13 text-muted-foreground">
                  基于 {data.responses.length} 份答卷、{data.survey.questions.length} 道题，生成管理层摘要、风险信号和行动建议。
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Select
                  data-testid="report-model"
                  aria-label="Report model"
                  value={reportModel}
                  onChange={(event) => setReportModel(event.target.value)}
                  className="h-9"
                >
                  <option value="qwen3.7-max">qwen3.7-max</option>
                  <option value="mock-survey-quality">Mock Survey Quality</option>
                  <option value="mock-survey-fast">Mock Survey Fast</option>
                </Select>
                <Button data-testid="generate-ai-report" type="button" className="gap-1.5" disabled={reportLoading} onClick={() => void generateAiReport()}>
                  <Sparkles className="h-4 w-4" strokeWidth={1.5} />
                  {reportLoading ? "生成中…" : aiReport ? "重新生成" : "生成 AI 报告"}
                </Button>
              </div>
            </div>
            {reportError && (
              <p role="alert" data-testid="ai-report-error" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-13 text-destructive">
                {reportError}
              </p>
            )}
          </div>
          <div className="border-b border-border p-5">
            <ReportTemplatePanel template={aiReport?.reportTemplate ?? data.survey.reportTemplate} fallbackTitle={data.survey.title} />
          </div>

          {aiReport ? (
            <div className="p-5">
              {reportSessionId && (
                <p data-testid="report-session-id" className="mb-3 text-12 text-muted-foreground">
                  AI session: {reportSessionId}
                </p>
              )}
              <div className="grid gap-3 lg:grid-cols-4">
                <div className="rounded-12 border border-border bg-background p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-12 text-muted-foreground">样本量</p>
                    <ListChecks className="h-4 w-4 text-emerald-600" strokeWidth={1.5} />
                  </div>
                  <p className="mt-1 text-22 font-bold text-foreground">{aiReport.sampleSize}</p>
                  <p className="mt-2 text-12 text-muted-foreground">当前有效答卷</p>
                </div>
                <div className="rounded-12 border border-border bg-background p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-12 text-muted-foreground">平均完成率</p>
                    <TrendingUp className="h-4 w-4 text-sky-600" strokeWidth={1.5} />
                  </div>
                  <p className="mt-1 text-22 font-bold text-foreground">{reportMetrics?.avgCompletion ?? 0}%</p>
                  <div className="mt-3 h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-sky-500" style={{ width: `${reportMetrics?.avgCompletion ?? 0}%` }} />
                  </div>
                </div>
                <div className="rounded-12 border border-border bg-background p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-12 text-muted-foreground">置信度</p>
                    <Target className="h-4 w-4 text-amber-600" strokeWidth={1.5} />
                  </div>
                  <p className="mt-1 text-22 font-bold capitalize text-foreground">{aiReport.report.confidence}</p>
                  <p className="mt-2 text-12 text-muted-foreground">结合样本量和题型判断</p>
                </div>
                <div className="rounded-12 border border-border bg-background p-4 shadow-sm">
                  <p className="text-12 text-muted-foreground">生成模型</p>
                  <p className="mt-1 text-15 font-semibold text-foreground">{aiReport.model}</p>
                  <p className="mt-2 text-12 text-muted-foreground">{new Date(aiReport.generatedAt).toLocaleString("zh-CN")}</p>
                </div>
              </div>

              <article className="mt-4 rounded-12 border border-border bg-background p-5 shadow-sm">
                <h3 className="text-15 font-bold text-foreground">{aiReport.report.title}</h3>
                <p className="mt-2 text-14 leading-7 text-muted-foreground">{aiReport.report.executiveSummary}</p>
              </article>

              <article className="mt-4 rounded-12 border border-border bg-background p-4 shadow-sm">
                <h3 className="text-15 font-bold text-foreground">追问 / 改写报告</h3>
                <textarea
                  data-testid="report-followup-input"
                  value={reportInstruction}
                  onChange={(event) => setReportInstruction(event.target.value)}
                  placeholder="例如：压缩成高管摘要；语气更正式；补充行动优先级"
                  className="mt-3 min-h-20 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                />
                <Button
                  data-testid="refine-ai-report"
                  type="button"
                  size="sm"
                  className="mt-3"
                  disabled={reportLoading || !reportInstruction.trim()}
                  onClick={() => void generateAiReport(reportInstruction)}
                >
                  {reportLoading ? "改写中…" : "确认改写报告"}
                </Button>
              </article>

              <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div data-testid="echat-report-charts">
                  <EChartPanel
                    testId="echat-report-metric-chart"
                    title="报告指标图表"
                    description="AI 报告使用的核心回答覆盖指标。"
                    type="bar"
                    unit="%"
                    data={[
                      { label: "回答覆盖", value: reportMetrics?.avgCompletion ?? 0 },
                      { label: "最高回答率", value: reportMetrics?.topQuestionRate ?? 0 },
                      { label: "最低回答率", value: reportMetrics?.lowQuestionRate ?? 0 },
                    ]}
                  />
                </div>

                <article className="rounded-12 border border-border bg-background p-4 shadow-sm">
                  <h3 className="text-15 font-bold text-foreground">指标解读</h3>
                  <ul className="mt-3 grid gap-2 text-13 leading-6 text-muted-foreground">
                    {aiReport.report.metricHighlights.map((item) => (
                      <li key={item} className="rounded-lg bg-surface-1 px-3 py-2">
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                {[
                  ["细分洞察", aiReport.report.segmentInsights, "border-sky-200 bg-sky-50/50"],
                  ["机会点", aiReport.report.opportunityAreas, "border-emerald-200 bg-emerald-50/50"],
                  ["风险信号", aiReport.report.risks, "border-rose-200 bg-rose-50/50"],
                ].map(([heading, items, className]) => (
                  <article key={heading as string} className={`rounded-12 border p-4 shadow-sm ${className as string}`}>
                    <h3 className="text-15 font-bold text-foreground">{heading as string}</h3>
                    <ul className="mt-3 space-y-2 text-13 leading-6 text-muted-foreground">
                      {(items as string[]).slice(0, 4).map((item) => (
                        <li key={item} className="rounded-lg bg-background/80 px-3 py-2">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {[
                  ["关键发现", aiReport.report.keyFindings],
                  ["行动建议", aiReport.report.recommendations],
                  ["建议追问", aiReport.report.followUpQuestions],
                ].map(([heading, items]) => (
                  <article key={heading as string} className="rounded-12 border border-border bg-background p-4 shadow-sm">
                    <h3 className="text-15 font-bold text-foreground">{heading as string}</h3>
                    <ul className="mt-3 space-y-2 text-13 leading-6 text-muted-foreground">
                      {(items as string[]).map((item) => (
                        <li key={item} className="rounded-lg bg-surface-1 px-3 py-2">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>

              <article className="mt-4 rounded-12 border border-border bg-background p-4 shadow-sm">
                <h3 className="text-15 font-bold text-foreground">单题图表快照</h3>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {data.survey.questions.slice(0, 4).map((question) => {
                    const values = data.responses.map((response) => response.answers[String(question.id)]);
                    const ratingValues = values.filter((value): value is number => typeof value === "number");
                    return (
                      <div key={question.id} className="rounded-lg border border-border bg-surface-1 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-13 font-medium text-foreground">{question.title}</p>
                          <Badge variant="outline">{typeLabel(question.type)}</Badge>
                        </div>
                        {(question.type === "single" || question.type === "multiple" || question.type === "dropdown") && (
                          <div className="mt-3 space-y-2">
                            {question.options.slice(0, 4).map((option, index) => {
                              const count = optionCount(values, option);
                              const optionPercent = percent(count, data.responses.length);
                              return (
                                <div key={option}>
                                  <div className="flex justify-between text-12 text-muted-foreground">
                                    <span>{option}</span>
                                    <span>{optionPercent}%</span>
                                  </div>
                                  <div className="mt-1 h-1.5 rounded-full bg-muted">
                                    <div className={`h-1.5 rounded-full ${chartColor(index)}`} style={{ width: `${optionPercent}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {(question.type === "rating" || question.type === "linear_scale" || question.type === "nps") && (
                          <div className="mt-3 flex items-end gap-2">
                            <p className="text-22 font-bold text-foreground">{average(ratingValues)}</p>
                            <p className="pb-1 text-12 text-muted-foreground">平均分 / {ratingMax(question.type)}</p>
                          </div>
                        )}
                        {!["single", "multiple", "dropdown", "rating", "linear_scale", "nps"].includes(question.type) && (
                          <p className="mt-3 text-13 text-muted-foreground">{values.filter((value) => formatAnswer(question, value)).length} 条文本回答</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </article>

              <article className="mt-4 rounded-12 border border-border bg-background p-4 shadow-sm">
                <h3 className="text-15 font-bold text-foreground">方法与边界</h3>
                <p className="mt-2 text-13 leading-6 text-muted-foreground">{aiReport.report.methodology}</p>
              </article>
            </div>
          ) : (
            <div className="p-5">
              <div className="rounded-12 border border-dashed border-border-strong bg-background p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-15 font-bold text-foreground">报告生成前预览</h3>
                    <p className="mt-2 max-w-2xl text-14 leading-6 text-muted-foreground">
                      当前已具备 {data.responses.length} 份答卷、{data.survey.questions.length} 道题、平均评分 {ratingAverage}。生成后会把本地统计图表和 AI 研究判断合并成一份图文报告。
                    </p>
                  </div>
                  <div className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-12 font-medium text-primary">
                    Google / Microsoft 风格摘要 + AI 洞察
                  </div>
                </div>
                <div className="mt-5 grid gap-3 lg:grid-cols-3">
                  {[
                    ["1", "基础统计", "样本量、完成率、题型结构、评分均值"],
                    ["2", "图表分析", "选择题分布、评分柱状图、开放题回答量"],
                    ["3", "AI 洞察", "管理层摘要、细分洞察、机会点、风险与建议"],
                  ].map(([step, title, desc]) => (
                    <div key={step} className="rounded-lg border border-border bg-surface-1 p-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background text-13 font-bold text-primary">{step}</div>
                      <p className="mt-3 text-14 font-semibold text-foreground">{title}</p>
                      <p className="mt-1 text-12 leading-5 text-muted-foreground">{desc}</p>
                    </div>
                  ))}
                </div>
                <div data-testid="echat-report-preview-charts" className="mt-5 grid gap-3 md:grid-cols-2">
                  <EChartPanel
                    testId="echat-report-preview-completion-chart"
                    title="报告预览指标"
                    description="生成 AI 报告前可先查看样本覆盖情况。"
                    type="bar"
                    unit="%"
                    data={[
                      { label: "平均完成率", value: reportMetrics?.avgCompletion ?? 0 },
                      { label: "最高题目", value: reportMetrics?.topQuestionRate ?? 0 },
                      { label: "最低题目", value: reportMetrics?.lowQuestionRate ?? 0 },
                    ]}
                  />
                  <EChartPanel
                    testId="echat-report-preview-type-chart"
                    title="报告素材结构"
                    description="AI 将结合题型结构生成报告。"
                    type="donut"
                    data={Object.entries(reportMetrics?.typeCounts ?? {}).map(([label, value]) => ({ label, value }))}
                  />
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
