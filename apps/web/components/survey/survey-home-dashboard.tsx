"use client";

import { ArrowRight, LayoutTemplate, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface SurveyHomeTemplate {
  id: string;
  category: string;
  name: string;
  questionCount: number;
  estimatedMinutes: number;
}

export interface SurveyHomeRecentItem {
  id: number;
  title: string;
  description: string;
  status: "active" | "paused";
  statusLabel: string;
  responseCount: number;
  responseLimit: number | null;
  updatedLabel: string;
}

interface SurveyHomeDashboardProps {
  greeting: string;
  userName: string | null;
  activeSurveyCount: number;
  totalResponses: number;
  generatedReportCount: number;
  completionRate: number | null;
  organizationName: string;
  organizationSummary: string;
  communityTemplateName: string | null;
  communityTemplateSummary: string;
  templates: SurveyHomeTemplate[];
  recentSurveys: SurveyHomeRecentItem[];
  onCreate: () => void;
  onBrowseTemplates: () => void;
  onBrowseSurveys: () => void;
  onUseTemplate: (templateId: string) => void;
  onOpenSurvey: (surveyId: number, target: "design" | "report") => void;
}

const METHOD_STEPS = [
  {
    label: "WHY · 为什么",
    title: "诊断先行，带数据进场",
    body: "工作坊前 1-2 周完成诊断，把现场时间从对齐事实转向共创方案。",
    action: "看诊断模板",
    target: "templates" as const,
  },
  {
    label: "HOW · 怎么做",
    title: "结构化收集，可对比可聚合",
    body: "把访谈中不可比的信息转成统一维度的量表与分类，直接比较关键差异。",
    action: "新建问卷",
    target: "create" as const,
  },
  {
    label: "THEN · 然后呢",
    title: "AI 直达洞察报告",
    body: "回收完成后按报告模板组织雷达图、优先级矩阵、引述与行动建议。",
    action: "查看问卷",
    target: "surveys" as const,
  },
];

function responseProgress(item: SurveyHomeRecentItem) {
  if (!item.responseLimit || item.responseLimit <= 0) return null;
  return Math.min(100, Math.round((item.responseCount / item.responseLimit) * 100));
}

export function SurveyHomeDashboard({
  greeting,
  userName,
  activeSurveyCount,
  totalResponses,
  generatedReportCount,
  completionRate,
  organizationName,
  organizationSummary,
  communityTemplateName,
  communityTemplateSummary,
  templates,
  recentSurveys,
  onCreate,
  onBrowseTemplates,
  onBrowseSurveys,
  onUseTemplate,
  onOpenSurvey,
}: SurveyHomeDashboardProps) {
  const metrics = [
    { label: "进行中问卷", value: String(activeSurveyCount) },
    { label: "累计回收", value: String(totalResponses) },
    { label: "生成报告", value: String(generatedReportCount) },
    { label: "平均完成率", value: completionRate == null ? "—" : `${completionRate}%`, emphasis: true },
  ];

  return (
    <div data-testid="survey-diagnostic-home" className="mx-auto w-full max-w-survey-dashboard px-4 py-8 sm:px-6 lg:px-10 lg:py-9">
      <section data-testid="survey-home-context" className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-26 font-bold text-foreground">{greeting}，{userName || "欢迎回来"}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="muted">{organizationName} · 组织与 AI 转型</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button data-testid="create-with-ai" type="button" onClick={onCreate} className="h-10 gap-2 px-4">
            <Plus className="h-4 w-4" strokeWidth={1.7} />
            新建问卷
          </Button>
          <Button type="button" variant="outline" onClick={onBrowseTemplates} className="h-10 gap-2 px-4">
            <LayoutTemplate className="h-4 w-4" strokeWidth={1.7} />
            浏览模版
          </Button>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_1fr_1fr]">
        <article data-testid="survey-home-metrics" className="min-h-40 rounded-lg border border-border bg-background px-5 py-5">
          <h2 className="text-13 font-semibold text-muted-foreground">我的工作台</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.label}>
                <p className={`text-22 font-bold ${metric.emphasis ? "text-survey" : "text-foreground"}`}>{metric.value}</p>
                <p className="mt-1 text-12 text-muted-foreground">{metric.label}</p>
              </div>
            ))}
          </div>
        </article>

        <article data-testid="survey-home-organization" className="min-h-40 rounded-lg border border-border bg-background px-5 py-5">
          <h2 className="text-13 font-semibold text-muted-foreground">组织</h2>
          <p className="mt-3 text-15 font-bold text-foreground">{organizationName}</p>
          <p className="mt-1 text-12 leading-5 text-muted-foreground">{organizationSummary}</p>
        </article>

        <article data-testid="survey-home-community" className="min-h-40 rounded-lg border border-border bg-background px-5 py-5">
          <h2 className="text-13 font-semibold text-muted-foreground">顾问社区</h2>
          <p className="mt-3 text-13 leading-5 text-foreground">
            {communityTemplateName ? <>推荐模板：<strong>{communityTemplateName}</strong></> : "暂无可推荐模板"}
          </p>
          <p className="mt-1 text-12 leading-5 text-muted-foreground">{communityTemplateSummary}</p>
          <Button type="button" variant="link" size="sm" onClick={onBrowseTemplates} className="mt-2 h-auto gap-1 px-0 text-survey">
            去看看
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
          </Button>
        </article>
      </section>

      <section data-testid="survey-home-method" className="mt-4 rounded-lg border border-border bg-background px-5 py-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-15 font-bold text-foreground">为什么在工作坊之前用 Survey？</h2>
          <p className="text-12 text-muted-foreground">面向诊断的三步用法</p>
        </div>
        <div className="mt-4 grid gap-0 md:grid-cols-3 md:divide-x md:divide-border">
          {METHOD_STEPS.map((step) => (
            <article key={step.label} className="border-t border-border py-4 first:border-t-0 md:border-t-0 md:px-5 md:first:pl-0 md:last:pr-0">
              <p className="text-11 font-bold text-survey">{step.label}</p>
              <h3 className="mt-2 text-14 font-bold text-foreground">{step.title}</h3>
              <p className="mt-2 text-12 leading-5 text-muted-foreground">{step.body}</p>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="mt-2 h-auto gap-1 px-0 text-survey"
                onClick={
                  step.target === "create"
                    ? onCreate
                    : step.target === "templates"
                      ? onBrowseTemplates
                      : onBrowseSurveys
                }
              >
                {step.action}
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
              </Button>
            </article>
          ))}
        </div>
      </section>

      <section data-testid="survey-home-templates" className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-15 font-bold text-foreground">为你推荐的诊断模版</h2>
          <Button type="button" variant="link" size="sm" onClick={onBrowseTemplates} className="h-auto gap-1 px-0 text-survey">
            全部模版
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
          </Button>
        </div>
        {templates.length ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {templates.map((template) => (
              <button
                key={template.id}
                data-testid={`survey-home-template-${template.id}`}
                type="button"
                onClick={() => onUseTemplate(template.id)}
                className="min-h-32 rounded-lg border border-border bg-background p-4 text-left transition-colors duration-200 hover:border-survey focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Badge variant="muted">{template.category}</Badge>
                <h3 className="mt-3 line-clamp-2 min-h-10 text-13 font-bold leading-5 text-foreground">{template.name}</h3>
                <p className="mt-2 text-12 text-muted-foreground">{template.questionCount} 题 · {template.estimatedMinutes} min</p>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-lg border border-dashed border-border-strong px-4 py-8 text-center text-13 text-muted-foreground">
            暂无可用模板
          </p>
        )}
      </section>

      <section data-testid="survey-home-recent" className="mt-6">
        <h2 className="text-15 font-bold text-foreground">最近问卷</h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-border bg-background">
          {recentSurveys.length ? recentSurveys.map((survey) => {
            const progress = responseProgress(survey);
            return (
              <div key={survey.id} className="grid gap-3 border-b border-border px-5 py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_auto_180px_auto] md:items-center">
                <div className="min-w-0">
                  <h3 className="truncate text-13 font-semibold text-foreground">{survey.title}</h3>
                  <p className="mt-1 truncate text-12 text-muted-foreground">{survey.description || survey.updatedLabel}</p>
                </div>
                <Badge variant={survey.status === "active" ? "success" : "muted"} className="w-fit">{survey.statusLabel}</Badge>
                <div>
                  <p className="text-12 text-muted-foreground">
                    {survey.responseLimit ? `${survey.responseCount} / ${survey.responseLimit} 份答卷` : `${survey.responseCount} 份答卷 · 未设置目标`}
                  </p>
                  {progress != null ? (
                    <progress className="survey-progress mt-2 block h-1.25 w-full" max={100} value={progress} aria-label={`${survey.title} 回收进度`} />
                  ) : null}
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => onOpenSurvey(survey.id, survey.responseCount ? "report" : "design")}>
                  {survey.responseCount ? "查看报告" : "继续编辑"}
                </Button>
              </div>
            );
          }) : (
            <p className="px-5 py-8 text-center text-13 text-muted-foreground">还没有最近问卷</p>
          )}
        </div>
      </section>
    </div>
  );
}
