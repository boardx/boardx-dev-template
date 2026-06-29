"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

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
    if (res.status === 401) { setError("请先登录"); return; }
    setRooms((await res.json()).rooms ?? []);
  }
  useEffect(() => { void load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/rooms", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, visibility }),
    });
    if (res.status === 201) { setName(""); await load(q); }
    else { const d = await res.json().catch(() => ({})); setError(d.errors?.name ?? d.error ?? "创建失败"); }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-5 p-8">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">我的房间</h1>
      {error && <p data-testid="err" className="text-sm text-destructive">{error}</p>}
      <form onSubmit={create} className="flex gap-2">
        <Input data-testid="room-name" placeholder="房间名称" value={name} onChange={(e) => setName(e.target.value)} />
        <Select data-testid="visibility" className="w-32" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
          <option value="private">私有</option>
          <option value="team">团队可见</option>
        </Select>
        <Button data-testid="create" type="submit">创建</Button>
      </form>
      <div className="flex gap-2">
        <Input data-testid="search" placeholder="搜索房间" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button data-testid="search-btn" variant="secondary" onClick={() => load(q)}>搜索</Button>
      </div>
      <ul data-testid="room-list" className="flex flex-col gap-2">
        {rooms.map((r) => (
          <li key={String(r.id)} data-testid={`room-${r.id}`}
            className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-card-foreground">
            <span className="text-sm">{r.name}</span>
            <Badge variant="muted">{r.visibility}</Badge>
          </li>
        ))}
      </ul>
    </main>
  );
}
