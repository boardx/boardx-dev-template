"use client";
import { useEffect, useState } from "react";
import { PanelRightOpen, Plus, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SurveyAiPanel } from "@/components/survey/survey-ai-panel";
import { SurveyOutlinePanel } from "@/components/survey/survey-outline-panel";

type QType = "short_text" | "text" | "email" | "number" | "phone" | "single" | "multiple" | "dropdown" | "rating" | "linear_scale" | "nps" | "date" | "time" | "file";
interface Question { id: string; title: string; type: QType; required: boolean; options: string[]; category?: string }
interface Survey { id: number; title: string }

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
  onOpenAnswer,
  onOpenTemplate,
  typeLabel,
  typeGroups,
  choiceTypes,
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
  onOpenAnswer: () => void;
  onOpenTemplate: () => void;
  typeLabel: Record<QType, string>;
  typeGroups: Array<{ label: string; types: QType[] }>;
  choiceTypes: QType[];
}) {
  const [outlineCollapsed, setOutlineCollapsed] = useState(false);
  const [aiCollapsed, setAiCollapsed] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState(questions[0]?.id ?? "");

  useEffect(() => {
    if (!questions.some((question) => question.id === selectedQuestionId)) {
      setSelectedQuestionId(questions[0]?.id ?? "");
    }
  }, [questions, selectedQuestionId]);

  return (
    <div data-testid="workspace-design-workbench" className="grid gap-3">
      <div className={aiCollapsed ? "grid min-w-0 xl:grid-cols-[auto_minmax(0,1fr)_auto]" : "grid min-w-0 xl:grid-cols-[auto_minmax(0,1fr)_320px]"}>
        <SurveyOutlinePanel
          title="题目大纲"
          items={questions.map((question) => ({ id: question.id, label: question.title || "未命名问题", meta: typeLabel[question.type] }))}
          selectedId={selectedQuestionId}
          collapsed={outlineCollapsed}
          onToggle={() => setOutlineCollapsed((collapsed) => !collapsed)}
          onSelect={setSelectedQuestionId}
          footer={<Button type="button" size="sm" variant="outline" className="mt-2 w-full border-dashed" onClick={addQuestion}><Plus className="h-4 w-4" />添加问题</Button>}
        />
        <section className="grid gap-2.5">
          <div className="rounded-lg border border-border bg-background p-3">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <Badge variant="outline">Design</Badge>
                <h2 className="mt-1.5 text-17 font-bold text-foreground">{title || survey.title}</h2>
                <p className="text-12 text-muted-foreground">维护题目、分类和问卷基础信息。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={onOpenAnswer}>
                  预览答题
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={saving} onClick={onSave}>
                  {saving ? "保存中…" : "保存"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onOpenTemplate}
                  className="gap-1.5 border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background focus-visible:ring-foreground/30"
                >
                  下一步
                  <Send className="h-4 w-4" strokeWidth={1.6} />
                </Button>
              </div>
            </div>
            <Label className="text-12 text-muted-foreground" htmlFor="workspace-survey-title">
              问卷标题
            </Label>
            <Input
              id="workspace-survey-title"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              className="mt-1.5 h-10"
            />
            <Label className="mt-3 block text-12 text-muted-foreground" htmlFor="workspace-survey-description">
              问卷说明
            </Label>
            <Textarea
              id="workspace-survey-description"
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              className="mt-1.5 min-h-20"
            />
          </div>

          <div className="grid gap-2.5">
            {questions.filter((question) => question.id === selectedQuestionId).map((question) => {
              const index = questions.findIndex((item) => item.id === question.id);
              return (
              <section key={question.id} data-testid={`workspace-question-${index}`} className="rounded-lg border border-border bg-background p-3">
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="muted">Q{index + 1}</Badge>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => moveQuestion(question.id, -1)}>
                      上移
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => moveQuestion(question.id, 1)}>
                      下移
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => removeQuestion(question.id)} className="text-destructive hover:text-destructive">
                      删除
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_150px]">
                  <label className="text-12 text-muted-foreground">
                    题目标题
                    <Input
                      value={question.title}
                      onChange={(event) => patchQuestion(question.id, { title: event.target.value })}
                      placeholder={`问题 ${index + 1}`}
                      className="mt-2"
                    />
                  </label>
                  <label className="text-12 text-muted-foreground">
                    题型
                    <Select className="mt-2" value={question.type} onChange={(event) => changeQuestionType(question.id, event.target.value as QType)}>
                      {typeGroups.map((group) => (
                        <optgroup key={group.label} label={group.label}>
                          {group.types.map((type) => (
                            <option key={type} value={type}>{typeLabel[type]}</option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                  </label>
                  <label className="text-12 text-muted-foreground">
                    分类
                    <Select id={`workflow-category-${index}`} className="mt-2" value={question.category ?? ""} onChange={(event) => setQuestionCategory(question.id, event.target.value)}>
                      <option value="">未分类</option>
                      {categories.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </Select>
                  </label>
                </div>
                <label className="mt-2.5 flex w-fit cursor-pointer items-center gap-2 text-13 text-muted-foreground">
                  <Input
                    type="checkbox"
                    checked={question.required}
                    onChange={(event) => patchQuestion(question.id, { required: event.target.checked })}
                    className="h-4 w-4 accent-primary"
                  />
                  必填
                </label>

                {choiceTypes.includes(question.type) ? (
                  <div className="mt-3 grid gap-2">
                    {question.options.map((option, optionIndex) => (
                      <div key={`${question.id}-${optionIndex}`} className="flex items-center gap-2">
                        <span className={question.type === "multiple" ? "h-4 w-4 rounded border border-border-strong" : "h-4 w-4 rounded-full border border-border-strong"} />
                        <Input
                          value={option}
                          onChange={(event) => patchOption(question.id, optionIndex, event.target.value)}
                          placeholder={`选项 ${optionIndex + 1}`}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => patchQuestion(question.id, { options: question.options.filter((_, idx) => idx !== optionIndex) })}
                        >
                          删除选项
                        </Button>
                      </div>
                    ))}
                    <Button type="button" size="sm" variant="outline" onClick={() => addOption(question.id)} className="w-full border-dashed">
                      <Plus className="h-4 w-4" strokeWidth={1.6} />
                      添加选项
                    </Button>
                  </div>
              ) : (
                  <div className="mt-3 rounded-lg border border-dashed border-border-strong bg-card px-3 py-2 text-13 text-muted-foreground">
                    {typeLabel[question.type]}回答
                  </div>
                )}
              </section>
              );
            })}
          </div>

          <Button type="button" variant="outline" onClick={addQuestion} className="w-full border-dashed border-border-strong bg-background">
            <Plus className="h-4 w-4" strokeWidth={1.6} />
            添加问题
          </Button>
          {saveError && <p role="alert" className="text-13 text-destructive">{saveError}</p>}
          {actionMessage && <p className="text-13 text-muted-foreground">{actionMessage}</p>}
        </section>

        {aiCollapsed ? (
          <div className="hidden border-l border-border bg-background xl:flex xl:items-start xl:justify-center xl:px-1 xl:py-3">
            <Button
              data-testid="survey-ai-expand"
              type="button"
              size="icon"
              variant="ghost"
              aria-label="展开 AI 助手"
              title="展开 AI 助手"
              onClick={() => setAiCollapsed(false)}
            >
              <PanelRightOpen className="h-4 w-4" strokeWidth={1.7} />
            </Button>
          </div>
        ) : (
          <SurveyAiPanel
            placeholder="例如：把题目改得更适合家长填写，并补充心理健康相关问题"
            resultLabel="AI 优化建议已生成"
            onSubmit={() => onOpenAi()}
            onPreview={onOpenAi}
            onApply={onOpenAi}
            onCollapse={() => setAiCollapsed(true)}
          />
        )}
      </div>
    </div>
  );
}

