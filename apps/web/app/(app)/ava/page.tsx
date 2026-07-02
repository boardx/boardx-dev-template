"use client";
// apps/web/app/(app)/ava/page.tsx — AVA 助手聊天主流程（P9 F01：聊天壳 + 新建会话 +
// 发首条消息 + AI 流式回复）
//
// 主流程：线程列表 + 聊天区（user/assistant 气泡，assistant 支持 Markdown/代码块）+
// 空态建议 + composer。新建/进入会话 → 发送消息 → SSE 逐字流式渲染 AI 回复 →
// DB 持久化（ava_threads/ava_messages）。桌面端左右分栏常驻；移动端先列表，
// 选中线程或新建聊天后切到聊天视图（带返回入口）。
//
// OUT OF SCOPE（本 feature 不做，留给后续 F02-F11）：线程重命名/删除/分页、
// 消息编辑/重生成/反馈、分享只读、Deep Research、附件/图片、语音、模型/Agent/工具切换、
// 建议动作个性化、发送到 Board / 邮件。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownMessage } from "./markdown-message";

interface ThreadSummary {
  id: number;
  title: string;
  updated_at: string;
}
interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "failed";
}
type ComposerMode = "chat" | "research";
type ResearchStatus = "idle" | "draft" | "running" | "complete" | "error";
interface ResearchPhase {
  name: string;
  tasks: string[];
}
interface ResearchTimelineItem {
  phase: string;
  task: string;
  status: "queued" | "running" | "complete";
}
interface ResearchReport {
  title: string;
  conclusion: string;
  sections: Array<{ heading: string; bullets: string[] }>;
}
interface ResearchPayload {
  clarifyingQuestions: string[];
  plan: {
    audience: string;
    phases: ResearchPhase[];
  };
  timeline: ResearchTimelineItem[];
  report: ResearchReport;
}
interface ResearchRun {
  topic: string;
  audience: string;
  status: ResearchStatus;
  research?: ResearchPayload;
  error?: string;
  assistantMessage?: Message;
  timeline: ResearchTimelineItem[];
}

const SUGGESTIONS = [
  "帮我起草 Q3 launch 计划",
  "总结这次用户访谈的要点",
  "给这个 board 想 5 个名字",
  "把这段需求拆成任务",
];

const RESEARCH_AUDIENCE = "Product leaders and user research stakeholders";

