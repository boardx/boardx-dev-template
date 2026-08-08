"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ClipboardList, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ResponseQuestion {
  id: number | string;
  title: string;
  type: string;
}

interface IndividualResponse {
  id: number | string;
  answers: Record<string, unknown>;
  submittedAt: string;
}

interface ResponsePayload {
  survey: {
    id: number;
    title: string;
    questions: ResponseQuestion[];
  };
  responses: IndividualResponse[];
}

function answerText(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join("、");
  if (value === null || value === undefined || value === "") return "未作答";
  if (typeof value === "boolean") return value ? "已填写" : "未作答";
  return String(value);
}

function submittedAtLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "提交时间未知";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function respondentName(
  response: IndividualResponse,
  questions: ResponseQuestion[],
  index: number
): string {
  const identityQuestion = questions.find((question) => /姓名|称呼|名字/.test(question.title));
  const identity = identityQuestion
    ? answerText(response.answers[String(identityQuestion.id)])
    : "";
  return identity && identity !== "未作答" ? identity : `匿名答卷 ${index + 1}`;
}

export function SurveyResponsesWorkbench({ surveyId }: { surveyId: number }) {
  const [payload, setPayload] = useState<ResponsePayload | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadResponses() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/surveys/${surveyId}/responses?view=individual`);
      if (!response.ok) {
        setError(response.status === 403 ? "你无权查看这份问卷的个人答卷" : "答卷加载失败，请重试");
        return;
      }
      const nextPayload = await response.json() as ResponsePayload;
      setPayload(nextPayload);
      setSelectedId((current) => {
        if (current && nextPayload.responses.some((item) => String(item.id) === current)) return current;
        return nextPayload.responses[0] ? String(nextPayload.responses[0].id) : null;
      });
    } catch {
      setError("答卷加载失败，请检查网络后重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPayload(null);
    setSelectedId(null);
    setQuery("");
    void loadResponses();
  }, [surveyId]);

  const responses = payload?.responses ?? [];
  const questions = payload?.survey.questions ?? [];
  const filteredResponses = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return responses;
    return responses.filter((response, index) => {
      const searchable = [
        response.id,
        respondentName(response, questions, index),
        ...Object.values(response.answers).flatMap((value) => Array.isArray(value) ? value : [value]),
      ].map(String).join(" ").toLocaleLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [query, questions, responses]);
  const selectedResponse = responses.find((response) => String(response.id) === selectedId) ?? null;
  const selectedIndex = selectedResponse ? responses.indexOf(selectedResponse) : -1;

  if (loading) {
    return (
      <div data-testid="responses-loading" className="grid min-h-64 place-items-center border-t border-border bg-background">
        <div className="text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-survey" strokeWidth={1.6} />
          <p className="mt-3 text-14 text-muted-foreground">正在加载个人答卷…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid min-h-64 place-items-center border-t border-border bg-background p-6 text-center">
        <div>
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" strokeWidth={1.6} />
          <p role="alert" className="mt-3 text-14 font-medium text-destructive">{error}</p>
          <Button type="button" size="sm" variant="outline" className="mt-4" onClick={() => void loadResponses()}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }

  if (!responses.length) {
    return (
      <div className="grid min-h-64 place-items-center border-t border-border bg-background p-6 text-center">
        <div>
          <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.6} />
          <p className="mt-3 text-14 font-semibold text-foreground">暂无用户答卷</p>
          <p className="mt-1 text-13 text-muted-foreground">发布回收后，这里会显示每位用户的提交记录。</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="individual-response-browser" className="min-h-96 border-t border-border bg-background lg:flex">
      <aside className="min-w-0 border-b border-border lg:w-85 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="border-b border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-15 font-bold text-foreground">用户答卷</h3>
              <p className="mt-1 text-12 text-muted-foreground">共 {responses.length} 份，选择后查看完整问答</p>
            </div>
            <Badge variant="outline" className="border-survey/25 bg-survey/5 text-survey">{responses.length} 份</Badge>
          </div>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.7} />
            <Input
              aria-label="搜索答卷"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索姓名、答案或编号"
              className="pl-9"
            />
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto" data-testid="individual-response-list">
          {filteredResponses.length ? filteredResponses.map((response) => {
            const responseIndex = responses.indexOf(response);
            const active = String(response.id) === selectedId;
            return (
              <button
                key={response.id}
                type="button"
                data-testid={`individual-response-${response.id}`}
                aria-current={active ? "true" : undefined}
                className={`flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors ${active ? "bg-survey/10" : "hover:bg-surface-1"}`}
                onClick={() => setSelectedId(String(response.id))}
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-12 font-semibold ${active ? "bg-survey text-white" : "bg-surface-2 text-foreground"}`}>
                  {String(responseIndex + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-14 font-semibold text-foreground">
                    {respondentName(response, questions, responseIndex)}
                  </span>
                  <span className="mt-1 block text-12 text-muted-foreground">
                    #{response.id} · {submittedAtLabel(response.submittedAt)}
                  </span>
                </span>
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={1.8} />
              </button>
            );
          }) : (
            <p className="px-4 py-8 text-center text-13 text-muted-foreground">没有匹配的答卷</p>
          )}
        </div>
      </aside>

      <section className="min-w-0 flex-1" data-testid="selected-individual-response">
        {selectedResponse ? (
          <>
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <p className="text-12 font-medium text-survey">答卷 {selectedIndex + 1} / {responses.length}</p>
                <h3 className="mt-1 text-18 font-bold text-foreground">
                  {respondentName(selectedResponse, questions, selectedIndex)}
                </h3>
                <p className="mt-1 text-12 text-muted-foreground">
                  编号 #{selectedResponse.id} · 提交于 {submittedAtLabel(selectedResponse.submittedAt)}
                </p>
              </div>
              <Badge variant="success" className="gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                已完成 {questions.length} 题
              </Badge>
            </header>
            <dl className="grid max-h-96 gap-0 overflow-y-auto" data-testid="selected-response-answers">
              {questions.map((question, index) => (
                <div key={question.id} className="grid gap-2 border-b border-border px-5 py-4 md:grid-cols-[36px_minmax(0,1fr)]">
                  <dt className="grid h-7 w-7 place-items-center rounded-md bg-survey/10 text-11 font-semibold text-survey">
                    {index + 1}
                  </dt>
                  <dd className="min-w-0">
                    <p className="text-13 font-medium leading-5 text-muted-foreground">{question.title}</p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-14 leading-6 text-foreground">
                      {answerText(selectedResponse.answers[String(question.id)])}
                    </p>
                  </dd>
                </div>
              ))}
            </dl>
          </>
        ) : null}
      </section>
    </div>
  );
}
