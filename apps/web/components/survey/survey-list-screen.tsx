"use client";

import { FileText, LayoutTemplate, Plus, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface SurveyListItem {
  id: number;
  title: string;
  description: string;
  status: "active" | "paused";
  statusLabel: string;
  responseCount: number;
  responseLimit: number | null;
  updatedLabel: string;
}

interface SurveyListScreenProps {
  loading: boolean;
  error: string;
  surveys: SurveyListItem[];
  onOpenCreateChooser: () => void;
  onCreateWithAi: () => void;
  onCreateFromTemplate: () => void;
  onCreateBlank: () => void;
  onOpenSurvey: (surveyId: number) => void;
}

const CREATE_PATHS = [
  {
    id: "ai",
    title: "AI 对话生成",
    description: "描述目标和受访者，AI 生成第一版后持续迭代。",
    icon: Sparkles,
  },
  {
    id: "template",
    title: "从模板开始",
    description: "套用系统或团队沉淀的诊断模板，再针对项目调整。",
    icon: LayoutTemplate,
  },
  {
    id: "blank",
    title: "空白问卷",
    description: "从零搭建题目，过程中仍可随时使用 AI 助手。",
    icon: FileText,
  },
] as const;

function progressValue(item: SurveyListItem) {
  if (!item.responseLimit || item.responseLimit <= 0) return null;
  return Math.min(100, Math.round((item.responseCount / item.responseLimit) * 100));
}

export function SurveyListScreen({
  loading,
  error,
  surveys,
  onOpenCreateChooser,
  onCreateWithAi,
  onCreateFromTemplate,
  onCreateBlank,
  onOpenSurvey,
}: SurveyListScreenProps) {
  const handlers = {
    ai: onCreateWithAi,
    template: onCreateFromTemplate,
    blank: onCreateBlank,
  };

  return (
    <section data-testid="survey-list-screen" className="mx-auto w-full max-w-survey-dashboard px-4 py-8 sm:px-6 lg:px-10 lg:py-9">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-22 font-bold text-foreground">我的问卷</h1>
          <p className="mt-2 text-13 leading-5 text-muted-foreground">从模板、空白或 AI 对话开始新建，回收后进入洞察报告。</p>
        </div>
        <Button type="button" onClick={onOpenCreateChooser} className="h-10 gap-2 self-start px-4">
          <Plus className="h-4 w-4" strokeWidth={1.7} />
          新建问卷
        </Button>
      </header>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {CREATE_PATHS.map((path) => {
          const Icon = path.icon;
          return (
            <button
              key={path.id}
              data-testid={`create-path-${path.id}`}
              type="button"
              onClick={handlers[path.id]}
              className="min-h-survey-create-card rounded-lg border border-dashed border-border-strong bg-background p-4 text-left transition-colors duration-200 hover:border-survey hover:bg-surface-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Icon className="h-5 w-5 text-survey" strokeWidth={1.6} />
              <h2 className="mt-3 text-13 font-bold text-foreground">{path.title}</h2>
              <p className="mt-1 text-12 leading-5 text-muted-foreground">{path.description}</p>
            </button>
          );
        })}
      </div>

      <div data-testid="survey-operations-list" className="mt-5 overflow-hidden rounded-lg border border-border bg-background">
        <div className="hidden grid-cols-[minmax(0,1fr)_110px_170px_110px] border-b border-border px-5 py-3 text-11 font-semibold text-muted-foreground md:grid">
          <span>问卷</span>
          <span>状态</span>
          <span>回收</span>
          <span aria-hidden="true" />
        </div>

        {error ? (
          <p role="alert" data-testid="err-surveys" className="border-b border-border px-5 py-3 text-13 text-destructive">{error}</p>
        ) : null}

        {loading ? (
          <div className="grid gap-3 p-5" aria-label="正在加载问卷">
            {[0, 1, 2].map((item) => <div key={item} className="h-14 animate-pulse rounded-lg bg-muted" />)}
          </div>
        ) : surveys.length ? (
          <div data-testid="survey-list">
            {surveys.map((survey) => {
              const progress = progressValue(survey);
              return (
                <article
                  key={survey.id}
                  data-testid={`survey-${survey.id}`}
                  className="grid gap-3 border-b border-border px-5 py-4 transition-colors duration-200 last:border-b-0 hover:bg-surface-1 md:grid-cols-[minmax(0,1fr)_110px_170px_110px] md:items-center"
                >
                  <div className="min-w-0">
                    <h2 data-testid={`survey-title-${survey.id}`} className="truncate text-13 font-semibold text-foreground">{survey.title}</h2>
                    <p className="mt-1 truncate text-12 text-muted-foreground">{survey.description || survey.updatedLabel}</p>
                  </div>
                  <Badge
                    data-testid={`survey-status-${survey.id}`}
                    variant={survey.status === "active" ? "success" : "muted"}
                    className="w-fit"
                  >
                    {survey.statusLabel}
                  </Badge>
                  <div>
                    <p data-testid={`survey-responses-${survey.id}`} className="text-12 text-muted-foreground">
                      {survey.responseLimit ? `${survey.responseCount} / ${survey.responseLimit} 份` : `${survey.responseCount} 份 · 未设目标`}
                    </p>
                    {progress != null ? (
                      <progress className="survey-progress mt-2 block h-1.25 w-full" max={100} value={progress} aria-label={`${survey.title} 回收进度`} />
                    ) : null}
                  </div>
                  <Button
                    data-testid={`open-workspace-${survey.id}`}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onOpenSurvey(survey.id)}
                  >
                    {survey.responseCount ? "查看报告" : "继续编辑"}
                  </Button>
                </article>
              );
            })}
          </div>
        ) : (
          <div data-testid="empty" className="flex flex-col items-center px-5 py-10 text-center">
            <FileText className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
            <h2 className="mt-3 text-14 font-semibold text-foreground">还没有问卷</h2>
            <p className="mt-1 text-12 text-muted-foreground">从上方任一方式开始。</p>
          </div>
        )}
      </div>
    </section>
  );
}
