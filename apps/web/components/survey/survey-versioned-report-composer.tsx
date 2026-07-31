"use client";

import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Check,
  ChevronLeft,
  Clock3,
  FileText,
  ImageIcon,
  Plus,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Trash2,
  Type,
} from "lucide-react";
import type {
  SurveyReportCategoryInput,
  SurveyReportCategoryPlanInput,
} from "@repo/data";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { SurveyReportOutputPreview } from "@/components/survey/survey-report-output-preview";
import {
  addCustomReportCategory,
  areSurveyReportCategoryPlansEqual,
  moveReportCategory,
  normalizeCategoryOrder,
  updateReportCategory,
} from "@/lib/survey-report-category-plan";
import { SURVEY_REPORT_CHART_TEMPLATES } from "@/lib/survey-report-chart-templates";
import { isSurveyReportChartCompatibleQuestionType } from "@/lib/survey-report-evidence";
import {
  getReportGenerationEligibility,
  getReportGenerationStatus,
} from "@/lib/survey-report-composer-state";
import type { SurveyReportGenerationStatus } from "@/lib/survey-report-generation";

interface ReportComposerSurvey {
  id: number;
  title: string;
  description: string;
  responses: number;
}

interface SurveyVersionedReportComposerProps {
  survey: ReportComposerSurvey;
  questions: Array<{
    id: number | string;
    title: string;
    type: string;
  }>;
  plan: SurveyReportCategoryPlanInput;
  generation?: SurveyReportGenerationStatus;
  requirementsChangedOverride?: boolean;
  canManage: boolean;
  saving: boolean;
  classifying: boolean;
  generating: boolean;
  status: string;
  error: string;
  onClassify: (
    instruction: string,
    currentPlan: SurveyReportCategoryPlanInput
  ) => Promise<{
    plan: SurveyReportCategoryPlanInput;
    warning?: string;
  } | null>;
  onSavePlan: (plan: SurveyReportCategoryPlanInput) => void;
  onGenerateReport: () => void;
  onBackToDesign: () => void;
  onOpenCollect: () => void;
}

const OUTPUT_OPTIONS = [
  { value: "image", label: "图片", icon: ImageIcon },
  { value: "chart", label: "图表", icon: BarChart3 },
  { value: "text", label: "文本", icon: Type },
] as const;

