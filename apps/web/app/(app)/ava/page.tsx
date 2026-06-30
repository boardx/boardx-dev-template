"use client";
// apps/web/app/(app)/ava/page.tsx — AVA 助手聊天主流程（uc-ava-001-start-chat）
//
// 主流程 only：thread 列表 + 聊天区（user/assistant 气泡 + 空态建议）+ 底部 composer。
// 新建/进入会话 → 发送消息 → 显示 AI（stub）回复 → 消息持久化（内存）。
// loading / empty / error 状态齐备。
//
// OUT OF SCOPE（本 feature 不做）：Deep Research、附件/图片、语音、模型/Agent/工具切换、
// 分享只读、消息编辑/重生成/反馈、团队切换清理。
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ThreadSummary {
  id: string;
  title: string;
  preview: string;
  updatedAt: number;
}
interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // 未登录统一跳转 /login（UC E1）。
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

  // 初始化：加载线程列表。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/ava");
        if (guard(res.status)) return;
        if (!res.ok) throw new Error("加载失败");
        const data = await res.json();
        if (!cancelled) setThreads(data.threads ?? []);
      } catch {
        if (!cancelled) setError("加载会话失败，请稍后重试");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [guard]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending]);

  async function openThread(id: string) {
    setActiveId(id);
    setSendError("");
    setMessages([]);
    try {
      const res = await fetch(`/api/ava?chatId=${encodeURIComponent(id)}`);
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
  }

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError("");
    try {
      const res = await fetch("/api/ava", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chatId: activeId, text }),
      });
      if (guard(res.status)) return;
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages((prev) => [...prev, data.userMessage, data.assistantMessage]);
      setActiveId(data.thread.id);
      setDraft(""); // 仅成功后清空草稿（失败保留输入，UC 成功出口3 / E2）
      // 刷新线程列表（新建/更新均反映在左栏）。
      const listRes = await fetch("/api/ava");
      if (!guard(listRes.status) && listRes.ok) {
        setThreads((await listRes.json()).threads ?? []);
      }
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

  return (
    <div className="flex h-full overflow-hidden">
      {/* thread list */}
      <aside className="flex w-60 flex-none flex-col border-r border-border p-3">
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
                    <span className="block w-full truncate text-xs text-muted-foreground">{t.preview}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* chat */}
      <section className="flex min-w-0 flex-1 flex-col">
        {error ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <p role="alert" data-testid="error" className="text-13 text-destructive">
              {error}
            </p>
          </div>
        ) : (
          <>
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
                        className={`flex items-start gap-2.5 ${m.role === "user" ? "justify-end" : ""}`}
                      >
                        {m.role === "assistant" && (
                          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-7 bg-primary text-11 font-bold text-primary-foreground">
                            AI
                          </span>
                        )}
                        <div
                          className={`whitespace-pre-wrap text-sm leading-relaxed ${
                            m.role === "user"
                              ? "rounded-12 bg-surface-1 px-4 py-2.5 text-foreground"
                              : "text-foreground"
                          }`}
                        >
                          {m.text}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {sending && (
                  <div data-testid="sending" className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-7 bg-primary text-11 font-bold text-primary-foreground">
                      AI
                    </span>
                    <span className="text-13 text-muted-foreground">AVA 正在思考…</span>
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
