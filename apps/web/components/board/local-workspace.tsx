"use client";

import { useEffect, useMemo, useState } from "react";
import { Brain, MessageSquare, Plus, Save, Search, Send, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Tab = "chat" | "memory";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

interface BoardMemory {
  id: string;
  text: string;
}

const nextId = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

export function LocalWorkspace({ boardId, canEdit }: { boardId: string; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [chatStatus, setChatStatus] = useState("聊天结果仅显示在当前会话");
  const [memories, setMemories] = useState<BoardMemory[]>([]);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [memorySearch, setMemorySearch] = useState("");
  const [memoryStatus, setMemoryStatus] = useState("Board Memory 会保存到当前浏览器的本地工作区");
  const [hydrated, setHydrated] = useState(false);

  const memoryKey = `board-local-workspace:${boardId}:memories`;

  useEffect(() => {
    setHydrated(false);
    setOpen(false);
    setTab("chat");
    setMessages([]);
    setDraft("");
    setChatStatus("聊天结果仅显示在当前会话");
    setMemoryDraft("");
    setMemorySearch("");
    setMemoryStatus("Board Memory 会保存到当前浏览器的本地工作区");
    try {
      const raw = window.localStorage.getItem(memoryKey);
      setMemories(raw ? (JSON.parse(raw) as BoardMemory[]) : []);
    } catch {
      setMemories([]);
    } finally {
      setHydrated(true);
    }
  }, [memoryKey]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(memoryKey, JSON.stringify(memories));
  }, [hydrated, memories, memoryKey]);

  const visibleMemories = useMemo(() => {
    const q = memorySearch.trim().toLowerCase();
    if (!q) return memories;
    return memories.filter((memory) => memory.text.toLowerCase().includes(q));
  }, [memories, memorySearch]);

  if (!canEdit) return null;

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;
    const reply = `Board Chat 已在当前白板上下文中记录：“${text}”。`;
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", text },
      { id: nextId(), role: "assistant", text: reply },
    ]);
    setDraft("");
    setChatStatus("聊天结果仅显示在当前会话，尚未保存为 Board Memory");
  }

  function saveLatestReply() {
    const latest = [...messages].reverse().find((message) => message.role === "assistant");
    if (!latest) return;
    setMemories((prev) => [{ id: nextId(), text: latest.text }, ...prev]);
    setChatStatus("已保存为 Board Memory");
    setMemoryStatus("已保存为 Board Memory");
  }

  function addMemory() {
    const text = memoryDraft.trim();
    if (!text) return;
    setMemories((prev) => [{ id: nextId(), text }, ...prev]);
    setMemoryDraft("");
    setMemoryStatus("已保存为 Board Memory");
  }

  function deleteMemory(id: string) {
    setMemories((prev) => prev.filter((memory) => memory.id !== id));
    setMemoryStatus("Board Memory 已删除");
  }

  return (
    <>
      <Button
        type="button"
        data-testid="local-workspace-open"
        size="sm"
        variant="secondary"
        className="gap-1.5"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Brain className="h-4 w-4" />
        Local Workspace
      </Button>

      {open && (
        <aside
          data-testid="local-workspace-panel"
          aria-label="Local Workspace"
          className="absolute right-4 top-14 z-30 flex h-[calc(80vh-4rem)] w-[24rem] flex-col rounded-xl border bg-popover text-popover-foreground shadow-xl"
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Local Workspace</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Board Chat 和 Board Memory</p>
            </div>
            <Button
              type="button"
              data-testid="local-workspace-close"
              size="icon"
              variant="ghost"
              aria-label="关闭 Local Workspace"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 border-b p-3">
            <Button
              type="button"
              data-testid="local-workspace-chat-tab"
              size="sm"
              variant={tab === "chat" ? "default" : "secondary"}
              className="gap-1.5"
              onClick={() => setTab("chat")}
            >
              <MessageSquare className="h-4 w-4" />
              Board Chat
            </Button>
            <Button
              type="button"
              data-testid="local-workspace-memory-tab"
              size="sm"
              variant={tab === "memory" ? "default" : "secondary"}
              className="gap-1.5"
              onClick={() => setTab("memory")}
            >
              <Brain className="h-4 w-4" />
              Board Memory
            </Button>
          </div>

          {tab === "chat" ? (
            <section data-testid="local-chat-panel" className="flex min-h-0 flex-1 flex-col">
              <div data-testid="local-chat-messages" className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
                {messages.length === 0 ? (
                  <div data-testid="local-chat-empty" className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                    还没有本地聊天消息。
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      data-testid={message.role === "user" ? "local-chat-user" : "local-chat-assistant"}
                      className={
                        message.role === "user"
                          ? "max-w-[85%] self-end rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                          : "max-w-[85%] self-start rounded-lg bg-muted px-3 py-2 text-sm text-foreground"
                      }
                    >
                      {message.text}
                    </div>
                  ))
                )}
              </div>
              <div className="border-t p-3">
                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    sendMessage();
                  }}
                >
                  <Input
                    data-testid="local-chat-input"
                    aria-label="Board Chat 输入"
                    placeholder="询问当前白板…"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                  <Button data-testid="local-chat-send" type="submit" size="sm" className="gap-1.5" disabled={!draft.trim()}>
                    <Send className="h-4 w-4" />
                    发送
                  </Button>
                </form>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Badge data-testid="local-chat-status" variant="muted">
                    {chatStatus}
                  </Badge>
                  <Button
                    type="button"
                    data-testid="local-chat-save-memory"
                    size="sm"
                    variant="secondary"
                    className="gap-1.5"
                    disabled={!messages.some((message) => message.role === "assistant")}
                    onClick={saveLatestReply}
                  >
                    <Save className="h-4 w-4" />
                    保存记忆
                  </Button>
                </div>
              </div>
            </section>
          ) : (
            <section data-testid="local-memory-panel" className="flex min-h-0 flex-1 flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Board Memory</h3>
                <Badge data-testid="local-memory-count" variant="muted">
                  {memories.length} 条
                </Badge>
              </div>
              <div className="flex gap-2">
                <Input
                  data-testid="local-memory-input"
                  aria-label="添加 Board Memory"
                  placeholder="添加一条白板记忆"
                  value={memoryDraft}
                  onChange={(event) => setMemoryDraft(event.target.value)}
                />
                <Button
                  type="button"
                  data-testid="local-memory-add"
                  size="sm"
                  className="gap-1.5"
                  disabled={!memoryDraft.trim()}
                  onClick={addMemory}
                >
                  <Plus className="h-4 w-4" />
                  添加
                </Button>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  data-testid="local-memory-search"
                  aria-label="搜索 Board Memory"
                  placeholder="搜索记忆"
                  value={memorySearch}
                  onChange={(event) => setMemorySearch(event.target.value)}
                  className="pl-8"
                />
              </div>
              <p data-testid="local-memory-status" className="text-xs text-muted-foreground">
                {memoryStatus}
              </p>
              <div data-testid="local-memory-list" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                {visibleMemories.length === 0 ? (
                  <div data-testid="local-memory-empty" className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                    没有匹配的 Board Memory。
                  </div>
                ) : (
                  visibleMemories.map((memory) => (
                    <div
                      key={memory.id}
                      data-testid="local-memory-item"
                      className="flex items-start justify-between gap-2 rounded-lg border bg-card p-3"
                    >
                      <p className="text-sm text-foreground">{memory.text}</p>
                      <Button
                        type="button"
                        data-testid="local-memory-delete"
                        size="icon"
                        variant="ghost"
                        aria-label="删除 Board Memory"
                        onClick={() => deleteMemory(memory.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}
        </aside>
      )}
    </>
  );
}
