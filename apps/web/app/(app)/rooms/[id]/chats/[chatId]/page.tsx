"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface Chat {
  id: number | string;
  name: string;
}

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
}

export default function RoomChatDetailPage() {
  const params = useParams<{ id: string; chatId: string }>();
  const router = useRouter();
  const { id: roomId, chatId } = params;
  const [chat, setChat] = useState<Chat | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch(`/api/rooms/${roomId}/chats/${chatId}`);
      if (!alive) return;
      if (res.status === 401) return router.replace("/login");
      if (res.status === 403) return setError("你不是该房间成员"), setLoading(false);
      if (res.status === 404) return setError("线程不存在"), setLoading(false);
      const d = await res.json();
      setChat(d.chat);
      setCanEdit(!!d.canEdit);
      const mres = await fetch(`/api/rooms/${roomId}/chats/${chatId}/messages`);
      if (!alive) return;
      if (mres.ok) {
        const md = await mres.json();
        setMessages(md.messages ?? []);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [roomId, chatId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError("");
    try {
      const res = await fetch(`/api/rooms/${roomId}/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        setSendError("发送失败，请重试");
        return;
      }
      const d = await res.json();
      setMessages((prev) => [...prev, d.userMessage, d.replyMessage]);
      setDraft("");
    } catch {
      setSendError("发送失败，请重试");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <div data-testid="loading" className="h-[80vh] animate-pulse bg-muted/40" />;
  }
  if (error) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p role="alert" data-testid="err" className="text-sm text-destructive">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div data-testid="chat-workspace" className="flex h-[80vh] flex-col">
      {/* 头部：返回 + 标题 + Agent 选择占位 */}
      <header className="flex items-center justify-between border-b bg-card px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Button data-testid="back-to-room" size="sm" variant="ghost" onClick={() => router.push(`/rooms/${roomId}/chats`)}>
            ← 返回房间
          </Button>
          <span data-testid="chat-name" className="text-base font-semibold text-foreground">
            {chat?.name}
          </span>
          {!canEdit && (
            <Badge variant="muted" data-testid="readonly-badge">
              仅查看
            </Badge>
          )}
        </div>
        <Button data-testid="agent-select" size="sm" variant="secondary" disabled title="Agent 选择将在 p9 接入">
          选择 Agent
        </Button>
      </header>

      {/* 三栏工作区 */}
      <div className="grid flex-1 grid-cols-[14rem_1fr_14rem] overflow-hidden">
        {/* 左：Room Files（p10） */}
        <aside data-testid="pane-files" className="flex flex-col gap-2 border-r bg-muted/20 p-4">
          <p className="text-sm font-semibold text-foreground">Room Files</p>
          <p className="text-xs text-muted-foreground">文件能力将在 p10 接入</p>
        </aside>

        {/* 中：AVA 聊天 */}
        <section data-testid="pane-chat" className="flex flex-col">
          <div data-testid="message-list" className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div data-testid="empty" className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                还没有消息，向 AVA 发送第一条消息开始协作。
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  data-testid={m.role === "user" ? "msg-user" : "msg-ava"}
                  className={
                    m.role === "user"
                      ? "max-w-[80%] self-end rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "max-w-[80%] self-start rounded-lg bg-muted px-3 py-2 text-sm text-foreground"
                  }
                >
                  {m.content}
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>
          <div className="border-t p-3">
            {canEdit ? (
              <>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                  }}
                >
                  <Input
                    data-testid="chat-input"
                    aria-label="聊天输入"
                    placeholder="输入消息…"
                    value={draft}
                    disabled={sending}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <Button data-testid="chat-send" type="submit" size="sm" disabled={sending || !draft.trim()}>
                    {sending ? "发送中…" : "发送"}
                  </Button>
                </form>
                {sendError && (
                  <p role="alert" data-testid="send-error" className="mt-2 text-xs text-destructive">
                    {sendError}
                  </p>
                )}
              </>
            ) : (
              <p data-testid="readonly-input" className="text-center text-xs text-muted-foreground">
                他人创建的线程，当前为只读
              </p>
            )}
          </div>
        </section>

        {/* 右：Studio（p12） */}
        <aside data-testid="pane-studio" className="flex flex-col gap-2 border-l bg-muted/20 p-4">
          <p className="text-sm font-semibold text-foreground">Studio</p>
          <p className="text-xs text-muted-foreground">Studio 将在 p12 接入</p>
        </aside>
      </div>
    </div>
  );
}
