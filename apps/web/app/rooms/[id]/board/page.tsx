"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { BoardItem } from "@repo/canvas";

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

  if (error) return <main className="p-8"><p data-testid="board-error" className="text-red-600">{error}</p></main>;

  return (
    <main className="flex min-h-screen flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">Board · Room {roomId}</h1>
        <button data-testid="add-note" onClick={addNote}
          className="rounded bg-neutral-900 px-3 py-1 text-sm text-white">添加便签</button>
        <span data-testid="item-count" className="text-sm text-neutral-500">{items.length} 个</span>
      </div>
      <div data-testid="board" className="relative h-[70vh] w-full overflow-hidden rounded border bg-neutral-50">
        {items.map((it) => (
          <div key={it.id} data-testid={`item-${it.id}`}
            className="absolute rounded border border-yellow-400 bg-yellow-100 p-1 shadow"
            style={{ left: it.x, top: it.y, width: it.w, height: it.h }}>
            <input data-testid={`text-${it.id}`} className="w-full bg-transparent text-sm outline-none"
              defaultValue={it.text} onBlur={(e) => editText(it.id, e.target.value)} />
            <button data-testid={`del-${it.id}`} onClick={() => remove(it.id)}
              className="absolute right-1 top-1 text-xs text-red-600">×</button>
          </div>
        ))}
      </div>
    </main>
  );
}
