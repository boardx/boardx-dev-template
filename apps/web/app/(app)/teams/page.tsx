"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TeamWithRole {
  id: number | string;
  name: string;
  role: string;
}

function TeamSkeleton() {
  return (
    <div data-testid="loading" className="flex flex-col gap-2 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-14 rounded-lg bg-muted" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      data-testid="empty"
      className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border py-12 text-center"
    >
      <p className="text-sm text-muted-foreground">还没有团队，创建第一个试试</p>
    </div>
  );
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamWithRole[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/teams");
    if (res.status === 401) {
      setError("请先登录");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setTeams(data.teams ?? []);
    const cur = await (await fetch("/api/teams/current")).json();
    setCurrent(cur.teamId != null ? String(cur.teamId) : null);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

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
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">我的团队</h1>
      </div>

      {error && (
        <p role="alert" data-testid="err" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Create form */}
      <form
        onSubmit={create}
        className="flex gap-2 rounded-lg border bg-card p-4 shadow-sm"
      >
        <Input
          data-testid="team-name"
          placeholder="团队名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1"
        />
        <Button data-testid="create" type="submit">
          创建团队
        </Button>
      </form>

      {/* Content */}
      {loading ? (
        <TeamSkeleton />
      ) : teams.length === 0 ? (
        <EmptyState />
      ) : (
        <ul data-testid="team-list" className="flex flex-col gap-2">
          {teams.map((t) => (
            <li
              key={t.id}
              data-testid={`team-${t.id}`}
              className={cn(
                "flex items-center justify-between rounded-lg border bg-card px-4 py-3",
                "text-card-foreground shadow-sm",
                "transition-all duration-200 hover:shadow-md hover:border-border/70",
              )}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                {t.name}
                <span className="text-xs text-muted-foreground">({t.role})</span>
                {current === String(t.id) && (
                  <Badge data-testid="current-mark" variant="secondary">
                    当前
                  </Badge>
                )}
              </span>
              <Button
                data-testid={`switch-${t.id}`}
                variant="outline"
                size="sm"
                onClick={() => switchTeam(t.id)}
                className="transition-colors duration-200"
              >
                切换
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
