"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface Chat {
  id: number | string;
  name: string;
}

export default function RoomChatDetailPage() {
  const params = useParams<{ id: string; chatId: string }>();
  const router = useRouter();
  const { id: roomId, chatId } = params;
  const [chat, setChat] = useState<Chat | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch(`/api/rooms/${roomId}/chats/${chatId}`);
      if (!alive) return;
      if (res.status === 403) return setError("你不是该房间成员"), setLoading(false);
      if (res.status === 404) return setError("线程不存在"), setLoading(false);
      const d = await res.json();
      setChat(d.chat);
      setCanEdit(!!d.canEdit);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [roomId, chatId]);

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

        {/* 中：AVA 聊天（p9） */}
        <section data-testid="pane-chat" className="flex flex-col">
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            AVA 对话区（消息与回复将在 p9 接入）
          </div>
          <div className="border-t p-3">
            {canEdit ? (
              <div className="flex gap-2">
                <Input data-testid="chat-input" placeholder="输入消息…（发送将在 p9 接入）" disabled />
                <Button data-testid="chat-send" size="sm" disabled title="AVA 发送将在 p9 接入">
                  发送
                </Button>
              </div>
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
