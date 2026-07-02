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
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowUp, Sparkles, ArrowLeft, Bot, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
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
interface CapabilityOption {
  id: string;
  label: string;
  description: string;
  disabled?: boolean;
  disabledReason?: string;
}
interface AvaCapabilities {
  models: CapabilityOption[];
  agents: CapabilityOption[];
  tools: CapabilityOption[];
  defaults: {
    modelId: string;
    agentId: string;
    toolIds: string[];
  };
}

const SUGGESTIONS = [
  "帮我起草 Q3 launch 计划",
  "总结这次用户访谈的要点",
  "给这个 board 想 5 个名字",
  "把这段需求拆成任务",
];

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
  const [capabilities, setCapabilities] = useState<AvaCapabilities | null>(null);
  const [settingsError, setSettingsError] = useState("");
  const [modelId, setModelId] = useState("stub:default");
  const [agentId, setAgentId] = useState("default");
  const [toolIds, setToolIds] = useState<string[]>(["web-search"]);
  // 移动端视图切换：list-first。桌面端（md 及以上）始终双栏，此状态被 CSS 忽略。
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const refreshCapabilities = useCallback(async () => {
    const res = await fetch("/api/ava/capabilities");
    if (guard(res.status)) return;
    if (!res.ok) throw new Error("加载能力失败");
    const data = (await res.json()) as AvaCapabilities;
    setCapabilities(data);
    setModelId((prev) =>
      data.models.some((m) => m.id === prev && !m.disabled) ? prev : data.defaults.modelId
    );
    setAgentId((prev) => (data.agents.some((a) => a.id === prev) ? prev : data.defaults.agentId));
    setToolIds((prev) => {
      const allowed = new Set(data.tools.map((tool) => tool.id));
      const next = prev.filter((tool) => allowed.has(tool));
      return next.length > 0 ? next : data.defaults.toolIds;
    });
  }, [guard]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setSettingsError("");
      try {
        await Promise.all([refreshThreads(), refreshCapabilities()]);
      } catch {
        if (!cancelled) {
          setError("加载会话失败，请稍后重试");
          setSettingsError("加载 AI 设置失败，请稍后重试");
        }
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
    const onFocus = () => {
      void refreshCapabilities().catch(() => setSettingsError("刷新 AI 设置失败，已保留当前选择"));
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshCapabilities]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streamingText, sending]);

  async function openThread(id: number) {
    setActiveId(id);
    setSendError("");
    setMessages([]);
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
        body: JSON.stringify({ text, modelId, agentId, toolIds }),
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

  function onComposerKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const isEmptyThread = messages.length === 0 && !sending;
  const activeModel = capabilities?.models.find((model) => model.id === modelId);
  const activeAgent = capabilities?.agents.find((agent) => agent.id === agentId);
  const activeTools =
    capabilities?.tools.filter((tool) => toolIds.includes(tool.id)).map((tool) => tool.label) ?? [];
  const canSwitchAgent = messages.length === 0;

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
              </div>
            </div>

            {/* composer */}
            <div className="flex-none px-6 pb-5">
              <div className="mx-auto max-w-2xl rounded-14 border border-border p-3 transition-colors focus-within:border-foreground">
                <div className="mb-3 flex flex-col gap-2 rounded-9 bg-surface-1 p-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span data-testid="current-model" className="font-medium text-foreground">
                      Model: {activeModel?.label ?? modelId}
                    </span>
                    <span data-testid="current-agent">Agent: {activeAgent?.label ?? agentId}</span>
                    <span data-testid="current-tools">
                      Tools: {activeTools.length > 0 ? activeTools.join(", ") : "None"}
                    </span>
                  </div>
                  {settingsError && (
                    <p role="alert" data-testid="err-ai-settings" className="text-xs text-destructive">
                      {settingsError}
                    </p>
                  )}
                  {capabilities ? (
                    <div data-testid="ai-settings" className="grid gap-2 md:grid-cols-[1fr_1fr_1.3fr]">
                      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                        Model
                        <Select
                          data-testid="model-select"
                          aria-label="Select AVA model"
                          value={modelId}
                          onChange={(e) => {
                            const next = capabilities.models.find((model) => model.id === e.target.value);
                            if (!next || next.disabled) {
                              setSettingsError("该模型当前不可选，已保留原模型");
                              return;
                            }
                            setSettingsError("");
                            setModelId(next.id);
                          }}
                        >
                          {capabilities.models.map((model) => (
                            <option key={model.id} value={model.id} disabled={model.disabled}>
                              {model.label}
                              {model.disabled ? " (restricted)" : ""}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                        Agent
                        <Select
                          data-testid="agent-select"
                          aria-label="Select AVA agent"
                          value={agentId}
                          disabled={!canSwitchAgent}
                          onChange={(e) => {
                            if (!canSwitchAgent) {
                              setSettingsError("已有消息的线程不能切换 Agent");
                              return;
                            }
                            setSettingsError("");
                            setAgentId(e.target.value);
                          }}
                        >
                          {capabilities.agents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.label}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <div className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                        <span>Tools</span>
                        <div className="flex flex-wrap gap-1.5">
                          {capabilities.tools.map((tool) => {
                            const selected = toolIds.includes(tool.id);
                            return (
                              <Button
                                key={tool.id}
                                type="button"
                                variant={selected ? "default" : "outline"}
                                size="sm"
                                data-testid={`tool-${tool.id}`}
                                className="h-9 gap-1.5 rounded-9 px-2.5 text-xs transition-colors"
                                onClick={() => {
                                  setSettingsError("");
                                  setToolIds((prev) =>
                                    prev.includes(tool.id)
                                      ? prev.filter((id) => id !== tool.id)
                                      : [...prev, tool.id]
                                  );
                                }}
                              >
                                <Wrench className="h-3.5 w-3.5" strokeWidth={1.5} />
                                {tool.label}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div data-testid="loading" className="grid animate-pulse gap-2 md:grid-cols-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-9 rounded-md bg-muted" />
                      ))}
                    </div>
                  )}
                  {!canSwitchAgent && (
                    <p data-testid="agent-locked" className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Bot className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Agent is locked after messages exist in this thread.
                    </p>
                  )}
                </div>
                <label htmlFor="ava-composer" className="sr-only">
                  Message AVA
                </label>
                <textarea
                  id="ava-composer"
                  data-testid="composer"
                  rows={1}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onComposerKey}
                  placeholder="Message AVA…"
                  className="block max-h-40 w-full resize-none bg-transparent text-sm text-foreground transition-colors placeholder:text-placeholder focus-visible:outline-none focus-visible:ring-0"
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
                    disabled={!draft.trim() || sending}
                    aria-label="Send message"
                  >
                    <ArrowUp className="h-4 w-4" strokeWidth={2} />
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
