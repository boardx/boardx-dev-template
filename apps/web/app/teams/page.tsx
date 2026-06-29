"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface TeamWithRole {
  id: number | string;
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
    if (res.status === 401) { setError("请先登录"); return; }
    const data = await res.json();
    setTeams(data.teams ?? []);
    const cur = await (await fetch("/api/teams/current")).json();
    setCurrent(cur.teamId != null ? String(cur.teamId) : null);
  }
  useEffect(() => { void load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/teams", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }),
    });
    if (res.status === 201) { setName(""); await load(); }
    else { const d = await res.json().catch(() => ({})); setError(d.errors?.name ?? d.error ?? "创建失败"); }
  }

  async function switchTeam(id: number | string) {
    await fetch("/api/teams/current", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ teamId: id }),
    });
    await load();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-5 p-8">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">我的团队</h1>
      {error && <p data-testid="err" className="text-sm text-destructive">{error}</p>}
      <form onSubmit={create} className="flex gap-2">
        <Input data-testid="team-name" placeholder="团队名称" value={name} onChange={(e) => setName(e.target.value)} />
        <Button data-testid="create" type="submit">创建团队</Button>
      </form>
      <ul data-testid="team-list" className="flex flex-col gap-2">
        {teams.map((t) => (
          <li key={t.id} data-testid={`team-${t.id}`}
            className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-card-foreground">
            <span className="text-sm">
              {t.name} <span className="text-xs text-muted-foreground">({t.role})</span>
              {current === String(t.id) && <Badge data-testid="current-mark" variant="secondary" className="ml-2">当前</Badge>}
            </span>
            <Button data-testid={`switch-${t.id}`} variant="outline" size="sm" onClick={() => switchTeam(t.id)}>切换</Button>
          </li>
        ))}
      </ul>
    </main>
  );
}