export default function AvaPage() {
  const router = useRouter();
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  const [composerMode, setComposerMode] = useState<ComposerMode>("chat");
  const [researchRun, setResearchRun] = useState<ResearchRun | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  // 移动端视图切换：list-first。桌面端（md 及以上）始终双栏，此状态被 CSS 忽略。
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeReport = researchRun?.research?.report;
  const isResearchMode = composerMode === "research";
  const composerPlaceholder = isResearchMode
    ? "Describe the research topic, audience, and decision…"
    : "Message AVA…";
  const canSend = Boolean(draft.trim()) && !sending && researchRun?.status !== "running";
  const researchStatusLabel = useMemo(() => {
    if (!researchRun) return "";
    if (researchRun.status === "draft") return "Plan ready for review";
    if (researchRun.status === "running") return "Research running";
    if (researchRun.status === "complete") return "Report ready";
    if (researchRun.status === "error") return "Needs attention";
    return "";
  }, [researchRun]);

  const guard = useCallback(
    (status: number) => {
      if (status === 401) {
        router.replace("/login");
        return true;
      }
      return false;
    },
    [router]
  );

  const refreshThreads = useCallback(async () => {
    const res = await fetch("/api/ava/threads");
    if (guard(res.status)) return;
    if (!res.ok) throw new Error("加载失败");
    const data = await res.json();
    setThreads(data.threads ?? []);
  }, [guard]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        await refreshThreads();
      } catch {
        if (!cancelled) setError("加载会话失败，请稍后重试");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streamingText, sending]);

  async function openThread(id: number) {
    setActiveId(id);
    setSendError("");
    setMessages([]);
    setResearchRun(null);
    setReportOpen(false);
    setMobileView("chat");
    try {
      const res = await fetch(`/api/ava/threads/${id}`);
      if (guard(res.status)) return;
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      setSendError("加载消息失败，请稍后重试");
    }
  }

  function newChat() {
    setActiveId(null);
    setMessages([]);
    setSendError("");
    setDraft("");
    setResearchRun(null);
    setReportOpen(false);
    setMobileView("chat");
  }

  async function ensureThread(): Promise<number | null> {
    if (activeId != null) return activeId;
    const res = await fetch("/api/ava/threads", { method: "POST" });
    if (guard(res.status)) return null;
    if (!res.ok) throw new Error("创建线程失败");
    const data = await res.json();
    const id: number = data.thread.id;
    setActiveId(id);
    return id;
  }

  async function send() {
    if (composerMode === "research") {
      await startResearch();
      return;
    }
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError("");
    setStreamingText("");

    try {
      const threadId = await ensureThread();
      if (threadId == null) return; // guard 已处理未登录跳转

      const res = await fetch(`/api/ava/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (guard(res.status)) return;
      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => ({}));
        if (errBody?.errors?.text) {
          setSendError(errBody.errors.text);
        } else {
          setSendError("发送失败，请重试（你的输入已保留）");
        }
        return;
      }

      setDraft(""); // 请求已受理（用户消息即将持久化），清空草稿；失败态由下面 SSE error 分支处理
      await consumeSse(res.body, {
        onUser: (msg: Message) => {
          setMessages((prev) => [...prev, msg]);
        },
        onToken: (token: string) => {
          setStreamingText((prev) => prev + token);
        },
        onDone: (msg: Message) => {
          setMessages((prev) => [...prev, msg]);
          setStreamingText("");
        },
        onError: (msg: Message) => {
          setMessages((prev) => [...prev, msg]);
          setStreamingText("");
          setSendError("AVA 生成回复失败，请重试。");
        },
      });
      await refreshThreads();
    } catch {
      setSendError("发送失败，请重试（你的输入已保留）");
    } finally {
      setSending(false);
    }
  }

  async function startResearch() {
    const topic = draft.trim();
    if (!topic || sending) return;
    setSending(true);
    setSendError("");
    setStreamingText("");
    setReportOpen(false);
    setResearchRun({
      topic,
      audience: RESEARCH_AUDIENCE,
      status: "idle",
      timeline: [],
    });

    try {
      const threadId = await ensureThread();
      if (threadId == null) return;

      const res = await fetch(`/api/ava/threads/${threadId}/research`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic, audience: RESEARCH_AUDIENCE }),
      });
      if (guard(res.status)) return;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = String(data?.error ?? "研究任务启动失败，请重试（你的主题已保留）");
        setSendError(message);
        setResearchRun({
          topic,
          audience: RESEARCH_AUDIENCE,
          status: "error",
          error: message,
          timeline: [],
        });
        return;
      }

      setDraft("");
      setMessages((prev) => [...prev, data.messages.user]);
      setResearchRun({
        topic,
        audience: RESEARCH_AUDIENCE,
        status: "draft",
        research: data.research,
        assistantMessage: data.messages.assistant,
        timeline: data.research.timeline.map((item: ResearchTimelineItem, index: number) => ({
          ...item,
          status: index === 0 ? "running" : "queued",
        })),
      });
      await refreshThreads();
    } catch {
      const message = "研究任务启动失败，请重试（你的主题已保留）";
      setSendError(message);
      setResearchRun({
        topic,
        audience: RESEARCH_AUDIENCE,
        status: "error",
        error: message,
        timeline: [],
      });
    } finally {
      setSending(false);
    }
  }

  function confirmResearchPlan() {
    if (!researchRun?.research || researchRun.status !== "draft") return;
    const queued: ResearchTimelineItem[] = researchRun.research.timeline.map((item, index) => ({
      ...item,
      status: index === 0 ? "running" : "queued",
    }));
    setResearchRun({ ...researchRun, status: "running", timeline: queued });

    researchRun.research.timeline.forEach((item, index) => {
      window.setTimeout(() => {
        setResearchRun((current) => {
          if (!current?.research) return current;
          const timeline = current.research.timeline.map((candidate, candidateIndex) => ({
            ...candidate,
            status:
              candidateIndex <= index
                ? "complete"
                : candidateIndex === index + 1
                  ? "running"
                  : "queued",
          })) as ResearchTimelineItem[];
          const isDone = index === current.research.timeline.length - 1;
          if (!isDone) return { ...current, status: "running", timeline };
          const nextMessages = current.assistantMessage ? [current.assistantMessage] : [];
          setMessages((prev) => [...prev, ...nextMessages]);
          setReportOpen(true);
          return { ...current, status: "complete", timeline };
        });
      }, 350 * (index + 1));
    });
  }

  function onComposerKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const isEmptyThread = messages.length === 0 && !sending;

  return (
    <div className="flex h-full overflow-hidden">
      {/* thread list：移动端 list 视图或桌面端常驻 */}
      <aside
        className={`w-full flex-none flex-col border-r border-border p-3 md:flex md:w-60 ${
          mobileView === "list" ? "flex" : "hidden"
        }`}
      >
        <Button data-testid="new-chat" size="sm" className="h-9 w-full gap-1.5" onClick={newChat}>
          <Plus className="h-4 w-4" strokeWidth={1.5} />
          New chat
        </Button>
        <div className="mt-3 flex-1 overflow-auto">
          {loading ? (
            <div data-testid="loading" className="animate-pulse space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 rounded-9 bg-muted" />
              ))}
            </div>
          ) : threads.length === 0 ? (
            <p data-testid="threads-empty" className="px-1 pt-2 text-xs text-muted-foreground">
              还没有会话，开始聊天即可创建。
            </p>
          ) : (
            <ul data-testid="thread-list" className="space-y-1">
              {threads.map((t) => (
                <li key={t.id}>
                  <Button
                    variant="ghost"
                    data-testid={`thread-${t.id}`}
                    onClick={() => openThread(t.id)}
                    className={`h-auto w-full flex-col items-start gap-0.5 rounded-9 px-3 py-2 text-left font-normal hover:bg-surface-1 ${
                      activeId === t.id ? "bg-surface-1" : ""
                    }`}
                  >
                    <span className="block w-full truncate text-13 font-medium text-foreground">{t.title}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* chat：移动端 chat 视图或桌面端常驻 */}
      <section
        className={`min-w-0 flex-1 flex-col md:flex ${mobileView === "chat" ? "flex" : "hidden"}`}
      >
        {error ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <p role="alert" data-testid="error" className="text-13 text-destructive">
              {error}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-none items-center gap-2 border-b border-border px-4 py-2.5 md:hidden">
              <Button
                variant="ghost"
                size="icon"
                data-testid="back-to-list"
                className="h-8 w-8"
                onClick={() => setMobileView("list")}
                aria-label="Back to thread list"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
              </Button>
              <span className="text-13 font-medium text-foreground">AVA</span>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-auto py-6">
              <div className="mx-auto flex max-w-2xl flex-col gap-5 px-6">
                {isEmptyThread ? (
                  <div data-testid="empty" className="pt-10 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-12 bg-primary text-primary-foreground">
                      <Sparkles className="h-5 w-5" strokeWidth={1.5} />
                    </div>
                    <h1 className="mt-3.5 text-17 font-semibold text-foreground">我能帮你做什么？</h1>
                    <p className="mt-1 text-13 text-muted-foreground">选一个起点，或直接输入。</p>
                    <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                      {SUGGESTIONS.map((s) => (
                        <Button
                          key={s}
                          variant="outline"
                          size="sm"
                          data-testid="suggestion"
                          onClick={() => setDraft(s)}
                          className="h-auto rounded-9 px-3.5 py-2.5 text-13 font-normal text-foreground hover:border-foreground hover:bg-surface-1"
                        >
                          {s}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <ul data-testid="messages" className="flex flex-col gap-5">
                    {messages.map((m) => (
                      <li
                        key={m.id}
                        data-testid={`msg-${m.role}`}
                        data-status={m.status}
                        className={`flex items-start gap-2.5 ${m.role === "user" ? "justify-end" : ""}`}
                      >
                        {m.role === "assistant" && (
                          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-7 bg-primary text-11 font-bold text-primary-foreground">
                            AI
                          </span>
                        )}
                        {m.role === "user" ? (
                          <div className="whitespace-pre-wrap rounded-12 bg-surface-1 px-4 py-2.5 text-sm leading-relaxed text-foreground">
                            {m.content}
                          </div>
                        ) : m.status === "failed" ? (
                          <div data-testid="msg-failed" className="text-sm leading-relaxed text-destructive">
                            {m.content}
                          </div>
                        ) : (
                          <MarkdownMessage content={m.content} />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {sending && (
                  <div data-testid="sending" className="flex items-start gap-2.5">
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-7 bg-primary text-11 font-bold text-primary-foreground">
                      AI
                    </span>
                    {streamingText ? (
                      <div data-testid="msg-assistant-streaming">
                        <MarkdownMessage content={streamingText} />
                      </div>
                    ) : (
                      <span className="text-13 text-muted-foreground">AVA 正在思考…</span>
                    )}
                  </div>
                )}
                {researchRun && (
                  <ResearchWorkspace
                    run={researchRun}
                    statusLabel={researchStatusLabel}
                    onConfirm={confirmResearchPlan}
                    onOpenReport={() => setReportOpen(true)}
                  />
                )}
              </div>
            </div>

            {reportOpen && activeReport && (
              <ReportPanel report={activeReport} onClose={() => setReportOpen(false)} />
            )}

            {/* composer */}
            <div className="flex-none px-6 pb-5">
              <div className="mx-auto max-w-2xl rounded-14 border border-border p-3 transition-colors focus-within:border-foreground">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={composerMode === "chat" ? "default" : "outline"}
                    data-testid="mode-chat"
                    onClick={() => setComposerMode("chat")}
                    className="gap-1.5 transition-all hover:shadow-sm"
                  >
                    <Sparkles className="h-4 w-4" strokeWidth={1.5} />
                    Chat
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={composerMode === "research" ? "default" : "outline"}
                    data-testid="mode-research"
                    onClick={() => setComposerMode("research")}
                    className="gap-1.5 transition-all hover:shadow-sm"
                  >
                    <Search className="h-4 w-4" strokeWidth={1.5} />
                    Deep Research
                  </Button>
                </div>
                <Label htmlFor="ava-composer" className="sr-only">
                  {isResearchMode ? "Deep Research topic" : "Message AVA"}
                </Label>
                <Textarea
                  id="ava-composer"
                  data-testid="composer"
                  rows={1}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onComposerKey}
                  placeholder={composerPlaceholder}
                  className="min-h-10 max-h-40 resize-none border-0 bg-transparent px-0 py-0 text-sm shadow-none transition-colors placeholder:text-placeholder focus-visible:ring-2 focus-visible:ring-ring"
                />
                {sendError && (
                  <p role="alert" data-testid="send-error" className="mt-2 text-xs text-destructive">
                    {sendError}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-end">
                  <Button
                    data-testid="send"
                    size="icon"
                    className="h-8 w-8 rounded-9"
                    onClick={() => void send()}
                    disabled={!canSend}
                    aria-label={isResearchMode ? "Start Deep Research" : "Send message"}
                  >
                    {isResearchMode ? (
                      <Search className="h-4 w-4" strokeWidth={2} />
                    ) : (
                      <ArrowUp className="h-4 w-4" strokeWidth={2} />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ResearchWorkspace({
  run,
  statusLabel,
  onConfirm,
  onOpenReport,
}: {
  run: ResearchRun;
  statusLabel: string;
  onConfirm: () => void;
  onOpenReport: () => void;
}) {
  const hasPlan = Boolean(run.research);
  return (
    <div
      data-testid="research-card"
      data-status={run.status}
      className="rounded-12 border border-border bg-surface-1 p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-13 font-semibold text-foreground">
            {run.status === "running" ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
            ) : (
              <Search className="h-4 w-4" strokeWidth={1.5} />
            )}
            Deep Research
          </div>
          <p className="mt-1 text-13 text-muted-foreground">{run.topic}</p>
        </div>
        <span data-testid="research-status" className="rounded-full bg-muted px-2.5 py-1 text-11 text-muted-foreground">
          {statusLabel}
        </span>
      </div>

      {run.status === "error" && (
        <p role="alert" data-testid="err-research" className="mt-3 text-13 text-destructive">
          {run.error}
        </p>
      )}

      {hasPlan && run.research && (
        <div className="mt-4 flex flex-col gap-4">
          <section data-testid="research-clarify" className="rounded-9 border border-border bg-background p-3">
            <h2 className="text-13 font-semibold text-foreground">Clarifying questions</h2>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-13 text-muted-foreground">
              {run.research.clarifyingQuestions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </section>

          <section data-testid="research-plan" className="rounded-9 border border-border bg-background p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-13 font-semibold text-foreground">Research plan</h2>
                <p className="mt-1 text-13 text-muted-foreground">Audience: {run.research.plan.audience}</p>
              </div>
              {run.status === "draft" && (
                <Button
                  type="button"
                  size="sm"
                  data-testid="confirm-research-plan"
                  onClick={onConfirm}
                  className="gap-1.5 transition-all hover:shadow-sm"
                >
                  <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
                  Confirm plan
                </Button>
              )}
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {run.research.plan.phases.map((phase) => (
                <div key={phase.name} className="rounded-7 border border-border p-2.5">
                  <h3 className="text-13 font-medium text-foreground">{phase.name}</h3>
                  <ul className="mt-2 space-y-1 text-11 text-muted-foreground">
                    {phase.tasks.map((task) => (
                      <li key={task}>{task}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section data-testid="research-timeline" className="rounded-9 border border-border bg-background p-3">
            <h2 className="text-13 font-semibold text-foreground">Execution timeline</h2>
            <ol className="mt-3 space-y-2">
              {run.timeline.map((item) => (
                <li key={`${item.phase}-${item.task}`} className="flex items-start gap-2">
                  <TimelineDot status={item.status} />
                  <div>
                    <p className="text-13 font-medium text-foreground">{item.phase}</p>
                    <p className="text-11 text-muted-foreground">
                      {item.task} · {item.status}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {run.status === "complete" && (
            <div
              data-testid="research-report-notice"
              className="flex flex-wrap items-center justify-between gap-3 rounded-9 border border-border bg-background p-3"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-foreground" strokeWidth={1.5} />
                <span className="text-13 font-medium text-foreground">Research report is ready</span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-testid="open-report"
                onClick={onOpenReport}
                className="transition-all hover:shadow-sm"
              >
                Open report
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TimelineDot({ status }: { status: ResearchTimelineItem["status"] }) {
  if (status === "running") {
    return (
      <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
      </span>
    );
  }
  if (status === "complete") {
    return (
      <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-primary text-primary-foreground">
        <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} />
      </span>
    );
  }
  return <span className="mt-0.5 h-5 w-5 flex-none rounded-full border border-border bg-muted" />;
}

function ReportPanel({ report, onClose }: { report: ResearchReport; onClose: () => void }) {
  return (
    <aside
      data-testid="research-report-panel"
      className="flex max-h-80 flex-none flex-col border-t border-border bg-background px-6 py-4"
    >
      <div className="mx-auto flex w-full max-w-2xl items-start justify-between gap-4">
        <div>
          <h2 className="text-17 font-semibold text-foreground">{report.title}</h2>
          <p data-testid="report-conclusion" className="mt-2 text-13 leading-relaxed text-muted-foreground">
            {report.conclusion}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="transition-all hover:bg-muted"
        >
          Close
        </Button>
      </div>
      <div className="mx-auto mt-4 grid w-full max-w-2xl gap-3 overflow-auto md:grid-cols-2">
        {report.sections.map((section) => (
          <section key={section.heading} className="rounded-9 border border-border bg-surface-1 p-3">
            <h3 className="text-13 font-semibold text-foreground">{section.heading}</h3>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-13 text-muted-foreground">
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}

// ─── SSE 消费（POST body 是 ReadableStream，浏览器原生 EventSource 不支持 POST，手动解析）──

interface SseHandlers {
  onUser: (msg: Message) => void;
  onToken: (token: string) => void;
  onDone: (msg: Message) => void;
  onError: (msg: Message) => void;
}

async function consumeSse(body: ReadableStream<Uint8Array>, handlers: SseHandlers): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIndex: number;
    while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);
      dispatchSseEvent(rawEvent, handlers);
    }
  }
}

function dispatchSseEvent(raw: string, handlers: SseHandlers): void {
  let event = "message";
  let data = "";
  for (const line of raw.split("\n")) {
    if (line.startsWith("event: ")) event = line.slice("event: ".length);
    else if (line.startsWith("data: ")) data += line.slice("data: ".length);
  }
  if (!data) return;
  const parsed = JSON.parse(data);
  if (event === "user") handlers.onUser(parsed.message);
  else if (event === "token") handlers.onToken(parsed.token);
  else if (event === "done") handlers.onDone(parsed.message);
  else if (event === "error") handlers.onError(parsed.message);
}
