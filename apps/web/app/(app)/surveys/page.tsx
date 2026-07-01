"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, ChevronLeft, Eye, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type QType = "text" | "single" | "multiple" | "rating";

interface Question {
  id: string;
  title: string;
  type: QType;
  required: boolean;
  options: string[];
}

interface Survey {
  id: number;
  title: string;
  description: string;
  scope: string;
  status: string;
  responses: number;
  teamId: number | null;
}

interface Team {
  id: number;
  name: string;
}

const TYPE_LABEL: Record<QType, string> = {
  text: "Text",
  single: "Single choice",
  multiple: "Multiple choice",
  rating: "Rating",
};

let qSeq = 0;
function newQuestion(): Question {
  qSeq += 1;
  return { id: `q_${qSeq}_${Math.random().toString(36).slice(2, 7)}`, title: "", type: "text", required: false, options: [] };
}

function SurveySkeleton() {
  return (
    <div data-testid="loading" className="mt-5 animate-pulse rounded-12 border border-border">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-12 border-b border-border last:border-b-0 bg-muted/40" />
      ))}
    </div>
  );
}

export default function SurveysPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"list" | "editor">("list");
  const [view, setView] = useState<"edit" | "preview">("edit");

  // editor state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<"private" | "team">("private");
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [created, setCreated] = useState<{ id: number; shareUrl: string } | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/surveys");
      if (res.status === 401) {
        // 未登录/visitor 不进入问卷工作区，转登录页（UC 权限分支）。
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        setError("加载问卷失败，请重试");
        setLoading(false);
        return;
      }
      setSurveys((await res.json()).surveys ?? []);
    } catch {
      setError("加载问卷失败，请重试");
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function loadTeams() {
    try {
      const res = await fetch("/api/teams");
      if (res.ok) setTeams(((await res.json()).teams ?? []).map((t: Team) => ({ id: t.id, name: t.name })));
    } catch {
      // 团队列表加载失败不阻塞创建（保留 private 作用域可用）
    }
  }

  function openEditor() {
    setTitle("");
    setDescription("");
    setScope("private");
    setTeamId("");
    setQuestions([newQuestion()]);
    setSaveError("");
    setCreated(null);
    setView("edit");
    setMode("editor");
    void loadTeams();
  }

  function patchQuestion(id: string, patch: Partial<Question>) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }
  function moveQuestion(id: string, dir: -1 | 1) {
    setQuestions((qs) => {
      const i = qs.findIndex((q) => q.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= qs.length) return qs;
      const next = qs.slice();
      const tmp = next[i]!;
      next[i] = next[j]!;
      next[j] = tmp;
      return next;
    });
  }
  function removeQuestion(id: string) {
    setQuestions((qs) => qs.filter((q) => q.id !== id));
  }
  function addOption(id: string) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, options: [...q.options, ""] } : q)));
  }
  function patchOption(id: string, idx: number, value: string) {
    setQuestions((qs) =>
      qs.map((q) => (q.id === id ? { ...q, options: q.options.map((o, k) => (k === idx ? value : o)) } : q))
    );
  }

  async function save() {
    setSaveError("");
    setSaving(true);
    const res = await fetch("/api/surveys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        scope,
        teamId: scope === "team" ? Number(teamId) : undefined,
        questions,
      }),
    });
    setSaving(false);
    if (res.status === 201) {
      const { survey } = await res.json();
      setCreated({ id: survey.id, shareUrl: survey.shareUrl });
      await load();
    } else {
      const d = await res.json().catch(() => ({}));
      setSaveError(d.errors?.title ?? d.errors?.questions ?? d.errors?.teamId ?? d.error ?? "保存失败");
    }
  }

  const hasValidQuestion = questions.some((q) => q.title.trim().length > 0);
  const canSave = title.trim().length > 0 && hasValidQuestion && (scope !== "team" || teamId);

  if (mode === "editor") {
    return (
      <div className="mx-auto max-w-content px-9 pb-14 pt-7">
        <div className="flex items-center gap-3">
          <Button
            data-testid="back-to-list"
            variant="ghost"
            size="sm"
            onClick={() => setMode("list")}
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
            Surveys
          </Button>
          <div className="flex-1" />
          {!created && (
            <Button
              data-testid={view === "edit" ? "preview-survey" : "edit-survey"}
              variant="outline"
              size="sm"
              onClick={() => setView(view === "edit" ? "preview" : "edit")}
              className="gap-1.5"
            >
              {view === "edit" ? (
                <>
                  <Eye className="h-4 w-4" strokeWidth={1.5} />
                  Preview
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4" strokeWidth={1.5} />
                  Edit
                </>
              )}
            </Button>
          )}
          {!created && view === "edit" && (
            <Button
              data-testid="save-survey"
              size="sm"
              disabled={saving || !canSave}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Create survey"}
            </Button>
          )}
        </div>

        {created && (
          <div className="mx-auto mt-7 max-w-2xl">
            <div
              data-testid="survey-created"
              className="rounded-12 border border-border bg-surface-1 p-5"
            >
              <p className="text-15 font-semibold text-foreground">Survey created</p>
              <p className="mt-1 text-13 text-muted-foreground">Share this link with answerers:</p>
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                <span data-testid="survey-share-link" className="flex-1 truncate text-13 text-foreground">
                  {created.shareUrl}
                </span>
              </div>
              <Button
                data-testid="done-created"
                size="sm"
                className="mt-4"
                onClick={() => setMode("list")}
              >
                Back to surveys
              </Button>
            </div>
          </div>
        )}

        {!created && view === "preview" && (
          <div className="mx-auto mt-7 max-w-2xl" data-testid="survey-preview">
            <h2 className="text-20 font-bold text-foreground">{title.trim() || "Untitled survey"}</h2>
            {description.trim() && <p className="mt-1.5 text-13 text-muted-foreground">{description}</p>}
            <div className="mt-6 flex flex-col gap-4">
              {questions.map((q, idx) => (
                <div key={q.id} data-testid={`preview-question-${idx}`} className="rounded-12 border border-border p-4">
                  <p className="text-13 font-semibold text-foreground">
                    {q.title.trim() || `Question ${idx + 1}`}
                    {q.required && <span className="ml-1 text-destructive">*</span>}
                  </p>
                  <div className="mt-3">
                    {q.type === "text" && (
                      <Input disabled placeholder="Your answer" className="bg-muted/30" />
                    )}
                    {(q.type === "single" || q.type === "multiple") && (
                      <div className="flex flex-col gap-2">
                        {(q.options.length ? q.options : ["Option 1"]).map((o, k) => (
                          <label key={k} className="flex items-center gap-2 text-13 text-foreground">
                            <input type="checkbox" disabled className="accent-primary" />
                            {o || `Option ${k + 1}`}
                          </label>
                        ))}
                      </div>
                    )}
                    {q.type === "rating" && <div className="text-22 text-border-strong">★ ★ ★ ★ ★</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!created && view === "edit" && (
        <div className="mx-auto mt-7 max-w-2xl">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="survey-title">Survey title</Label>
            <Input
              id="survey-title"
              data-testid="survey-title"
              placeholder="Untitled survey"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="mt-4 flex flex-col gap-1.5">
            <Label htmlFor="survey-desc">Description</Label>
            <textarea
              id="survey-desc"
              data-testid="survey-desc"
              placeholder="Add a description…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-16 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors placeholder:text-placeholder focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>
          <div className="mt-4 flex flex-col gap-1.5">
            <Label htmlFor="survey-scope">Share scope</Label>
            <Select
              id="survey-scope"
              data-testid="survey-scope"
              className="w-44"
              value={scope}
              onChange={(e) => setScope(e.target.value as "private" | "team")}
            >
              <option value="private">Only me</option>
              <option value="team">Shareable with team</option>
            </Select>
          </div>
          {scope === "team" && (
            <div className="mt-4 flex flex-col gap-1.5">
              <Label htmlFor="survey-team">Team</Label>
              <Select
                id="survey-team"
                data-testid="survey-team"
                className="w-64"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
              >
                <option value="">Select a team…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
              {teams.length === 0 && (
                <p className="text-12 text-muted-foreground">
                  You have no teams yet. Create one from the Teams page to share this survey with a team.
                </p>
              )}
            </div>
          )}

          <div data-testid="question-list" className="mt-6 flex flex-col gap-3.5">
            {questions.map((q, idx) => (
              <div
                key={q.id}
                data-testid={`question-${idx}`}
                className="rounded-12 border border-border p-4 transition-colors hover:border-border-strong"
              >
                <div className="flex items-center gap-2">
                  <span className="text-11 font-bold text-placeholder">Q{idx + 1}</span>
                  <Select
                    aria-label="Question type"
                    data-testid={`question-type-${idx}`}
                    className="h-8 w-40 text-13"
                    value={q.type}
                    onChange={(e) => patchQuestion(q.id, { type: e.target.value as QType })}
                  >
                    {(Object.keys(TYPE_LABEL) as QType[]).map((t) => (
                      <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                    ))}
                  </Select>
                  <div className="flex-1" />
                  <label className="flex cursor-pointer items-center gap-1.5 text-13 text-muted-foreground">
                    <input type="checkbox"
                      data-testid={`question-required-${idx}`}
                      checked={q.required}
                      onChange={(e) => patchQuestion(q.id, { required: e.target.checked })}
                      className="h-3.5 w-3.5 accent-primary"
                    />
                    Required
                  </label>
                  <Button
                    data-testid={`question-up-${idx}`}
                    variant="ghost"
                    size="icon"
                    aria-label="Move question up"
                    onClick={() => moveQuestion(q.id, -1)}
                  >
                    <ArrowUp className="h-4 w-4" strokeWidth={1.5} />
                  </Button>
                  <Button
                    data-testid={`question-down-${idx}`}
                    variant="ghost"
                    size="icon"
                    aria-label="Move question down"
                    onClick={() => moveQuestion(q.id, 1)}
                  >
                    <ArrowDown className="h-4 w-4" strokeWidth={1.5} />
                  </Button>
                  <Button
                    data-testid={`question-delete-${idx}`}
                    variant="ghost"
                    size="icon"
                    aria-label="Delete question"
                    onClick={() => removeQuestion(q.id)}
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                  </Button>
                </div>
                <div className="mt-3">
                  <Input
                    data-testid={`question-title-${idx}`}
                    placeholder={`Question ${idx + 1}`}
                    value={q.title}
                    onChange={(e) => patchQuestion(q.id, { title: e.target.value })}
                  />
                </div>
                {(q.type === "single" || q.type === "multiple") && (
                  <div className="mt-3 flex flex-col gap-2">
                    {q.options.map((o, k) => (
                      <Input
                        key={k}
                        data-testid={`question-${idx}-option-${k}`}
                        placeholder={`Option ${k + 1}`}
                        value={o}
                        onChange={(e) => patchOption(q.id, k, e.target.value)}
                        className="h-9"
                      />
                    ))}
                    <Button
                      data-testid={`question-add-option-${idx}`}
                      variant="ghost"
                      size="sm"
                      onClick={() => addOption(q.id)}
                      className="self-start gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Add option
                    </Button>
                  </div>
                )}
                {q.type === "rating" && (
                  <div className="mt-2.5 text-22 text-border-strong">★ ★ ★ ★ ★</div>
                )}
              </div>
            ))}
          </div>

          <Button
            data-testid="add-question"
            variant="outline"
            onClick={() => setQuestions((qs) => [...qs, newQuestion()])}
            className="mt-3.5 w-full gap-1.5 border-dashed border-border-strong font-medium text-muted-foreground hover:border-foreground hover:bg-transparent hover:text-foreground"
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            Add question
          </Button>

          {saveError && (
            <p role="alert" data-testid="err-save" className="mt-4 text-13 text-destructive">
              {saveError}
            </p>
          )}
        </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-content px-9 pb-14 pt-7">
      <div className="flex items-center justify-between">
        <h1 className="text-26 font-bold tracking-tight text-foreground">Surveys</h1>
        <Button data-testid="new-survey" size="sm" onClick={openEditor}>
          New survey
        </Button>
      </div>

      {error && (
        <p role="alert" data-testid="err" className="mt-4 text-13 text-destructive">
          {error}
        </p>
      )}

      <div className="mt-5">
        {loading ? (
          <SurveySkeleton />
        ) : surveys.length === 0 ? (
          <div
            data-testid="empty"
            className="flex flex-col items-center gap-3 rounded-12 border border-dashed border-border-strong px-6 py-15 text-center"
          >
            <p className="text-15 font-semibold text-foreground">No surveys yet</p>
            <p className="text-13 text-muted-foreground">
              Create a survey to collect responses and share it with answerers.
            </p>
            <Button data-testid="empty-new-survey" size="sm" onClick={openEditor} className="mt-1 gap-1.5">
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Create survey
            </Button>
          </div>
        ) : (
          <div data-testid="survey-list" className="overflow-hidden rounded-12 border border-border">
            <div className="flex bg-surface-1 px-4.5 py-2.75 text-11 font-semibold text-muted-foreground">
              <div className="flex-[2.4]">Survey</div>
              <div className="flex-1">Scope</div>
              <div className="flex-1">Responses</div>
              <div className="flex-1">Status</div>
            </div>
            {surveys.map((s) => (
              <div
                key={s.id}
                data-testid={`survey-${s.id}`}
                className="flex items-center border-t border-border px-4.5 py-3.25 transition-colors hover:bg-surface-1"
              >
                <div className="flex-[2.4] truncate text-13 font-semibold text-foreground">{s.title}</div>
                <div className="flex-1">
                  <Badge variant="muted">{s.scope === "team" ? "Team" : "Private"}</Badge>
                </div>
                <div className="flex-1 text-13 text-muted-foreground">{s.responses}</div>
                <div className="flex-1">
                  <Badge variant="muted">{s.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
