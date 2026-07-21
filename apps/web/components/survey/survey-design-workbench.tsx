"use client";

import {
  ArrowDown,
  ArrowUp,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SurveyAiPanel } from "@/components/survey/survey-ai-panel";
import { buildSurveyDesignSummary } from "@/lib/survey-design-summary";
import { cn } from "@/lib/utils";

type QType =
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
  id: string;
  title: string;
  type: QType;
  required: boolean;
  options: string[];
  category?: string;
}

interface Survey {
  id: number;
  title: string;
}

function QuestionAnswerFields({
  question,
  typeLabel,
  choiceTypes,
  patchQuestion,
  addOption,
  patchOption,
}: {
  question: Question;
  typeLabel: Record<QType, string>;
  choiceTypes: QType[];
  patchQuestion: (id: string, patch: Partial<Question>) => void;
  addOption: (id: string) => void;
  patchOption: (id: string, index: number, value: string) => void;
}) {
  if (choiceTypes.includes(question.type)) {
    return (
      <div className="grid gap-1.5">
        {question.options.map((option, optionIndex) => (
          <div
            key={`${question.id}-${optionIndex}`}
            className="group flex min-w-0 items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-secondary"
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-4 w-4 shrink-0 border border-border-strong bg-background",
                question.type === "multiple" ? "rounded-sm" : "rounded-full"
              )}
            />
            <Input
              aria-label={`选项 ${optionIndex + 1}`}
              value={option}
              onChange={(event) =>
                patchOption(question.id, optionIndex, event.target.value)
              }
              placeholder={`选项 ${optionIndex + 1}`}
              className="h-8 min-w-0 border-transparent bg-transparent px-1 shadow-none hover:border-border focus-visible:bg-background"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`删除选项 ${optionIndex + 1}`}
              title="删除选项"
              onClick={() =>
                patchQuestion(question.id, {
                  options: question.options.filter(
                    (_, index) => index !== optionIndex
                  ),
                })
              }
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => addOption(question.id)}
          className="mt-1 w-fit gap-1.5 text-12 text-muted-foreground"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.6} />
          添加选项
        </Button>
      </div>
    );
  }

  if (
    question.type === "rating" ||
    question.type === "linear_scale" ||
    question.type === "nps"
  ) {
    const values = question.type === "nps" ? [0, 2, 4, 6, 8, 10] : [1, 2, 3, 4, 5];
    return (
      <div className="flex flex-wrap items-center gap-2 py-2">
        <span className="text-12 text-muted-foreground">低</span>
        {values.map((value) => (
          <span
            key={value}
            className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background text-12 text-muted-foreground"
          >
            {value}
          </span>
        ))}
        <span className="text-12 text-muted-foreground">高</span>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-dashed border-border px-3 py-4 text-13 text-muted-foreground">
      {typeLabel[question.type]}回答区域
    </div>
  );
}

