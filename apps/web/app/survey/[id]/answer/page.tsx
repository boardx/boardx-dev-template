"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type QuestionType = "text" | "single" | "multiple" | "rating";

interface Question {
  id: number;
  title: string;
  type: QuestionType;
  required: boolean;
  options: string[];
  position: number;
}

interface SurveyAnswerPayload {
  id: number;
  title: string;
  description: string;
  isActive: boolean;
  availability: "open" | "not_accepting";
  unavailableMessage: string;
  questions: Question[];
}

type Answers = Record<string, string | string[] | number>;
type Errors = Record<string, string>;

function LoadingSurvey() {
  return (
    <main className="min-h-screen bg-surface-1 p-6">
      <div data-testid="loading" className="mx-auto flex max-w-2xl animate-pulse flex-col gap-4">
        <div className="h-8 w-2/3 rounded-9 bg-muted" />
        <div className="h-4 w-full rounded-9 bg-muted" />
        <div className="h-1.25 w-full rounded-full bg-muted" />
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-28 rounded-14 border border-border bg-card" />
        ))}
      </div>
    </main>
  );
}

function defaultAnswer(question: Question): string | string[] | number {
  if (question.type === "multiple") return [];
  if (question.type === "rating") return "";
  return "";
}

export default function SurveyAnswerPage({ params }: { params: { id: string } }) {
  const [survey, setSurvey] = useState<SurveyAnswerPayload | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Errors>({});
  const [pageError, setPageError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submittedKey = useMemo(() => `boardx-survey-submitted-${params.id}`, [params.id]);

  useEffect(() => {
    setSubmitted(window.localStorage.getItem(submittedKey) === "1");

    fetch(`/api/surveys/${params.id}/answer`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load survey.");
        const nextSurvey = data.survey as SurveyAnswerPayload;
        setSurvey(nextSurvey);
        setAnswers(
          Object.fromEntries(nextSurvey.questions.map((question) => [String(question.id), defaultAnswer(question)]))
        );
      })
      .catch((err) => setPageError(err instanceof Error ? err.message : "Failed to load survey."))
      .finally(() => setLoading(false));
  }, [params.id, submittedKey]);

  const answeredCount = survey
    ? survey.questions.filter((question) => {
        const value = answers[String(question.id)];
        return Array.isArray(value) ? value.length > 0 : String(value ?? "").trim().length > 0;
      }).length
    : 0;
  const progress = survey && survey.questions.length > 0 ? Math.round((answeredCount / survey.questions.length) * 100) : 0;

  function setAnswer(questionId: number, value: string | string[] | number) {
    const key = String(questionId);
    setAnswers((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const { [key]: _removed, ...rest } = current;
      return rest;
    });
  }

  function toggleMultiple(questionId: number, option: string) {
    const key = String(questionId);
    const current = Array.isArray(answers[key]) ? (answers[key] as string[]) : [];
    setAnswer(
      questionId,
      current.includes(option) ? current.filter((item) => item !== option) : [...current, option]
    );
  }

  function validateRequired(): Errors {
    if (!survey) return {};
    const nextErrors: Errors = {};
    for (const question of survey.questions) {
      const value = answers[String(question.id)];
      const empty = Array.isArray(value) ? value.length === 0 : String(value ?? "").trim().length === 0;
      if (question.required && empty) nextErrors[String(question.id)] = "This question is required.";
    }
    return nextErrors;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!survey || submitting) return;

    const nextErrors = validateRequired();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setPageError("Please answer all required questions.");
      return;
    }

    setSubmitting(true);
    setPageError("");
    const res = await fetch(`/api/surveys/${survey.id}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setErrors(data.errors ?? {});
      setPageError(data.error ?? "Failed to submit response.");
      return;
    }

    window.localStorage.setItem(submittedKey, "1");
    setSubmitted(true);
  }

  if (loading) return <LoadingSurvey />;

  if (pageError && !survey) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-1 p-6">
        <section className="w-full max-w-lg rounded-14 border border-border bg-card p-6 text-center">
          <p role="alert" data-testid="err-page" className="text-13 text-destructive">
            {pageError}
          </p>
        </section>
      </main>
    );
  }

  if (!survey) return null;

  if (!survey.isActive) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-1 p-6">
        <section data-testid="survey-unavailable" className="w-full max-w-xl rounded-14 border border-border bg-card p-6">
          <p className="text-11 font-medium uppercase tracking-wide text-muted-foreground">Survey unavailable</p>
          <h1 className="mt-2 text-22 font-bold text-foreground">{survey.title}</h1>
          {survey.description && <p className="mt-2 text-13 text-muted-foreground">{survey.description}</p>}
          <p role="alert" data-testid="err-unavailable" className="mt-5 text-13 text-destructive">
            {survey.unavailableMessage}
          </p>
        </section>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-1 p-6">
        <section data-testid="survey-success" className="w-full max-w-xl rounded-14 border border-border bg-card p-6 text-center">
          <div className="mx-auto flex h-13 w-13 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <CheckCircle2 aria-hidden="true" className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-17 font-bold text-foreground">Response submitted</h1>
          <p className="mt-2 text-13 text-muted-foreground">Thank you for completing {survey.title}.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface-1 px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 rounded-14 border border-border bg-card p-6 sm:p-7">
        <header className="flex flex-col gap-3">
          <p className="text-11 font-medium uppercase tracking-wide text-muted-foreground">Survey</p>
          <h1 data-testid="survey-answer-title" className="text-26 font-bold text-foreground">
            {survey.title}
          </h1>
          {survey.description && (
            <p data-testid="survey-answer-description" className="text-13 leading-relaxed text-muted-foreground">
              {survey.description}
            </p>
          )}
          <div data-testid="survey-progress" className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-13 text-muted-foreground">
              <span>{answeredCount} answered</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.25 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </header>

        {survey.questions.length === 0 ? (
          <section data-testid="empty" className="rounded-12 border border-dashed border-border-strong p-8 text-center">
            <p className="text-13 text-muted-foreground">This survey has no questions yet.</p>
          </section>
        ) : (
          <form data-testid="survey-answer-form" className="flex flex-col gap-4" onSubmit={submit}>
            {pageError && (
              <p role="alert" data-testid="err-form" className="text-13 text-destructive">
                {pageError}
              </p>
            )}

            {survey.questions.map((question, index) => {
              const key = String(question.id);
              const fieldError = errors[key];
              return (
                <section
                  key={question.id}
                  data-testid={`survey-question-${question.id}`}
                  className="rounded-12 border border-transparent p-1 transition-colors hover:border-border"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <Label htmlFor={`question-${question.id}`} className="text-15 font-semibold">
                        {index + 1}. {question.title}
                        {question.required && <span className="ml-1 text-foreground">*</span>}
                      </Label>
                    </div>
                  </div>

                  {question.type === "text" && (
                    <Textarea
                      id={`question-${question.id}`}
                      data-testid={`answer-text-${question.id}`}
                      value={String(answers[key] ?? "")}
                      onChange={(event) => setAnswer(question.id, event.target.value)}
                      aria-describedby={fieldError ? `err-question-${question.id}` : undefined}
                      placeholder="Write your answer"
                    />
                  )}

                  {question.type === "single" && (
                    <div className="flex flex-col gap-2" role="radiogroup" aria-labelledby={`question-${question.id}`}>
                      {question.options.map((option) => (
                        <Label
                          key={option}
                          className="flex cursor-pointer items-center gap-3 rounded-9 border border-border px-3 py-2 transition-colors hover:bg-surface-1"
                        >
                          <Input
                            data-testid={`answer-single-${question.id}-${option}`}
                            type="radio"
                            name={`question-${question.id}`}
                            value={option}
                            checked={answers[key] === option}
                            onChange={() => setAnswer(question.id, option)}
                            className="h-4 w-4"
                          />
                          <span className="text-13 text-foreground">{option}</span>
                        </Label>
                      ))}
                    </div>
                  )}

                  {question.type === "multiple" && (
                    <div className="flex flex-col gap-2">
                      {question.options.map((option) => {
                        const current = Array.isArray(answers[key]) ? (answers[key] as string[]) : [];
                        return (
                          <Label
                            key={option}
                            className="flex cursor-pointer items-center gap-3 rounded-9 border border-border px-3 py-2 transition-colors hover:bg-surface-1"
                          >
                            <Input
                              data-testid={`answer-multiple-${question.id}-${option}`}
                              type="checkbox"
                              checked={current.includes(option)}
                              onChange={() => toggleMultiple(question.id, option)}
                              className="h-4 w-4"
                            />
                            <span className="text-13 text-foreground">{option}</span>
                          </Label>
                        );
                      })}
                    </div>
                  )}

                  {question.type === "rating" && (
                    <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-labelledby={`question-${question.id}`}>
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <Button
                          key={rating}
                          type="button"
                          data-testid={`answer-rating-${question.id}-${rating}`}
                          variant={answers[key] === rating ? "default" : "outline"}
                          onClick={() => setAnswer(question.id, rating)}
                          className={cn("transition-colors", answers[key] === rating && "shadow-sm")}
                        >
                          {rating}
                        </Button>
                      ))}
                    </div>
                  )}

                  {fieldError && (
                    <p id={`err-question-${question.id}`} role="alert" data-testid={`err-question-${question.id}`} className="mt-3 text-13 text-destructive">
                      {fieldError}
                    </p>
                  )}
                </section>
              );
            })}

            <Button data-testid="submit-survey-response" type="submit" disabled={submitting} className="w-full transition-colors">
              {submitting ? "Submitting..." : "Submit response"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
