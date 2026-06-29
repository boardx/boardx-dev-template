"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Chat {
  id: number | string;
  name: string;
  creator_email: string;
  updated_at: string;
}

function bucketOf(iso: string): "今天" | "昨天" | "更早" {
  const d = new Date(iso);
  const now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = (day(now) - day(d)) / 86400000;
  if (diff <= 0) return "今天";
  if (diff === 1) return "昨天";
  return "更早";
}

const ORDER = ["今天", "昨天", "更早"] as const;

export default function RoomChatsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const roomId = params.id;
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/rooms/${roomId}/chats`);
    if (res.status === 401) return setError("请先登录"), setLoading(false);
    if (res.status === 403) return setError("你不是该房间成员"), setLoading(false);
    setChats((await res.json()).chats ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  async function newChat() {
    const res = await fetch(`/api/rooms/${roomId}/chats`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    if (res.status === 201) {
      const { chat } = await res.json();
      router.push(`/rooms/${roomId}/chats/${chat.id}`);
    }
  }

  const groups = ORDER.map((b) => ({ bucket: b, items: chats.filter((c) => bucketOf(c.updated_at) === b) })).filter((g) => g.items.length);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Chat List</h1>
        <Button data-testid="new-chat" size="sm" onClick={newChat}>
          New Chat
        </Button>
      </div>

      {error && (
        <p role="alert" data-testid="err" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <div data-testid="loading" className="flex flex-col gap-3 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-muted" />
          ))}
        </div>
      ) : chats.length === 0 ? (
        <div data-testid="empty" className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          还没有聊天，点 New Chat 新建后会出现在这里
        </div>
      ) : (
        <div data-testid="chat-list" className="flex flex-col gap-4">
          {groups.map((g) => (
            <div key={g.bucket} className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.bucket}</p>
              {g.items.map((c) => (
                <a
                  key={String(c.id)}
                  data-testid={`chat-${c.id}`}
                  href={`/rooms/${roomId}/chats/${c.id}`}
                  className={cn(
                    "flex items-center justify-between rounded-lg border bg-card px-4 py-3 shadow-sm",
                    "transition-all duration-200 hover:shadow-md hover:border-border/70"
                  )}
                >
                  <span className="text-sm font-medium text-foreground">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.creator_email}</span>
                </a>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
