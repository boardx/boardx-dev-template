"use client";

import { useEffect, useMemo, useState } from "react";
import { LockKeyhole, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownMessage } from "../../(app)/ava/markdown-message";

interface SharedMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "failed";
}

interface SharedThread {
  id: number;
  title: string;
  messages: SharedMessage[];
}

type Status = "loading" | "ok" | "invalid" | "denied" | "error";

function LoadingChatSession() {
  return (
    <div data-testid="loading" className="mx-auto flex max-w-2xl animate-pulse flex-col gap-5 px-6 py-10">
      <div className="h-8 w-64 rounded-9 bg-muted" />
      <div className="h-16 w-full rounded-12 bg-muted" />
      <div className="h-16 w-3/4 self-end rounded-12 bg-muted" />
      <div className="h-16 w-full rounded-12 bg-muted" />
    </div>
  );
}

function MessageBubble({ message }: { message: SharedMessage }) {
  const isAssistant = message.role === "assistant";
  return (
    <li
      data-testid={`shared-msg-${message.role}`}
      data-status={message.status}
      className={cn("flex items-start gap-2.5", isAssistant ? "justify-start" : "justify-end")}
    >
      {isAssistant && (
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-7 bg-primary text-11 font-bold text-primary-foreground">
          AI
        </span>
      )}
      {isAssistant ? (
        <MarkdownMessage content={message.content} />
      ) : (
        <div className="max-w-xl whitespace-pre-wrap rounded-12 bg-surface-1 px-4 py-2.5 text-sm leading-relaxed text-foreground">
          {message.content}
        </div>
      )}
    </li>
  );
}

export default function ChatSharePage({ params }: { params: { id: string } }) {
  const [status, setStatus] = useState<Status>("loading");
  const [thread, setThread] = useState<SharedThread | null>(null);

  const shareToken = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("shareToken") ?? "";
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!params.id || !shareToken) {
        setStatus("invalid");
        return;
      }
      setStatus("loading");
      try {
        const res = await fetch(
          `/api/chatShare/${encodeURIComponent(params.id)}?shareToken=${encodeURIComponent(shareToken)}`
        );
        if (!active) return;
        if (res.status === 400) {
          setStatus("invalid");
          return;
        }
        if (res.status === 403) {
          setStatus("denied");
          return;
        }
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const data = (await res.json()) as { thread: SharedThread };
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
  }, [params.id, shareToken]);

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-background">
        <LoadingChatSession />
      </main>
    );
  }

  if (status !== "ok") {
    const invalid = status === "invalid";
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div
          data-testid={invalid ? "invalid-chat-session" : "share-unavailable"}
          role="alert"
          className="flex max-w-md flex-col items-center gap-3 rounded-12 border border-border bg-surface-1 p-8 text-center"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-12 bg-muted text-muted-foreground">
            <LockKeyhole className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <h1 className="text-17 font-semibold text-foreground">
            {invalid ? "Invalid chat session" : "Chat share unavailable"}
          </h1>
          <p className="text-13 leading-relaxed text-muted-foreground">
            {invalid
              ? "The shared chat link is missing a valid thread or token."
              : "This share link is invalid, private, or has been turned off."}
          </p>
        </div>
      </main>
    );
  }

  const current = thread!;
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-8">
        <header className="flex items-center gap-3 border-b border-border pb-5">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-9 bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <p className="text-11 font-medium uppercase text-muted-foreground">Shared AVA chat</p>
            <h1 data-testid="share-title" className="truncate text-17 font-semibold text-foreground">
              {current.title}
            </h1>
          </div>
        </header>

        {current.messages.length === 0 ? (
          <div data-testid="empty" className="flex flex-1 items-center justify-center py-16 text-center">
            <p className="text-13 text-muted-foreground">No messages.</p>
          </div>
        ) : (
          <ul data-testid="shared-message-list" className="flex flex-1 flex-col gap-5 py-6">
            {current.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </ul>
        )}

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
