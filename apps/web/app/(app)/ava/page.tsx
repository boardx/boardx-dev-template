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
import { Plus, ArrowUp, Sparkles, ArrowLeft, Share2, Copy, X, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
interface ThreadShare {
  thread_id: number;
  share_token: string;
  share_enabled: boolean;
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
  const [shareOpen, setShareOpen] = useState(false);
  const [share, setShare] = useState<ThreadShare | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
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
    setShareOpen(false);
    setShare(null);
    setShareError("");
    setCopyStatus("");
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
    setShareOpen(false);
    setShare(null);
    setShareError("");
    setCopyStatus("");
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

  function onComposerKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  function shareUrl(nextShare = share): string {
    if (!activeId || !nextShare?.share_enabled) return "";
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/chatShare/${activeId}?shareToken=${encodeURIComponent(nextShare.share_token)}`;
  }

  async function loadShare() {
    if (!activeId) return;
    setShareLoading(true);
    setShareError("");
    try {
      const res = await fetch(`/api/ava/threads/${activeId}/share`);
      if (guard(res.status)) return;
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { share: ThreadShare | null };
      setShare(data.share);
    } catch {
      setShareError("加载分享状态失败，请重试");
    } finally {
      setShareLoading(false);
    }
  }

  async function toggleSharePanel() {
    const nextOpen = !shareOpen;
    setShareOpen(nextOpen);
    setShareError("");
    setCopyStatus("");
    if (nextOpen && activeId) await loadShare();
  }

  async function enableShareAndCopy() {
    if (!activeId) return;
    setShareLoading(true);
    setShareError("");
    setCopyStatus("");
    try {
      const res = await fetch(`/api/ava/threads/${activeId}/share`, { method: "POST" });
      if (guard(res.status)) return;
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { share: ThreadShare };
      setShare(data.share);
      const url = shareUrl(data.share);
      await navigator.clipboard.writeText(url);
      setCopyStatus("已复制分享链接");
    } catch {
      setShareError("生成或复制分享链接失败，请重试");
    } finally {
      setShareLoading(false);
    }
  }

  async function copyShareLink() {
    const url = shareUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus("已复制分享链接");
      setShareError("");
    } catch {
      setShareError("复制失败，请手动复制链接");
    }
  }

  async function disableShare() {
    if (!activeId) return;
    setShareLoading(true);
    setShareError("");
    setCopyStatus("");
    try {
      const res = await fetch(`/api/ava/threads/${activeId}/share`, { method: "DELETE" });
      if (guard(res.status)) return;
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { share: ThreadShare | null };
      setShare(data.share);
      setCopyStatus("分享已关闭，原链接已失效");
    } catch {
      setShareError("关闭分享失败，请重试");
    } finally {
      setShareLoading(false);
    }
  }

  const isEmptyThread = messages.length === 0 && !sending;
  const currentShareUrl = shareUrl();

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
            <div className="relative flex flex-none items-center gap-2 border-b border-border px-4 py-2.5">
              <Button
                variant="ghost"
                size="icon"
                data-testid="back-to-list"
                className="h-8 w-8 md:hidden"
                onClick={() => setMobileView("list")}
                aria-label="Back to thread list"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
              </Button>
              <span className="text-13 font-medium text-foreground">AVA</span>
              <div className="ml-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid="ava-share"
                  className="h-8 gap-1.5 transition-colors hover:bg-surface-1"
                  onClick={() => void toggleSharePanel()}
                  disabled={!activeId}
                >
                  <Share2 className="h-4 w-4" strokeWidth={1.5} />
                  分享
                </Button>
              </div>
              {shareOpen && (
                <div
                  data-testid="share-panel"
                  className="absolute right-4 top-12 z-20 w-80 rounded-12 border border-border bg-background p-4 shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-13 font-semibold text-foreground">通过链接分享</h2>
                      <p className="mt-1 text-11 leading-relaxed text-muted-foreground">
                        公开链接仅包含这条聊天中的消息，不包含私有附件或团队私有上下文。
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 transition-colors hover:bg-surface-1"
                      onClick={() => setShareOpen(false)}
                      aria-label="Close share panel"
                    >
                      <X className="h-4 w-4" strokeWidth={1.5} />
                    </Button>
                  </div>

                  <div className="mt-4 space-y-2">
                    <Label htmlFor="ava-share-url">分享链接</Label>
                    <Input
                      id="ava-share-url"
                      data-testid="share-link"
                      readOnly
                      value={currentShareUrl}
                      placeholder={shareLoading ? "Loading share link..." : "点击复制链接生成分享"}
                    />
                  </div>

                  {shareError && (
                    <p role="alert" data-testid="err-share" className="mt-2 text-xs text-destructive">
                      {shareError}
                    </p>
                  )}
                  {copyStatus && (
                    <p data-testid="share-copy-status" className="mt-2 text-xs text-muted-foreground">
                      {copyStatus}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      data-testid="share-copy"
                      size="sm"
                      className="h-8 gap-1.5 transition-colors"
                      onClick={() => (currentShareUrl ? void copyShareLink() : void enableShareAndCopy())}
                      disabled={shareLoading}
                    >
                      <Copy className="h-4 w-4" strokeWidth={1.5} />
                      {currentShareUrl ? "复制链接" : "通过链接分享"}
                    </Button>
                    <Button
                      data-testid="share-disable"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 transition-colors hover:bg-surface-1"
                      onClick={() => void disableShare()}
                      disabled={shareLoading || !currentShareUrl}
                    >
                      <X className="h-4 w-4" strokeWidth={1.5} />
                      关闭分享
                    </Button>
                    <Button
                      data-testid="share-email-disabled"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 transition-colors hover:bg-surface-1"
                      disabled
                    >
                      <Mail className="h-4 w-4" strokeWidth={1.5} />
                      发送到邮箱
                    </Button>
                  </div>
                </div>
              )}
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