const CHART_TEMPLATE_LABELS = {
  "line-simple": "基础折线图",
  "bar-simple": "基础柱状图",
  "pie-simple": "基础饼图",
  "scatter-simple": "基础散点图",
  radar: "雷达图",
  funnel: "漏斗图",
  gauge: "仪表盘",
  "heatmap-cartesian": "热力图",
} as const;

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
  questions,
  plan,
  generation,
  requirementsChangedOverride = false,
  canManage,
  saving,
  classifying,
  generating,
  status,
  error,
  onClassify,
  onSavePlan,
  onGenerateReport,
  onBackToDesign,
  onOpenCollect,
}: SurveyVersionedReportComposerProps) {
  const [draft, setDraft] = useState(plan);
  const [selectedCategoryId, setSelectedCategoryId] = useState(plan.categories[0]?.id ?? "");
  const [aiSuggestion, setAiSuggestion] = useState<{
    plan: SurveyReportCategoryPlanInput;
    warning?: string;
  } | null>(null);
  const [aiInstruction, setAiInstruction] = useState("");

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
  const availableQuestionIds = new Set(
    questions.map((question) => Number(question.id)).filter(Number.isFinite)
  );
  const questionById = new Map(
    questions
      .map((question) => [Number(question.id), question] as const)
      .filter(([questionId]) => Number.isFinite(questionId))
  );
  const missingQuestionIds = selectedCategory?.questionIds.filter(
    (questionId) => !availableQuestionIds.has(Number(questionId))
  ) ?? [];
  const selectedSourceScope = selectedCategory?.questionIds
    .map((questionId) => {
      const questionIndex = questions.findIndex(
        (question) => Number(question.id) === Number(questionId)
      );
      const question = questionById.get(Number(questionId));
      return question
        ? `Q${questionIndex + 1}「${question.title}」`
        : `题目 ${questionId}`;
    })
    .join("、") || "当前章节所选题目";
  const sourceValidationErrors = categories.flatMap((category) => {
    if (!category.questionIds.length) {
      return [{
        categoryId: category.id,
        message: `章节「${category.name}」至少需要选择一道分析题目。`,
      }];
    }
    const unavailable = category.questionIds.filter(
      (questionId) => !questionById.has(Number(questionId))
    );
    if (unavailable.length) {
      return [{
        categoryId: category.id,
        message: `章节「${category.name}」包含已失效的题目引用。`,
      }];
    }
    if (category.outputType === "chart") {
      const compatible = category.questionIds.some((questionId) => {
        const question = questionById.get(Number(questionId));
        return question
          ? isSurveyReportChartCompatibleQuestionType(question.type)
          : false;
      });
      if (!compatible) {
        return [{
          categoryId: category.id,
          message: `章节「${category.name}」需要选择至少一道可生成分布图表的题目。`,
        }];
      }
    }
    if (category.outputType === "text") {
      const hasAggregateEvidence = category.questionIds.some((questionId) => {
        const question = questionById.get(Number(questionId));
        return question
          ? isSurveyReportChartCompatibleQuestionType(question.type)
          : false;
      });
      if (!hasAggregateEvidence) {
        return [{
          categoryId: category.id,
          message: `章节「${category.name}」需要选择至少一道可形成匿名聚合证据的题目。`,
        }];
      }
    }
    return [];
  });
  const selectedSourceValidation = sourceValidationErrors.find(
    (validation) => validation.categoryId === selectedCategory?.id
  );
  const hasSourceValidationErrors = sourceValidationErrors.length > 0;
  const draftDirty = !areSurveyReportCategoryPlansEqual(draft, plan);
  const generationEligibility = getReportGenerationEligibility({
    draftDirty,
    saving,
    generating,
  });
  const reportState = getReportGenerationStatus(
    generation,
    draftDirty,
    requirementsChangedOverride
  );
  const draftEditingDisabled = saving || !canManage;

  function patchSelected(patch: Partial<SurveyReportCategoryInput>) {
    if (draftEditingDisabled || !selectedCategory) return;
    setDraft((current) =>
      updateReportCategory(current, selectedCategory.id, patch)
    );
  }

  function addCategory() {
    if (draftEditingDisabled) return;
    const next = addCustomReportCategory(draft, "新增章节");
    setDraft(next);
    setSelectedCategoryId(next.categories.at(-1)?.id ?? "");
  }

  function removeSelectedCategory() {
    if (draftEditingDisabled || !selectedCategory || categories.length <= 1) return;
    const nextCategories = normalizeCategoryOrder(
      categories.filter((category) => category.id !== selectedCategory.id)
    );
    setDraft({ ...draft, categories: nextCategories });
    setSelectedCategoryId(nextCategories[0]?.id ?? "");
  }

  function moveSelectedCategory(direction: -1 | 1) {
    if (draftEditingDisabled || !selectedCategory) return;
    setDraft(moveReportCategory(draft, selectedCategory.id, direction));
  }

  function saveDraft() {
    if (!canManage || saving || generating || classifying || hasSourceValidationErrors) return;
    onSavePlan(draft);
  }

  function toggleQuestion(questionId: number | string) {
    if (draftEditingDisabled || !selectedCategory) return;
    const normalizedId = Number(questionId);
    if (!Number.isFinite(normalizedId)) return;
    const selected = new Set(selectedCategory.questionIds);
    if (selected.has(normalizedId)) selected.delete(normalizedId);
    else selected.add(normalizedId);
    patchSelected({ questionIds: Array.from(selected) });
  }

  async function requestAiSuggestion() {
    if (!canManage || classifying || saving || generating || !aiInstruction.trim()) return;
    const suggestion = await onClassify(aiInstruction.trim(), draft);
    if (suggestion) setAiSuggestion(suggestion);
  }

  function applyAiSuggestion() {
    if (!canManage || !aiSuggestion) return;
    setDraft(aiSuggestion.plan);
    setSelectedCategoryId(aiSuggestion.plan.categories[0]?.id ?? "");
    setAiSuggestion(null);
  }

  return (
    <div
      data-testid="workspace-report-composer"
      aria-busy={saving}
      className="grid w-full gap-4 pb-8"
    >
      <header
        data-testid="template-workspace-intro"
        className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background px-5 py-4"
      >
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
        {!canManage ? <Badge variant="muted">只读权限</Badge> : null}
        {canManage ? <div className="flex flex-wrap items-center gap-2">
          <Button
            data-testid="template-continue-publish"
            type="button"
            size="sm"
            variant="ghost"
            onClick={onOpenCollect}
          >
            继续发布
            <Send className="h-4 w-4" strokeWidth={1.6} />
          </Button>
        </div> : null}
      </header>

      {canManage ? <section
        data-testid="report-ai-iteration"
        className="grid gap-3 border border-survey/20 bg-survey/5 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
      >
        <div className="grid gap-2">
          <Label htmlFor="report-ai-instruction">与 AI 迭代模板</Label>
          <Textarea
            id="report-ai-instruction"
            data-testid="report-ai-instruction"
            value={aiInstruction}
            maxLength={1200}
            disabled={saving || generating || classifying}
            onChange={(event) => setAiInstruction(event.target.value)}
            placeholder="例如：面向咨询公司领导，合并重复章节，增加续约风险与行动优先级分析。"
            className="min-h-20 resize-y bg-background"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={
            classifying || saving || generating || !aiInstruction.trim()
          }
          onClick={() => void requestAiSuggestion()}
          className="border-survey/30 bg-background text-survey hover:bg-survey/10 hover:text-survey"
        >
          <Sparkles className="h-4 w-4" strokeWidth={1.6} />
          {classifying ? "推演中..." : "生成变更预览"}
        </Button>
      </section> : null}

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
      {saving ? (
        <p data-testid="report-plan-saving" role="status" className="text-12 text-muted-foreground">
          正在保存报告要求，编辑已暂时锁定。
        </p>
      ) : null}

      <section
        data-testid="report-template-builder"
        className="grid min-w-0 gap-4 overflow-x-hidden xl:h-[calc(100vh-11rem)] xl:max-h-[calc(100vh-11rem)] xl:grid-cols-[240px_minmax(360px,0.9fr)_minmax(480px,1.1fr)]"
      >
        <aside
          data-testid="report-module-list"
          className="flex min-w-0 flex-col self-start overflow-hidden border border-border bg-background xl:h-full"
        >
          <div className="border-b border-border px-4 py-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-14 font-bold text-foreground">报告章节</h3>
                <p className="mt-1 text-11 text-muted-foreground">{categories.length} 个章节</p>
              </div>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="添加章节" disabled={draftEditingDisabled} onClick={addCategory}>
                <Plus className="h-4 w-4" strokeWidth={1.7} />
              </Button>
            </div>
          </div>
          <div className="grid min-h-0 gap-px overflow-y-auto bg-border">
            {categories.map((category, index) => {
              const active = category.id === selectedCategory?.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(category.id)}
                  className={[
                    "grid min-w-0 grid-cols-[32px_minmax(0,1fr)_24px] items-center gap-2 bg-background px-3 py-3 text-left transition-colors",
                    active
                      ? "border-l-2 border-survey bg-survey/5 text-foreground"
                      : "hover:bg-secondary",
                  ].join(" ")}
                >
                  <span className={[
                    "grid h-8 w-8 place-items-center rounded-md text-12 font-bold",
                    active ? "bg-survey/15 text-survey" : "bg-muted text-foreground",
                  ].join(" ")}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-13 font-semibold">{category.name}</span>
                    <span className="mt-0.5 block truncate text-11 text-muted-foreground">
                      {category.requirement?.trim() ? "要求已定义" : "待补充要求"}
                    </span>
                  </span>
                  <FileText className="h-4 w-4 opacity-60" strokeWidth={1.5} />
                </button>
              );
            })}
          </div>
          <Button type="button" variant="ghost" className="h-11 w-full rounded-none border-t border-border" disabled={draftEditingDisabled} onClick={addCategory}>
            <Plus className="h-4 w-4" strokeWidth={1.7} />
            添加章节
          </Button>
        </aside>

        <main
          data-testid="report-requirement-panel"
          className="flex min-w-0 flex-col self-start overflow-hidden border border-border bg-background xl:h-full"
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
                      disabled={draftEditingDisabled || selectedCategory.order === 1}
                      onClick={() => moveSelectedCategory(-1)}
                    >
                      <ArrowUp className="h-4 w-4" strokeWidth={1.7} />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label="章节下移"
                      disabled={draftEditingDisabled || selectedCategory.order === categories.length}
                      onClick={() => moveSelectedCategory(1)}
                    >
                      <ArrowDown className="h-4 w-4" strokeWidth={1.7} />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label="删除章节"
                      disabled={draftEditingDisabled || categories.length <= 1}
                      onClick={removeSelectedCategory}
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.7} />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid min-h-0 gap-5 overflow-y-auto p-5">
                <div className="grid gap-2">
                  <Label htmlFor="report-category-name">章节标题</Label>
                  <Input
                    id="report-category-name"
                    value={selectedCategory.name}
                    maxLength={48}
                    disabled={draftEditingDisabled}
                    onChange={(event) => patchSelected({ name: event.target.value })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>章节输出</Label>
                  <div
                    data-testid="report-output-type"
                    role="group"
                    aria-label="章节输出类型"
                    className="grid grid-cols-3 border border-border bg-secondary/30 p-1"
                  >
                    {OUTPUT_OPTIONS.map((option) => {
                      const active = selectedCategory.outputType === option.value;
                      const Icon = option.icon;
                      return (
                        <Button
                          key={option.value}
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-pressed={active}
                          disabled={draftEditingDisabled}
                          className={active
                            ? "min-w-0 rounded-md border border-survey/30 bg-survey/5 px-2 text-survey hover:bg-survey/10 hover:text-survey"
                            : "min-w-0 rounded-md px-2"}
                          onClick={() => patchSelected({
                            outputType: option.value,
                            inputModes: [option.value],
                            chartTemplateId:
                              option.value === "chart"
                                ? selectedCategory.chartTemplateId ?? "line-simple"
                                : undefined,
                          })}
                        >
                          <Icon className="h-4 w-4 shrink-0" strokeWidth={1.7} />
                          <span className="truncate">{option.label}</span>
                          {active ? <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2} /> : null}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {selectedCategory.outputType === "chart" ? (
                  <div className="grid gap-2">
                    <Label>图表模板</Label>
                    <div
                      role="group"
                      aria-label="图表模板"
                      className="grid grid-cols-2 gap-2"
                    >
                      {SURVEY_REPORT_CHART_TEMPLATES.map((template) => {
                        const active =
                          (selectedCategory.chartTemplateId ?? "line-simple") === template.id;
                        return (
                          <Button
                            key={template.id}
                            type="button"
                            variant="outline"
                            aria-pressed={active}
                            disabled={draftEditingDisabled}
                            className={active
                              ? "h-auto min-w-0 justify-between whitespace-normal border-survey/30 bg-survey/5 px-3 py-2 text-left text-survey hover:bg-survey/10 hover:text-survey"
                              : "h-auto min-w-0 justify-between whitespace-normal px-3 py-2 text-left"}
                            onClick={() => patchSelected({ chartTemplateId: template.id })}
                          >
                            <span className="min-w-0">
                              <span className="block text-12 font-semibold">
                                {CHART_TEMPLATE_LABELS[template.id]}
                              </span>
                              <span className="mt-0.5 block text-10 font-normal">
                                {template.id}
                              </span>
                            </span>
                            {active ? <Check className="h-4 w-4 shrink-0" strokeWidth={2} /> : null}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-2">
                  <Label htmlFor="report-analysis-objective">分析目标</Label>
                  <Input
                    id="report-analysis-objective"
                    data-testid="report-analysis-objective-input"
                    maxLength={500}
                    value={selectedCategory.analysisObjective ?? ""}
                    disabled={draftEditingDisabled}
                    onChange={(event) => patchSelected({
                      analysisObjective: event.target.value,
                    })}
                    placeholder="本章要回答的独立决策问题"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="report-analysis-method">分析方法</Label>
                  <Textarea
                    id="report-analysis-method"
                    data-testid="report-analysis-method-input"
                    className="min-h-24 resize-y text-13 leading-6"
                    maxLength={1000}
                    value={selectedCategory.analysisMethod ?? ""}
                    disabled={draftEditingDisabled}
                    onChange={(event) => patchSelected({
                      analysisMethod: event.target.value,
                    })}
                    placeholder="说明使用哪些题目、采用何种比较或交叉分析方法"
                  />
                </div>

                <div
                  data-testid="report-question-sources"
                  className="grid gap-3 border border-border bg-secondary/30 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-12 font-semibold text-foreground">分析题目</p>
                      <p className="mt-1 text-11 leading-5 text-muted-foreground">
                        同一道题可用于多个章节，组合题目可形成交叉维度分析。
                      </p>
                    </div>
                    <Badge variant="muted">
                      已选择 {selectedCategory.questionIds.length} 题
                    </Badge>
                  </div>
                  <div className="grid max-h-48 gap-1 overflow-y-auto">
                    {questions.map((question, index) => {
                      const normalizedId = Number(question.id);
                      const checked = selectedCategory.questionIds.includes(normalizedId);
                      const chartCompatible =
                        isSurveyReportChartCompatibleQuestionType(question.type);
                      return (
                        <label
                          key={`${question.id}-${index}`}
                          className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 transition-colors hover:bg-background"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={
                              draftEditingDisabled
                              || !Number.isFinite(normalizedId)
                              || (
                                selectedCategory.outputType === "chart"
                                && !chartCompatible
                                && !checked
                              )
                            }
                            onChange={() => toggleQuestion(question.id)}
                            className="mt-0.5 h-4 w-4 accent-survey"
                          />
                          <span className="min-w-0">
                            <span className="block text-12 font-medium text-foreground">
                              Q{index + 1} · {question.title}
                            </span>
                            <span className="mt-0.5 block text-10 text-muted-foreground">
                              {question.type}
                              {selectedCategory.outputType === "chart" && !chartCompatible
                                ? " · 不支持图表"
                                : ""}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {missingQuestionIds.length ? (
                    <div
                      data-testid="report-missing-question-references"
                      role="alert"
                      className="border border-destructive/30 bg-destructive/5 px-3 py-2 text-11 leading-5 text-foreground"
                    >
                      <p className="font-semibold">有题目引用需要修复</p>
                      <p className="text-muted-foreground">
                        题目 ID {missingQuestionIds.join("、")} 已被删除或当前不可访问。
                        系统会保留原引用，不会自动替换；请取消引用或选择其他题目后保存。
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {missingQuestionIds.map((questionId) => (
                          <Button
                            key={questionId}
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={draftEditingDisabled}
                            onClick={() => toggleQuestion(questionId)}
                          >
                            移除题目 ID {questionId}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {selectedSourceValidation && !missingQuestionIds.length ? (
                    <div
                      data-testid="report-source-validation"
                      role="alert"
                      className="border border-destructive/30 bg-destructive/5 px-3 py-2 text-11 leading-5 text-foreground"
                    >
                      {selectedSourceValidation.message}
                    </div>
                  ) : null}
                  {questions.length === 0 ? (
                    <p className="text-12 text-muted-foreground">
                      请先在“设计问卷”中保存题目。
                    </p>
                  ) : null}
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
                    disabled={draftEditingDisabled}
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
                    disabled={
                      !canManage
                      || saving
                      || generating
                      || classifying
                      || hasSourceValidationErrors
                    }
                    onClick={saveDraft}
                  >
                    <Save className="h-4 w-4" strokeWidth={1.7} />
                    {saving ? "保存中..." : "保存要求"}
                  </Button>
                  <Button
                    data-testid="generate-versioned-report"
                    type="button"
                    disabled={
                      !canManage
                      || !generationEligibility.canGenerate
                      || hasSourceValidationErrors
                    }
                    onClick={() => {
                      if (
                        canManage
                        && generationEligibility.canGenerate
                        && !hasSourceValidationErrors
                      ) {
                        onGenerateReport();
                      }
                    }}
                  >
                    <RefreshCw className={generating ? "h-4 w-4 animate-spin" : "h-4 w-4"} strokeWidth={1.7} />
                    {generating
                      ? "生成中..."
                      : !generationEligibility.canGenerate
                        ? "请先保存要求"
                      : generation?.latestArtifact
                        ? "生成新版本"
                        : "生成报告"}
                  </Button>
                </div>
                {!generationEligibility.canGenerate && generationEligibility.message ? (
                  <p data-testid="report-generation-eligibility" className="text-11 text-muted-foreground">
                    {generationEligibility.message}
                  </p>
                ) : hasSourceValidationErrors ? (
                  <p data-testid="report-generation-eligibility" className="text-11 text-destructive">
                    {sourceValidationErrors[0]?.message}
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-13 text-muted-foreground">添加一个章节后开始定义报告要求。</div>
          )}
        </main>

        <aside
          data-testid="report-preview-panel"
          className="flex min-w-0 flex-col self-start border border-border bg-background xl:h-full xl:min-h-0"
        >
          <div
            data-testid="report-generation-status"
            role="status"
            aria-live="polite"
            className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-14 font-bold text-foreground">章节效果预览</h3>
                <Badge variant={reportState.variant}>{reportState.label}</Badge>
              </div>
              <p className="mt-1 text-11 leading-5 text-muted-foreground">{reportState.detail}</p>
            </div>
            <div className="flex items-center gap-2">
              {generation?.latestArtifact ? (
                <p className="flex items-center gap-1 text-11 text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" strokeWidth={1.6} />
                  {formatVersionTime(generation.latestArtifact.createdAt)}
                </p>
              ) : null}
              <a
                data-testid="open-analysis-report"
                href={`/surveys?survey=${survey.id}&step=report`}
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                <FileText className="h-4 w-4" strokeWidth={1.6} />
                查看分析报告
              </a>
            </div>
          </div>

          <div className="min-h-96 min-w-0 overflow-y-auto bg-secondary/20 p-5 xl:min-h-0 xl:max-h-full xl:flex-1">
            {selectedCategory ? (
              <SurveyReportOutputPreview
                category={selectedCategory}
                responseCount={survey.responses}
                sourceScope={selectedSourceScope}
              />
            ) : (
              <div className="grid min-h-96 place-items-center px-8 text-center">
                <div>
                  <FileText className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.3} />
                  <h4 className="mt-4 text-15 font-bold text-foreground">尚无章节</h4>
                  <p className="mx-auto mt-2 max-w-sm text-12 leading-6 text-muted-foreground">
                    添加章节后可在这里预览当前输出配置。
                  </p>
                </div>
              </div>
            )}
          </div>

        </aside>
      </section>

      <Dialog
        open={canManage && Boolean(aiSuggestion)}
        onClose={() => setAiSuggestion(null)}
        title="预览 AI 模板建议"
        description="AI 不会直接覆盖当前模板。确认后建议才会进入草稿，仍需保存才会持久化。"
        testId="report-ai-change-preview"
        className="max-h-[85vh] max-w-2xl overflow-y-auto"
        footer={(
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAiSuggestion(null)}
            >
              保留当前模板
            </Button>
            <Button type="button" onClick={applyAiSuggestion}>
              <Check className="h-4 w-4" strokeWidth={1.7} />
              应用建议
            </Button>
          </>
        )}
      >
        {aiSuggestion ? (
          <div className="grid gap-4">
            <div className="border border-border bg-secondary/30 p-4">
              <p className="text-15 font-bold text-foreground">
                {aiSuggestion.plan.title}
              </p>
              <p className="mt-1 text-12 leading-5 text-muted-foreground">
                {aiSuggestion.plan.description}
              </p>
              <p className="mt-3 text-12 font-semibold text-survey">
                {aiSuggestion.plan.categories.length} 个章节
              </p>
            </div>
            <div className="grid gap-2">
              {aiSuggestion.plan.categories
                .slice()
                .sort((left, right) => left.order - right.order)
                .map((category, index) => (
                  <div
                    key={category.id}
                    className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 border-b border-border px-1 py-3 last:border-b-0"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-md bg-survey/10 text-11 font-bold text-survey">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p className="text-13 font-semibold text-foreground">
                        {category.name}
                      </p>
                      <p className="mt-1 text-11 leading-5 text-muted-foreground">
                        {category.questionIds.length} 道题 · {
                          category.outputType === "chart"
                            ? "图表"
                            : category.outputType === "image"
                              ? "图片"
                              : "文本"
                        }
                      </p>
                    </div>
                  </div>
                ))}
            </div>
            {aiSuggestion.warning ? (
              <p className="text-12 text-muted-foreground">
                {aiSuggestion.warning}
              </p>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
