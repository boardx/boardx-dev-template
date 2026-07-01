"use client";

import { useMemo, useState } from "react";
import type { SurveyAnswer, SurveyQuestion } from "@/lib/survey/survey-engine";
import type { SurveyRecord } from "@/lib/survey/survey-service";
import { cn } from "@/lib/utils";

type AnswerDraft = string | string[];

export function PublicSurveyForm({ survey, token }: { survey: SurveyRecord; token: string }) {
  const [answers, setAnswers] = useState<Record<string, AnswerDraft>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted" | "error">("idle");
  const [message, setMessage] = useState("");
  const answeredCount = survey.questions.filter((question) => isAnswered(answers[question.id])).length;
  const progress = survey.questions.length === 0 ? 0 : Math.round((answeredCount / survey.questions.length) * 100);
  const questionNumbers = useMemo(
    () => new Map(survey.questions.map((question, index) => [question.id, index + 1])),
    [survey.questions]
  );

  async function submit() {
    const missingQuestion = survey.questions.find(
      (item) => item.required && !isAnswered(answers[item.id])
    );
    if (missingQuestion) {
      setStatus("error");
      setMessage(`请先完成必填题：“${missingQuestion.title}”。`);
      document.getElementById(`question-${missingQuestion.id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }

    setStatus("submitting");
    setMessage("正在提交答卷...");
    try {
      const response = await fetch(`/api/s/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          durationSeconds: 420,
          metadata: { device: "desktop", channel: "share-link" },
          answers: survey.questions.map((item) => createAnswer(item, answers[item.id])),
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "提交失败");
      }

      setStatus("submitted");
      setMessage("提交成功，感谢您的参与。");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  if (status === "submitted") {
    return (
      <main className="min-h-screen bg-[#f6f8fb] px-4 py-10 text-slate-950">
        <section className="mx-auto grid min-h-[520px] max-w-2xl place-items-center rounded-[8px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div>
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-[8px] bg-emerald-50 text-xl font-semibold text-emerald-700">
              ✓
            </div>
            <h1 className="mt-5 text-2xl font-semibold">答卷已提交</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">{message}</p>
          </div>
        </section>
      </main>
    );
  }

  if (survey.questions.length === 0) {
    return (
      <main className="min-h-screen bg-[#f6f8fb] px-4 py-10 text-slate-950">
        <section className="mx-auto max-w-2xl rounded-[8px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold">暂无可填写题目</h1>
          <p className="mt-3 text-sm text-slate-500">请联系问卷发布者检查问卷配置。</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f8fb] px-4 py-6 text-slate-950 sm:py-8">
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[340px_1fr]">
        <aside className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
          <div className="h-36 bg-[url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80')] bg-cover bg-center" />
          <div className="p-5">
            <h1 className="text-lg font-semibold">{survey.survey.title}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">{survey.survey.description}</p>
            <div className="mt-6 grid gap-3 border-t border-slate-100 pt-5 text-sm">
              <InfoLine label="预计时间" value="8-10分钟" />
              <InfoLine label="题目数量" value={`${survey.questions.length}题`} />
              <InfoLine label="问卷类型" value="匿名填写" />
            </div>
            <div className="mt-7">
              <div className="flex justify-between text-xs text-slate-500">
                <span>填写进度</span>
                <span>{progress}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        </aside>

        <section className="max-h-none rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm sm:p-8 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-lg font-semibold">填写问卷</h2>
              <p className="mt-2 text-sm text-slate-500">所有题目在本页展示，可向下滚动查看并一次提交。</p>
            </div>
            <span className="text-sm text-slate-500">已完成 {answeredCount}/{survey.questions.length}</span>
          </div>

          <div className="mt-6 grid gap-8">
            {survey.sections.map((section) => {
              const sectionQuestions = survey.questions.filter((questionItem) => questionItem.sectionId === section.id);
              if (sectionQuestions.length === 0) {
                return null;
              }

              return (
                <div key={section.id}>
                  <p className="text-sm font-semibold text-slate-900">{section.title}</p>
                  {section.description ? <p className="mt-1 text-sm text-slate-500">{section.description}</p> : null}
                  <div className="mt-4 grid gap-5">
                    {sectionQuestions.map((questionItem) => (
                      <QuestionBlock
                        key={questionItem.id}
                        question={questionItem}
                        number={questionNumbers.get(questionItem.id) ?? 1}
                        value={answers[questionItem.id]}
                        onChange={(value) =>
                          setAnswers((current) => ({ ...current, [questionItem.id]: value }))
                        }
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {message ? <p className="mt-5 text-sm text-slate-500">{message}</p> : null}
          <div className="sticky bottom-0 mt-8 border-t border-slate-100 bg-white pt-4">
            <button
              type="button"
              onClick={() => void submit()}
              className="h-11 w-full rounded-[8px] bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
              disabled={status === "submitting"}
            >
              {status === "submitting" ? "提交中..." : "提交答卷"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function QuestionBlock({
  question,
  number,
  value,
  onChange,
}: {
  question: SurveyQuestion;
  number: number;
  value?: AnswerDraft;
  onChange: (value: AnswerDraft) => void;
}) {
  const isMultiple = question.type === "multiple_choice";
  const selectedValues = Array.isArray(value) ? value : [];
  const textValue = typeof value === "string" ? value : "";

  return (
    <article id={`question-${question.id}`} className="rounded-[8px] border border-slate-200 p-4">
      <p className="text-base font-medium">
        {number}. {question.title}
        <span className="ml-2 text-sm font-normal text-slate-400">（{question.required ? "必填" : "选填"}）</span>
      </p>
      <div className="mt-4 grid gap-3">
        {(question.options ?? []).map((option) => {
          const checked = isMultiple ? selectedValues.includes(option.value) : value === option.value;
          return (
            <label
              key={option.id}
              className={cn(
                "flex min-h-12 cursor-pointer items-center gap-3 rounded-[8px] border px-4 py-3 text-sm transition",
                checked
                  ? "border-blue-500 bg-blue-50 text-blue-800"
                  : "border-slate-200 text-slate-700 hover:border-blue-200"
              )}
            >
              <input
                type={isMultiple ? "checkbox" : "radio"}
                className="h-4 w-4"
                checked={checked}
                onChange={() => {
                  if (!isMultiple) {
                    onChange(option.value);
                    return;
                  }

                  onChange(
                    checked
                      ? selectedValues.filter((item) => item !== option.value)
                      : [...selectedValues, option.value]
                  );
                }}
              />
              {option.label}
            </label>
          );
        })}
        {question.type === "textarea" || question.type === "text" || !question.options?.length ? (
          <textarea
            className="min-h-32 rounded-[8px] border border-slate-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            placeholder="请输入您的反馈"
            value={textValue}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : null}
      </div>
    </article>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}

function isAnswered(value?: AnswerDraft): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return Boolean(value?.trim());
}

function createAnswer(question: SurveyQuestion, rawValue?: AnswerDraft): SurveyAnswer {
  if (question.type === "textarea" || !question.options?.length) {
    const textValue = typeof rawValue === "string" ? rawValue.trim() : "";
    return { questionId: question.id, value: textValue, textValue };
  }

  if (Array.isArray(rawValue)) {
    const selectedOptions = question.options.filter((option) => rawValue.includes(option.value));
    return {
      questionId: question.id,
      value: selectedOptions.map((option) => option.value),
      optionIds: selectedOptions.map((option) => option.id),
    };
  }

  const selectedOption = question.options.find((option) => option.value === rawValue);
  return {
    questionId: question.id,
    value: selectedOption?.value ?? rawValue ?? "",
    optionIds: selectedOption ? [selectedOption.id] : undefined,
  };
}
