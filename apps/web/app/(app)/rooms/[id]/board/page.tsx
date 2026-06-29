"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { BoardItem } from "@repo/canvas";
import { Button } from "@/components/ui/button";

export default function BoardPage() {
  const roomId = String(useParams().id);
  const [items, setItems] = useState<BoardItem[]>([]);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch(`/api/rooms/${roomId}/items`);
    if (res.status === 401) return setError("请先登录");
    if (res.status === 403) return setError("无权访问该房间");
    setItems((await res.json()).items ?? []);
  }
  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function addNote() {
    await fetch(`/api/rooms/${roomId}/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "note", x: 20 + items.length * 24, y: 20 + items.length * 24, text: "新便签" }),
    });
    await load();
  }

  async function editText(id: string, text: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, text } : it)));
    await fetch(`/api/items/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
  }

  async function remove(id: string) {
    await fetch(`/api/items/${id}`, { method: "DELETE" });
    await load();
  }

  if (error)
    return (
      <div className="p-8">
        <p data-testid="board-error" className="text-sm text-destructive">{error}</p>
      </div>
    );

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Board · Room {roomId}</h1>
        <Button data-testid="add-note" size="sm" onClick={addNote}>添加便签</Button>
        <span data-testid="item-count" className="text-sm text-muted-foreground">{items.length} 个</span>
      </div>
      <div data-testid="board" className="relative h-[70vh] w-full overflow-hidden rounded-lg border border-border bg-muted/40">
        {items.map((it) => (
          <div key={it.id} data-testid={`item-${it.id}`}
            className="absolute rounded-md border border-border bg-card p-1 text-card-foreground shadow-sm"
            style={{ left: it.x, top: it.y, width: it.w, height: it.h }}>
            <input data-testid={`text-${it.id}`}
              className="w-full bg-transparent text-sm text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
              defaultValue={it.text} onBlur={(e) => editText(it.id, e.target.value)} />
            <button data-testid={`del-${it.id}`} onClick={() => remove(it.id)}
              className="absolute right-1 top-1 text-xs text-destructive transition-colors duration-200 hover:text-destructive/80">×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