export function SurveyDesignWorkbench({
  survey,
  title,
  description,
  questions,
  categories,
  saving,
  saveError,
  actionMessage,
  onTitleChange,
  onDescriptionChange,
  patchQuestion,
  changeQuestionType,
  setQuestionCategory,
  moveQuestion,
  removeQuestion,
  addQuestion,
  addOption,
  patchOption,
  onSave,
  onOpenAi,
  typeLabel,
  typeGroups,
  choiceTypes,
  categoryLabel,
}: {
  survey: Survey;
  title: string;
  description: string;
  questions: Question[];
  categories: string[];
  saving: boolean;
  saveError: string;
  actionMessage: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  patchQuestion: (id: string, patch: Partial<Question>) => void;
  changeQuestionType: (id: string, type: QType) => void;
  setQuestionCategory: (id: string, value: string) => void;
  moveQuestion: (id: string, direction: -1 | 1) => void;
  removeQuestion: (id: string) => void;
  addQuestion: () => void;
  addOption: (id: string) => void;
  patchOption: (id: string, index: number, value: string) => void;
  onSave: () => void;
  onOpenAi: () => void;
  typeLabel: Record<QType, string>;
  typeGroups: Array<{ label: string; types: QType[] }>;
  choiceTypes: QType[];
  categoryLabel: (value: string) => string;
}) {
  const summary = buildSurveyDesignSummary(questions);
  const displayedSegments = summary.segmentVariables.length
    ? summary.segmentVariables
    : summary.categories.slice(0, 2);

  return (
    <div
      data-testid="workspace-design-workbench"
      className="mx-auto grid w-full max-w-survey-editor gap-4 xl:grid-cols-[minmax(0,1fr)_400px]"
    >
      <main className="grid min-w-0 content-start gap-4">
        <section
          data-testid="survey-design-summary"
          className="overflow-hidden rounded-lg border border-border bg-background"
        >
          <div className="h-1.5 bg-survey" />
          <div className="p-5 md:p-6">
            <label htmlFor="workspace-survey-title" className="sr-only">
              问卷标题
            </label>
            <Input
              id="workspace-survey-title"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="未命名问卷"
              className="h-auto border-0 bg-transparent px-0 py-0 text-22 font-bold shadow-none placeholder:text-placeholder focus-visible:border-transparent focus-visible:ring-0"
            />
            <label htmlFor="workspace-survey-description" className="sr-only">
              问卷说明
            </label>
            <Textarea
              id="workspace-survey-description"
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              placeholder="添加问卷说明，例如填写对象、预计用时和收集目的"
              className="mt-2 min-h-10 resize-none border-0 bg-transparent px-0 py-0 text-14 leading-6 shadow-none placeholder:text-placeholder focus-visible:border-transparent focus-visible:ring-0"
            />

            <div className="mt-4 border-t border-border pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-13 text-muted-foreground">诊断维度：</span>
                {summary.categories.length ? (
                  summary.categories.map((category) => (
                    <span
                      key={category}
                      className="rounded-full bg-tag-purple px-3 py-1 text-12 font-medium text-survey"
                    >
                      {categoryLabel(category)}
                    </span>
                  ))
                ) : (
                  <span className="text-12 text-muted-foreground">尚未分类</span>
                )}
                <Badge variant="muted">{summary.questionCount} 题</Badge>
                <Badge variant="muted">
                  约 {summary.estimatedMinutes || 1} 分钟
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-13 text-muted-foreground">分层变量：</span>
                {displayedSegments.length ? (
                  displayedSegments.map((category) => (
                    <span
                      key={category}
                      className="rounded-full border border-survey/20 bg-background px-3 py-1 text-12 text-survey"
                    >
                      {categoryLabel(category)}
                    </span>
                  ))
                ) : (
                  <span className="text-12 text-muted-foreground">
                    为题目设置分类后自动识别
                  </span>
                )}
                <span className="text-12 text-muted-foreground">
                  报告中的图表可按已选变量切片对比
                </span>
              </div>
            </div>
          </div>
        </section>

        {summary.hypotheses.length ? (
          <section
            data-testid="survey-design-hypotheses"
            className="rounded-lg border border-border bg-background p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="text-15 font-bold text-foreground">诊断假设</h2>
                <span className="text-12 text-muted-foreground">
                  报告将根据当前题目形成假设验证章节
                </span>
              </div>
              <span className="text-12 font-medium text-survey">由题目自动生成</span>
            </div>
            <div className="mt-3 divide-y divide-border">
              {summary.hypotheses.map((hypothesis) => (
                <div
                  key={hypothesis.id}
                  className="flex min-w-0 items-center gap-3 py-2.5"
                >
                  <span className="w-6 shrink-0 text-12 font-bold text-placeholder">
                    {hypothesis.id}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-13 text-foreground">
                    {hypothesis.title}
                  </span>
                  {hypothesis.category ? (
                    <span className="shrink-0 rounded-full bg-tag-purple px-2.5 py-1 text-11 font-medium text-survey">
                      {categoryLabel(hypothesis.category)}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className="grid gap-3">
          {questions.map((question, index) => (
            <section
              key={question.id}
              data-testid={`workspace-question-${index}`}
              className="rounded-lg border border-border border-l-4 border-l-survey/30 bg-background p-5 transition-colors focus-within:border-l-survey"
            >
              <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start">
                <span className="shrink-0 pt-2 text-12 font-bold text-placeholder">
                  Q{index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <label className="sr-only" htmlFor={`question-title-${question.id}`}>
                    题目 {index + 1} 标题
                  </label>
                  <Input
                    id={`question-title-${question.id}`}
                    value={question.title}
                    onChange={(event) =>
                      patchQuestion(question.id, { title: event.target.value })
                    }
                    placeholder={`问题 ${index + 1}`}
                    className="h-9 border-transparent bg-transparent px-0 text-15 font-bold shadow-none hover:border-border focus-visible:bg-background"
                  />
                </div>
                <div className="grid shrink-0 grid-cols-2 gap-2 md:w-auto">
                  <label className="sr-only" htmlFor={`question-type-${question.id}`}>
                    题型
                  </label>
                  <Select
                    id={`question-type-${question.id}`}
                    aria-label={`问题 ${index + 1} 题型`}
                    className="h-8 min-w-24 rounded-full border-0 bg-secondary px-3 text-12 shadow-none"
                    value={question.type}
                    onChange={(event) =>
                      changeQuestionType(question.id, event.target.value as QType)
                    }
                  >
                    {typeGroups.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.types.map((type) => (
                          <option key={type} value={type}>
                            {typeLabel[type]}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                  <label className="sr-only" htmlFor={`workflow-category-${index}`}>
                    分类
                  </label>
                  <Select
                    id={`workflow-category-${index}`}
                    aria-label={`问题 ${index + 1} 分类`}
                    className="h-8 min-w-28 rounded-full border-0 bg-tag-purple px-3 text-12 text-survey shadow-none"
                    value={question.category ?? ""}
                    onChange={(event) =>
                      setQuestionCategory(question.id, event.target.value)
                    }
                  >
                    <option value="">未分类</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {categoryLabel(category)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="mt-3 pl-0 md:pl-9">
                <QuestionAnswerFields
                  question={question}
                  typeLabel={typeLabel}
                  choiceTypes={choiceTypes}
                  patchQuestion={patchQuestion}
                  addOption={addOption}
                  patchOption={patchOption}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-end gap-1 border-t border-border pt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={index === 0}
                  onClick={() => moveQuestion(question.id, -1)}
                  className="gap-1.5 text-12"
                >
                  <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.6} />
                  上移
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={index === questions.length - 1}
                  onClick={() => moveQuestion(question.id, 1)}
                  className="gap-1.5 text-12"
                >
                  <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.6} />
                  下移
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeQuestion(question.id)}
                  className="gap-1.5 text-12 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                  删除
                </Button>
                <label className="ml-1 flex cursor-pointer items-center gap-2 text-12 text-muted-foreground">
                  <Input
                    aria-label={`问题 ${index + 1} 必填`}
                    type="checkbox"
                    checked={question.required}
                    onChange={(event) =>
                      patchQuestion(question.id, {
                        required: event.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-survey"
                  />
                  必填
                </label>
              </div>
            </section>
          ))}
        </div>

        <div className="grid gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={addQuestion}
            className="w-full border-dashed border-border-strong bg-background"
          >
            <Plus className="h-4 w-4" strokeWidth={1.6} />
            添加问题
          </Button>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {saveError ? (
                <p role="alert" className="text-13 text-destructive">
                  {saveError}
                </p>
              ) : null}
              {actionMessage ? (
                <p className="text-13 text-muted-foreground">{actionMessage}</p>
              ) : null}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={onSave}
              className="gap-1.5"
            >
              <Save className="h-4 w-4" strokeWidth={1.6} />
              {saving ? "保存中…" : "保存问卷"}
            </Button>
          </div>
        </div>
      </main>

      <div className="min-w-0 xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
        <SurveyAiPanel
          variant="reference"
          intro="左侧始终是可编辑问卷，AI 只生成建议，确认后再应用。"
          contextMessage={`正在优化「${title || survey.title}」，共 ${questions.length} 题。可以补充目标受访者、诊断重点或表达要求。`}
          quickPrompts={[
            "补充关键诊断题目",
            "优化题目表达",
            "检查诊断维度覆盖",
            "生成高管精简版",
          ]}
          placeholder="描述目标、受访者或修改要求…"
          resultLabel="AI 优化建议已生成"
          onSubmit={() => onOpenAi()}
          onPreview={onOpenAi}
          onApply={onOpenAi}
        />
      </div>
    </div>
  );
}
