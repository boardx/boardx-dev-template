"use client";
// uc-board-ai-001 — Board 内嵌 AI 浮层 + board chat 停靠面板（F01）。
// 对齐 docs/design/boardx-prototype-v1.bundle.html 的 Board 屏：
// - 右下角圆形 "AI" 浮动触发按钮（唤起/收起）。
// - 唤起后停靠在右侧的 "Board AI" 面板：消息列表 + composer，可就当前画布内容提问/生成。
//
// F01 复审（Revise）后的修正：回复不再是前端正则匹配 + 拼接 itemCount 的写死模板，
// 而是真实调用 POST /api/boards/:id/ai-chat —— 该路由复用与 AVA 相同的 CAP-AI 网关
// （packages/ai 的 defaultGateway/stubProvider），并把当前画布上 items 的真实文字内容
// 组装进 prompt 上下文一并传给网关，使回复真实依据画布内容生成。三态
// （loading/empty/error）与 testid 命名参照 apps/web/app/(app)/ava/page.tsx 的既有约定，
// 前缀 board-ai- 避免与 Ava 全局 testid 冲突。
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

interface BoardChatMessage {
  id: string;
  role: "user" | "ai";
  text: string;
}

let msgSeq = 0;
const nextId = () => `bcm_${Date.now()}_${msgSeq++}`;

export function BoardAiOverlay({
  boardId,
  itemCount,
  open,
  onOpenChange,
}: {
  boardId: string;
  itemCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [messages, setMessages] = useState<BoardChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const toggleOpen = useCallback(() => {
    onOpenChange(!open);
  }, [open, onOpenChange]);

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text || sending) return;
    setError("");
    const userMsg: BoardChatMessage = { id: nextId(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setDraft("");
    setSending(true);

    // 真实调用：POST /api/boards/:id/ai-chat，服务端读取画布 items 真实文字内容后
    // 经 CAP-AI 网关生成回复（见该路由与 packages/ai/src/gateway.ts 的注释）。
    (async () => {
      try {
        const res = await fetch(`/api/boards/${boardId}/ai-chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: text }),
        });
        const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
        if (!res.ok || typeof data.reply !== "string") {
          throw new Error(data.error ?? `请求失败（${res.status}）`);
        }
        setMessages((prev) => [...prev, { id: nextId(), role: "ai", text: data.reply as string }]);
      } catch {
        setError("Board AI 暂时无法回复，请稍后重试。");
      } finally {
        setSending(false);
      }
    })();
  }, [draft, sending, boardId]);

  return (
    <>
      {/* AI 浮层触发按钮：右下角圆形黑底 "AI"，对齐 prototype */}
      <button
        type="button"
        data-testid="board-ai-toggle"
        title={open ? "收起 Board AI" : "唤起 Board AI"}
        aria-label={open ? "收起 Board AI" : "唤起 Board AI"}
        aria-pressed={open}
        onClick={toggleOpen}
        className={cn(
          "absolute bottom-16 right-4 z-20 flex h-11 w-11 items-center justify-center rounded-full",
          "bg-primary text-xs font-bold text-primary-foreground shadow-lg",
          "transition-all duration-200 hover:scale-105 hover:bg-primary/90 active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
      >
        AI
      </button>

      {open && (
        <div
          data-testid="board-ai-panel"
          role="dialog"
          aria-label="Board AI"
          className="absolute bottom-3 right-3 top-3 z-30 flex w-85 flex-col overflow-hidden rounded-2xl border border-border bg-card/95 shadow-xl backdrop-blur-md"
        >
          <div className="flex h-12 flex-none items-center gap-2 border-b border-border px-3.5">
            <div className="flex h-6.5 w-6.5 items-center justify-center rounded-md bg-primary text-11 font-bold text-primary-foreground">
              AI
            </div>
            <div className="flex-1">
              <div className="text-13 font-semibold text-foreground">Board AI</div>
              <div className="text-xs text-muted-foreground">当前画布 · {itemCount} 个组件</div>
            </div>
            <button
              type="button"
              data-testid="board-ai-close"
              title="收起"
              aria-label="收起 Board AI"
              onClick={toggleOpen}
              className={cn(
                "flex h-6.5 w-6.5 items-center justify-center rounded-md text-muted-foreground",
                "transition-colors duration-200 hover:bg-accent hover:text-accent-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              ✕
            </button>
          </div>

          <div data-testid="board-ai-messages" className="flex flex-1 flex-col gap-3 overflow-auto p-4">
            {messages.length === 0 && !sending && (
              <div
                data-testid="empty"
                className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-8 text-center"
              >
                <p className="text-sm text-muted-foreground">就当前画布内容提问，或让 AI 帮你生成内容</p>
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                data-testid={`board-ai-msg-${m.role}`}
                className={cn("flex gap-2", m.role === "user" ? "flex-row-reverse" : "flex-row")}
              >
                {m.role === "ai" && (
                  <div className="flex h-5.5 w-5.5 flex-none items-center justify-center rounded-md bg-primary text-9 font-bold text-primary-foreground">
                    AI
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-60 rounded-xl px-3 py-2 text-13 leading-relaxed",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {sending && (
              <div data-testid="loading" className="flex items-center gap-2 px-1">
                <div className="flex h-5.5 w-5.5 flex-none items-center justify-center rounded-md bg-primary text-9 font-bold text-primary-foreground">
                  AI
                </div>
                <div className="flex gap-1 py-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:0.2s]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:0.4s]" />
                </div>
              </div>
            )}
            {error && (
              <p role="alert" data-testid="err-board-ai" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <div className="flex-none border-t border-border p-3">
            <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2 transition-colors duration-200 focus-within:border-ring">
              <input
                data-testid="board-ai-composer"
                aria-label="向 Board AI 提问"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask about this board…"
                className="flex-1 border-none bg-transparent text-13 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0"
              />
              <button
                type="button"
                data-testid="board-ai-send"
                title="发送"
                aria-label="发送"
                disabled={!draft.trim() || sending}
                onClick={send}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground",
                  "transition-all duration-200 hover:bg-primary/90",
                  "disabled:cursor-not-allowed disabled:opacity-40",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
