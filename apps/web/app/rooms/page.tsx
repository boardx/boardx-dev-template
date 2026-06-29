"use client";
import { useEffect, useState } from "react";

interface Room {
  id: number | string;
  name: string;
  visibility: string;
  team_id: number | string | null;
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  async function load(search = "") {
    const res = await fetch(`/api/rooms${search ? `?q=${encodeURIComponent(search)}` : ""}`);
    if (res.status === 401) {
      setError("请先登录");
      return;
    }
    setRooms((await res.json()).rooms ?? []);
  }
  useEffect(() => {
    void load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, visibility }),
    });
    if (res.status === 201) {
      setName("");
      await load(q);
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.errors?.name ?? d.error ?? "创建失败");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-bold">我的房间</h1>
      {error && <p data-testid="err" className="text-red-600">{error}</p>}
      <form onSubmit={create} className="flex gap-2">
        <input data-testid="room-name" placeholder="房间名称" className="flex-1 rounded border px-3 py-2"
          value={name} onChange={(e) => setName(e.target.value)} />
        <select data-testid="visibility" className="rounded border px-2"
          value={visibility} onChange={(e) => setVisibility(e.target.value)}>
          <option value="private">私有</option>
          <option value="team">团队可见</option>
        </select>
        <button data-testid="create" className="rounded bg-neutral-900 px-4 py-2 text-white">创建</button>
      </form>
      <div className="flex gap-2">
        <input data-testid="search" placeholder="搜索房间" className="flex-1 rounded border px-3 py-2"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <button data-testid="search-btn" onClick={() => load(q)} className="rounded bg-neutral-200 px-3 py-2">搜索</button>
      </div>
      <ul data-testid="room-list" className="flex flex-col gap-2">
        {rooms.map((r) => (
          <li key={String(r.id)} data-testid={`room-${r.id}`} className="rounded border px-3 py-2">
            {r.name} <span className="text-xs text-neutral-500">({r.visibility})</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
