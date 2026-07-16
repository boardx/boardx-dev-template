"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Send, Star } from "lucide-react";
import type { SurveyWithQuestions } from "@repo/data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type AnswerValue = string | number | string[];

export type SurveyAnswerView = Omit<SurveyWithQuestions, "questions"> & {
  confirmation_message?: string;
  publish_start_at?: string | null;
  publish_end_at?: string | null;
  response_limit?: number | null;
  questions: Array<
    Omit<SurveyWithQuestions["questions"][number], "type"> & { type: string }
  >;
};

function questionTypeLabel(type: string) {
  if (type === "short_text") return "短文本";
  if (type === "text") return "段落";
  if (type === "email") return "邮箱";
  if (type === "number") return "数字";
  if (type === "phone") return "手机号";
  if (type === "single") return "单选";
  if (type === "multiple") return "多选";
  if (type === "dropdown") return "下拉";
  if (type === "rating") return "评分";
  if (type === "linear_scale") return "线性量表";
  if (type === "nps") return "NPS";
  if (type === "date") return "日期";
  if (type === "time") return "时间";
  if (type === "file") return "文件上传";
  return "问题";
}

function hasAnswer(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return value >= 0;
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

export default function AnswerForm({ survey }: { survey: SurveyAnswerView }) {
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const answeredCount = useMemo(
    () => survey.questions.filter((question) => hasAnswer(answers[String(question.id)])).length,
    [answers, survey.questions]
  );

  function setAnswer(questionId: number, value: AnswerValue) {
    setAnswers((current) => ({ ...current, [String(questionId)]: value }));
    setError("");
  }

  function toggleMulti(questionId: number, option: string, checked: boolean) {
    const key = String(questionId);
    const current = Array.isArray(answers[key]) ? (answers[key] as string[]) : [];
    const next = checked ? [...current, option] : current.filter((item) => item !== option);
    setAnswer(questionId, next);
  }

  async function submit() {
    const missingRequired = survey.questions.some((question) => question.required && !hasAnswer(answers[String(question.id)]));
    if (missingRequired) {
      setError("请完成必填题后再提交");
      return;
    }

    setSubmitting(true);
    const res = await fetch(`/api/surveys/${survey.id}/responses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    setSubmitting(false);

    if (res.status === 201) {
      setSubmitted(true);
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.errors?.answers ?? data.error ?? "提交失败，请稍后重试");
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-secondary/20 px-4 py-12">
        <section
          data-testid="answer-success"
          className="mx-auto max-w-2xl rounded-lg border border-border bg-background p-7 text-center shadow-sm"
        >
          <CheckCircle2 className="mx-auto h-10 w-10 text-success" strokeWidth={1.5} />
          <h1 className="mt-4 text-22 font-bold text-foreground">提交成功</h1>
          <p className="mt-2 text-14 text-muted-foreground">
            {survey.confirmation_message ?? "感谢你的参与，答卷已成功提交。"}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main data-testid="answer-page" className="min-h-screen bg-secondary/20 px-4 py-10">
      <section data-testid="answer-professional-shell" className="mx-auto max-w-2xl overflow-hidden rounded-lg border border-border bg-background shadow-sm">
        <div className="border-t-4 border-primary p-7">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">BoardX Survey</Badge>
            <span data-testid="answer-progress" className="text-12 text-muted-foreground">
              {answeredCount} / {survey.questions.length}
            </span>
          </div>
          <h1 className="mt-4 text-26 font-bold tracking-tight text-foreground">{survey.title}</h1>
          {survey.description && <p className="mt-2 text-14 text-muted-foreground">{survey.description}</p>}
        </div>

        <div data-testid="answer-question-list" className="divide-y divide-border border-t border-border">
          {survey.questions.map((question, idx) => {
            const key = String(question.id);
            const value = answers[key];
            return (
              <section key={question.id} data-testid={`answer-question-${idx}`} className="px-7 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-14 font-semibold text-foreground">
                      {idx + 1}. {question.title}
                      {question.required && <span className="ml-1 text-destructive">*</span>}
                    </p>
                    <p className="mt-1 text-12 text-muted-foreground">{questionTypeLabel(question.type)}</p>
                  </div>
                </div>

                {["short_text", "email", "number", "phone", "date", "time"].includes(question.type) && (
                  <div className="mt-3">
                    <Label htmlFor={`answer-input-${idx}`} className="sr-only">
                      {question.title}
                    </Label>
                    <Input
                      id={`answer-input-${idx}`}
                      data-testid={`answer-input-${idx}`}
                      type={
                        question.type === "email"
                          ? "email"
                          : question.type === "number"
                            ? "number"
                            : question.type === "phone"
                              ? "tel"
                              : question.type === "date"
                                ? "date"
                                : question.type === "time"
                                  ? "time"
                                  : "text"
                      }
                      value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
                      onChange={(e) => setAnswer(question.id, question.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
                      placeholder="请输入你的回答"
                    />
                  </div>
                )}

                {question.type === "text" && (
                  <div className="mt-3">
                    <Label htmlFor={`answer-text-${idx}`} className="sr-only">
                      {question.title}
                    </Label>
                    <Textarea
                      id={`answer-text-${idx}`}
                      data-testid={`answer-text-${idx}`}
                      value={typeof value === "string" ? value : ""}
                      onChange={(e) => setAnswer(question.id, e.target.value)}
                      placeholder="请输入你的回答"
                    />
                  </div>
                )}

                {question.type === "rating" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <Button
                        key={score}
                        type="button"
                        data-testid={`answer-rating-${idx}-${score - 1}`}
                        variant={value === score ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAnswer(question.id, score)}
                        className="gap-1"
                      >
                        <Star className="h-3.5 w-3.5" strokeWidth={1.5} />
                        {score}
                      </Button>
                    ))}
                  </div>
                )}

                {question.type === "linear_scale" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <Button
                        key={score}
                        type="button"
                        data-testid={`answer-scale-${idx}-${score - 1}`}
                        variant={value === score ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAnswer(question.id, score)}
                      >
                        {score}
                      </Button>
                    ))}
                  </div>
                )}

                {question.type === "nps" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Array.from({ length: 11 }).map((_, score) => (
                      <Button
                        key={score}
                        type="button"
                        data-testid={`answer-nps-${idx}-${score}`}
                        variant={value === score ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAnswer(question.id, score)}
                      >
                        {score}
                      </Button>
                    ))}
                  </div>
                )}

                {question.type === "single" && (
                  <div className="mt-3 flex flex-col gap-2">
                    {question.options.map((option, optionIdx) => (
                      <label
                        key={option}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-14 transition-colors hover:border-border-strong",
                          value === option && "border-primary bg-primary/5"
                        )}
                      >
                        <Input
                          data-testid={`answer-single-${idx}-${optionIdx}`}
                          type="radio"
                          name={`question-${question.id}`}
                          checked={value === option}
                          onChange={() => setAnswer(question.id, option)}
                          className="h-4 w-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                )}

                {question.type === "dropdown" && (
                  <div className="mt-3">
                    <Label htmlFor={`answer-dropdown-${idx}`} className="sr-only">
                      {question.title}
                    </Label>
                    <Select
                      id={`answer-dropdown-${idx}`}
                      data-testid={`answer-dropdown-${idx}`}
                      value={typeof value === "string" ? value : ""}
                      onChange={(e) => setAnswer(question.id, e.target.value)}
                      className="max-w-sm"
                    >
                      <option value="">请选择</option>
                      {question.options.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </Select>
                  </div>
                )}

                {question.type === "multiple" && (
                  <div className="mt-3 flex flex-col gap-2">
                    {question.options.map((option, optionIdx) => {
                      const selected = Array.isArray(value) && value.includes(option);
                      return (
                        <label
                          key={option}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-14 transition-colors hover:border-border-strong",
                            selected && "border-primary bg-primary/5"
                          )}
                        >
                          <Input
                            data-testid={`answer-multiple-${idx}-${optionIdx}`}
                            type="checkbox"
                            checked={selected}
                            onChange={(e) => toggleMulti(question.id, option, e.target.checked)}
                            className="h-4 w-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring"
                          />
                          <span>{option}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {question.type === "file" && (
                  <div className="mt-3">
                    <Label htmlFor={`answer-file-${idx}`} className="sr-only">
                      {question.title}
                    </Label>
                    <Input
                      id={`answer-file-${idx}`}
                      data-testid={`answer-file-${idx}`}
                      type="file"
                      onChange={(e) => setAnswer(question.id, Array.from(e.target.files ?? []).map((file) => file.name))}
                    />
                    <p className="mt-1 text-12 text-muted-foreground">当前原型保存文件名，正式接入对象存储后可上传附件。</p>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <div className="flex flex-col items-end gap-3 border-t border-border px-7 py-5">
          {error && (
            <p role="alert" data-testid="err-answer" className="text-13 text-destructive">
              {error}
            </p>
          )}

          <Button data-testid="submit-answer" type="button" disabled={submitting} onClick={() => void submit()} className="gap-1.5">
            <Send className="h-4 w-4" strokeWidth={1.5} />
            {submitting ? "提交中..." : "提交"}
          </Button>
        </div>
      </section>
    </main>
  );
}
