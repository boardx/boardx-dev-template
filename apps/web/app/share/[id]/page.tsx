"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ShareMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

interface SharedThread {
  id: string;
  title: string;
  agent?: { name: string; description: string };
  messages: ShareMessage[];
}

type Status = "loading" | "ok" | "notfound" | "error";

function ShareSkeleton() {
  return (
    <div data-testid="loading" className="mx-auto flex max-w-content animate-pulse flex-col gap-5 px-6 py-10">
      <div className="h-8.5 w-62 rounded-9 bg-muted" />
      <div className="h-15 w-full rounded-12 bg-muted" />
      <div className="h-15 w-3/4 self-end rounded-12 bg-muted" />
      <div className="h-15 w-full rounded-12 bg-muted" />
    </div>
  );
}

function MessageBubble({ m }: { m: ShareMessage }) {
  const isAi = m.role === "assistant";
  return (
    <div
      data-testid={`message-${m.id}`}
      data-role={m.role}
      className={cn("flex items-start gap-2.75", isAi ? "justify-start" : "justify-end")}
    >
      {isAi && (
        <div className="flex h-7 w-7 flex-none items-center justify-center rounded-7 bg-primary text-11 font-bold text-primary-foreground">
          AI
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-12 px-3.75 py-2.75 text-sm leading-relaxed",
          isAi ? "bg-surface-1 text-foreground" : "bg-primary text-primary-foreground",
        )}
      >
        {m.text}
      </div>
    </div>
  );
}

export default function SharePage({ params }: { params: { id: string } }) {
  const [status, setStatus] = useState<Status>("loading");
  const [thread, setThread] = useState<SharedThread | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setStatus("loading");
      try {
        const res = await fetch(`/api/share/${encodeURIComponent(params.id)}`);
        if (!active) return;
        if (res.status === 404) {
          setStatus("notfound");
          return;
        }
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const data = (await res.json()) as { thread: SharedThread };
        if (!active) return;
        setThread(data.thread);
        setStatus("ok");
      } catch {
        if (active) setStatus("error");
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [params.id]);

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-background">
        <ShareSkeleton />
      </main>
    );
  }

  if (status === "notfound" || status === "error") {
    const isError = status === "error";
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div
          data-testid={isError ? "error" : "notfound"}
          role="alert"
          className="flex max-w-brand flex-col items-center gap-2.75 rounded-12 border border-border bg-surface-1 p-8 text-center"
        >
          <div className="flex h-11.5 w-11.5 items-center justify-center rounded-12 bg-muted text-22 text-muted-foreground">
            {isError ? "!" : "×"}
          </div>
          <h1 className="text-17 font-semibold text-foreground">
            {isError ? "加载失败" : "无法访问 / 链接已失效"}
          </h1>
          <p className="text-13 leading-relaxed text-muted-foreground">
            {isError
              ? "Error loading chat session，请稍后重试。"
              : "该分享链接不存在、已失效，或内容为私有，无法公开查看。"}
          </p>
        </div>
      </main>
    );
  }

  // status === "ok"
  const t = thread!;
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-content flex-col px-6 py-8">
        {/* 头部：标题 + Agent 描述 */}
        <header className="flex items-center gap-3 border-b border-border pb-5">
          {t.agent && (
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-9 bg-primary text-13 font-bold text-primary-foreground">
              AI
            </div>
          )}
          <div className="min-w-0">
            <h1 data-testid="share-title" className="truncate text-17 font-semibold text-foreground">
              {t.title}
            </h1>
            {t.agent && <p className="truncate text-11 text-muted-foreground">{t.agent.description}</p>}
          </div>
        </header>

        {/* 只读消息列表 */}
        {t.messages.length === 0 ? (
          <div data-testid="empty" className="flex flex-1 items-center justify-center py-15">
            <p className="text-13 text-muted-foreground">No messages in this chat session</p>
          </div>
        ) : (
          <div data-testid="message-list" className="flex flex-1 flex-col gap-5 py-6">
            {t.messages.map((m) => (
              <MessageBubble key={m.id} m={m} />
            ))}
          </div>
        )}

        {/* 底部只读提示（无输入框） */}
        <footer
          data-testid="readonly-banner"
          className="mt-auto flex items-center justify-center gap-2 border-t border-border py-4 text-11 text-muted-foreground"
        >
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-border-strong" aria-hidden />
          Shared chat session · Read only
        </footer>
      </div>
    </main>
  );
}
