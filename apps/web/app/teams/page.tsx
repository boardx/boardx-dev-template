"use client";
import { useEffect, useState } from "react";

interface TeamWithRole {
  id: number | string; // pg bigint 序列化为 string，统一按字符串比较
  name: string;
  role: string;
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamWithRole[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/teams");
    if (res.status === 401) {
      setError("请先登录");
      return;
    }
    const data = await res.json();
    setTeams(data.teams ?? []);
    const cur = await (await fetch("/api/teams/current")).json();
    setCurrent(cur.teamId != null ? String(cur.teamId) : null);
  }
  useEffect(() => {
    void load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.status === 201) {
      setName("");
      await load();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.errors?.name ?? d.error ?? "创建失败");
    }
  }

  async function switchTeam(id: number | string) {
    await fetch("/api/teams/current", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ teamId: id }),
    });
    await load();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-bold">我的团队</h1>
      {error && <p data-testid="err" className="text-red-600">{error}</p>}
      <form onSubmit={create} className="flex gap-2">
        <input data-testid="team-name" placeholder="团队名称" className="flex-1 rounded border px-3 py-2"
          value={name} onChange={(e) => setName(e.target.value)} />
        <button data-testid="create" className="rounded bg-neutral-900 px-4 py-2 text-white">创建团队</button>
      </form>
      <ul data-testid="team-list" className="flex flex-col gap-2">
        {teams.map((t) => (
          <li key={t.id} data-testid={`team-${t.id}`}
            className="flex items-center justify-between rounded border px-3 py-2">
            <span>
              {t.name} <span className="text-xs text-neutral-500">({t.role})</span>
              {current === String(t.id) && <span data-testid="current-mark" className="ml-2 text-green-600">· 当前</span>}
            </span>
            <button data-testid={`switch-${t.id}`} onClick={() => switchTeam(t.id)}
              className="rounded bg-neutral-200 px-2 py-1 text-sm">切换</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
