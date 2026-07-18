"use client";

import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  Clock3,
  FileText,
  History,
  Plus,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import type {
  SurveyReportCategoryInput,
  SurveyReportCategoryPlanInput,
} from "@repo/data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProfessionalReportDocument } from "@/components/survey/professional-report-document";
import {
  addCustomReportCategory,
  moveReportCategory,
  normalizeCategoryOrder,
  updateReportCategory,
} from "@/lib/survey-report-category-plan";
import type { SurveyReportGenerationStatus } from "@/lib/survey-report-generation";
import type { ProfessionalSurveyReportDocument } from "@/lib/survey-professional-report";

interface ReportComposerSurvey {
  id: number;
  title: string;
  description: string;
  responses: number;
}

interface SurveyVersionedReportComposerProps {
  survey: ReportComposerSurvey;
  plan: SurveyReportCategoryPlanInput;
  professionalReport?: ProfessionalSurveyReportDocument;
  generation?: SurveyReportGenerationStatus;
  saving: boolean;
  classifying: boolean;
  generating: boolean;
  status: string;
  error: string;
  onClassify: () => void;
  onSavePlan: (plan: SurveyReportCategoryPlanInput) => void;
  onGenerateReport: () => void;
  onSelectVersion: (artifactId: string) => void;
  onBackToDesign: () => void;
  onOpenCollect: () => void;
}

function generationLabel(generation?: SurveyReportGenerationStatus) {
  if (!generation?.latestArtifact) {
    return { label: "尚未生成", detail: "保存要求后，手动生成首个可追溯报告版本。", variant: "muted" as const };
  }
  if (generation.stale) {
    const count = generation.latestArtifact.newResponseCount;
    return {
      label: "数据有更新",
      detail: count > 0 ? `新增 ${count} 份答卷，当前展示最近成功版本。` : "事实库已变化，建议生成新版本。",
      variant: "destructive" as const,
    };
  }
  if (generation.requirementChanged) {
    return {
      label: "要求已修改",
      detail: "当前展示最近成功版本，保存并生成后应用新要求。",
      variant: "outline" as const,
    };
  }
  return { label: "最新版本", detail: "当前报告与问卷事实库及章节要求一致。", variant: "success" as const };
}

function formatVersionTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SurveyVersionedReportComposer({
  survey,
  plan,
  professionalReport,
  generation,
  saving,
  classifying,
  generating,
  status,
  error,
  onClassify,
  onSavePlan,
  onGenerateReport,
  onSelectVersion,
  onBackToDesign,
  onOpenCollect,
}: SurveyVersionedReportComposerProps) {
  const [draft, setDraft] = useState(plan);
  const [selectedCategoryId, setSelectedCategoryId] = useState(plan.categories[0]?.id ?? "");

  useEffect(() => {
    setDraft(plan);
    setSelectedCategoryId((current) =>
      plan.categories.some((category) => category.id === current)
        ? current
        : plan.categories[0]?.id ?? ""
    );
  }, [plan, survey.id]);

  const categories = draft.categories.slice().sort((left, right) => left.order - right.order);
  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) ?? categories[0];
  const reportState = generationLabel(generation);

  function patchSelected(patch: Partial<SurveyReportCategoryInput>) {
    if (!selectedCategory) return;
    setDraft((current) =>
      updateReportCategory(current, selectedCategory.id, patch)
    );
  }

  function addCategory() {
    const next = addCustomReportCategory(draft, "新增章节");
    setDraft(next);
    setSelectedCategoryId(next.categories.at(-1)?.id ?? "");
  }

  function removeSelectedCategory() {
    if (!selectedCategory || categories.length <= 1) return;
    const nextCategories = normalizeCategoryOrder(
      categories.filter((category) => category.id !== selectedCategory.id)
    );
    setDraft({ ...draft, categories: nextCategories });
    setSelectedCategoryId(nextCategories[0]?.id ?? "");
  }

  return (
    <div data-testid="workspace-report-composer" className="mx-auto grid w-full max-w-screen-2xl gap-5 px-4 pb-8 pt-2 md:px-7">
      <header className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" variant="outline" onClick={onBackToDesign}>
          <ChevronLeft className="h-4 w-4" strokeWidth={1.7} />
          返回模版
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-18 font-bold text-foreground">报告模版 · {survey.title}</h2>
          <p className="mt-1 text-12 text-muted-foreground">
            用自然语言定义每个章节；生成时系统从整份问卷和全部授权答卷中检索证据。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={classifying} onClick={onClassify}>
            <Sparkles className="h-4 w-4" strokeWidth={1.6} />
            {classifying ? "推演中..." : "AI 重新推演"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onOpenCollect}>
            继续发布
            <Send className="h-4 w-4" strokeWidth={1.6} />
          </Button>
        </div>
      </header>

      {(status || error) && (
        <div
          role={error ? "alert" : "status"}
          className={error
            ? "border border-destructive/30 bg-destructive/5 px-4 py-3 text-13 text-destructive"
            : "border border-success/30 bg-success/5 px-4 py-3 text-13 text-foreground"}
        >
          {error || status}
        </div>
      )}

      <section
        data-testid="report-template-builder"
        className="grid min-w-0 gap-4 xl:grid-cols-[240px_minmax(300px,0.8fr)_minmax(420px,1.2fr)]"
      >
        <aside
          data-testid="report-module-list"
          className="min-w-0 self-start overflow-hidden border border-border bg-background xl:sticky xl:top-4"
        >
          <div className="border-b border-border px-4 py-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-14 font-bold text-foreground">报告章节</h3>
                <p className="mt-1 text-11 text-muted-foreground">{categories.length} 个章节</p>
              </div>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="添加章节" onClick={addCategory}>
                <Plus className="h-4 w-4" strokeWidth={1.7} />
              </Button>
            </div>
          </div>
          <div className="grid gap-px bg-border">
            {categories.map((category, index) => {
              const active = category.id === selectedCategory?.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(category.id)}
                  className={[
                    "grid min-w-0 grid-cols-[32px_minmax(0,1fr)_24px] items-center gap-2 bg-background px-3 py-3 text-left transition-colors",
                    active ? "bg-foreground text-background" : "hover:bg-secondary",
                  ].join(" ")}
                >
                  <span className={[
                    "grid h-8 w-8 place-items-center rounded-md text-12 font-bold",
                    active ? "bg-background text-foreground" : "bg-muted text-foreground",
                  ].join(" ")}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-13 font-semibold">{category.name}</span>
                    <span className={active ? "mt-0.5 block truncate text-11 text-background/65" : "mt-0.5 block truncate text-11 text-muted-foreground"}>
                      {category.requirement?.trim() ? "要求已定义" : "待补充要求"}
                    </span>
                  </span>
                  <FileText className="h-4 w-4 opacity-60" strokeWidth={1.5} />
                </button>
              );
            })}
          </div>
          <Button type="button" variant="ghost" className="h-11 w-full rounded-none border-t border-border" onClick={addCategory}>
            <Plus className="h-4 w-4" strokeWidth={1.7} />
            添加章节
          </Button>
        </aside>

        <main
          data-testid="report-requirement-panel"
          className="min-w-0 self-start border border-border bg-background"
        >
          {selectedCategory ? (
            <>
              <div className="border-b border-border px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-11 text-muted-foreground">章节 {selectedCategory.order}</p>
                    <h3 className="mt-1 text-15 font-bold text-foreground">分析要求</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label="章节上移"
                      disabled={selectedCategory.order === 1}
                      onClick={() => setDraft(moveReportCategory(draft, selectedCategory.id, -1))}
                    >
                      <ArrowUp className="h-4 w-4" strokeWidth={1.7} />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label="章节下移"
                      disabled={selectedCategory.order === categories.length}
                      onClick={() => setDraft(moveReportCategory(draft, selectedCategory.id, 1))}
                    >
                      <ArrowDown className="h-4 w-4" strokeWidth={1.7} />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label="删除章节"
                      disabled={categories.length <= 1}
                      onClick={removeSelectedCategory}
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.7} />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid gap-5 p-5">
                <div className="grid gap-2">
                  <Label htmlFor="report-category-name">章节标题</Label>
                  <Input
                    id="report-category-name"
                    value={selectedCategory.name}
                    maxLength={48}
                    onChange={(event) => patchSelected({ name: event.target.value })}
                  />
                </div>

                <div className="border-l-2 border-foreground bg-secondary/50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.6} />
                    <p className="text-12 font-semibold text-foreground">数据范围</p>
                  </div>
                  <p className="mt-2 text-12 leading-5 text-muted-foreground">
                    整份问卷与全部授权答卷。生成模块会按本章要求自主检索所需证据，无需逐题指定。
                  </p>
                  <p className="mt-1 text-11 text-muted-foreground">
                    当前 {survey.responses} 份答卷，内容变化时自动形成新的事实库修订。
                  </p>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-end justify-between gap-3">
                    <Label htmlFor="report-category-requirement">自然语言要求</Label>
                    <span className="text-11 text-muted-foreground">
                      {(selectedCategory.requirement ?? selectedCategory.prompt).length}/2000
                    </span>
                  </div>
                  <Textarea
                    id="report-category-requirement"
                    data-testid="report-requirement-input"
                    className="min-h-48 resize-y text-13 leading-6"
                    maxLength={2000}
                    value={selectedCategory.requirement ?? selectedCategory.prompt}
                    onChange={(event) => patchSelected({
                      requirement: event.target.value,
                      prompt: event.target.value,
                    })}
                    placeholder="描述读者、决策目标、必须回答的问题、证据边界和表达要求。"
                  />
                  <p className="text-11 leading-5 text-muted-foreground">
                    例如：面向管理层，先给结论；所有判断标注样本量和限制，并给出按优先级排序的行动建议。
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    data-testid="save-report-plan"
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() => onSavePlan(draft)}
                  >
                    <Save className="h-4 w-4" strokeWidth={1.7} />
                    {saving ? "保存中..." : "保存要求"}
                  </Button>
                  <Button
                    data-testid="generate-versioned-report"
                    type="button"
                    disabled={generating}
                    onClick={onGenerateReport}
                  >
                    <RefreshCw className={generating ? "h-4 w-4 animate-spin" : "h-4 w-4"} strokeWidth={1.7} />
                    {generating
                      ? "生成中..."
                      : generation?.latestArtifact
                        ? "生成新版本"
                        : "生成报告"}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-13 text-muted-foreground">添加一个章节后开始定义报告要求。</div>
          )}
        </main>

        <aside
          data-testid="report-preview-panel"
          className="min-w-0 self-start overflow-hidden border border-border bg-background xl:sticky xl:top-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-14 font-bold text-foreground">报告预览</h3>
                <Badge variant={reportState.variant}>{reportState.label}</Badge>
              </div>
              <p className="mt-1 text-11 leading-5 text-muted-foreground">{reportState.detail}</p>
            </div>
            {generation?.latestArtifact ? (
              <p className="flex items-center gap-1 text-11 text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" strokeWidth={1.6} />
                {formatVersionTime(generation.latestArtifact.createdAt)}
              </p>
            ) : null}
          </div>

          <div className="max-h-[45rem] min-h-96 overflow-y-auto bg-secondary/20">
            {professionalReport ? (
              <ProfessionalReportDocument report={professionalReport} />
            ) : (
              <div className="grid min-h-96 place-items-center px-8 text-center">
                <div>
                  <FileText className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.3} />
                  <h4 className="mt-4 text-15 font-bold text-foreground">尚无报告版本</h4>
                  <p className="mx-auto mt-2 max-w-sm text-12 leading-6 text-muted-foreground">
                    保存章节要求并点击生成。没有新答卷或要求变化时，系统会直接复用相同版本。
                  </p>
                </div>
              </div>
            )}
          </div>

          <details data-testid="report-version-history" className="border-t border-border bg-background">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
              <span className="flex items-center gap-2 text-13 font-semibold text-foreground">
                <History className="h-4 w-4" strokeWidth={1.6} />
                历史版本
              </span>
              <span className="text-11 text-muted-foreground">{generation?.versions.length ?? 0} 个版本</span>
            </summary>
            <div className="grid gap-px border-t border-border bg-border">
              {generation?.versions.length ? generation.versions.map((version, index) => (
                <button
                  key={version.id}
                  type="button"
                  className="flex items-center justify-between gap-3 bg-background px-5 py-3 text-left transition-colors hover:bg-secondary"
                  onClick={() => onSelectVersion(version.id)}
                >
                  <span>
                    <span className="block text-12 font-semibold text-foreground">
                      版本 {generation.versions.length - index}
                    </span>
                    <span className="mt-0.5 block text-11 text-muted-foreground">
                      {version.responseCount} 份答卷 · {formatVersionTime(version.createdAt)}
                    </span>
                  </span>
                  {version.id === generation.currentArtifact?.id ? <Badge variant="success">当前</Badge> : null}
                </button>
              )) : (
                <p className="bg-background px-5 py-4 text-12 text-muted-foreground">生成后可在这里切换历史版本。</p>
              )}
            </div>
          </details>
        </aside>
      </section>
    </div>
  );
}
