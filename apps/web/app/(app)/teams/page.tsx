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

const TAG_FILLS = ["bg-tag-green", "bg-tag-blue", "bg-tag-purple", "bg-tag-pink", "bg-tag-yellow"];
function fillFor(id: string | number) {
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return TAG_FILLS[h % TAG_FILLS.length];
}

function TeamSkeleton() {
  return (
    <div data-testid="loading" className="flex flex-col gap-2 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-15 rounded-12 bg-muted" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      data-testid="empty"
      className="flex flex-col items-center gap-4 rounded-12 border border-dashed border-border-strong py-12 text-center"
    >
      <p className="text-13 text-muted-foreground">No teams yet — create your first one above.</p>
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
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-9 py-7">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-26 font-bold tracking-tight text-foreground">Teams</h1>
        <p className="text-13 text-muted-foreground">Create teams, switch context, and manage members.</p>
      </div>

      {error && (
        <p role="alert" data-testid="err" className="text-13 text-destructive">
          {error}
        </p>
      )}

      {/* Create form */}
      <form onSubmit={create} className="flex gap-2 rounded-12 border border-border bg-surface-1 p-4">
        <Input
          data-testid="team-name"
          placeholder="Team name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1"
        />
        <Button data-testid="create" type="submit">
          Create team
        </Button>
      </form>

      {/* Content */}
      {loading ? (
        <TeamSkeleton />
      ) : teams.length === 0 ? (
        <EmptyState />
      ) : (
        <ul data-testid="team-list" className="overflow-hidden rounded-12 border border-border">
          {teams.map((t, i) => (
            <li
              key={t.id}
              data-testid={`team-${t.id}`}
              className={cn(
                "flex items-center gap-3 px-4 py-3.25 transition-colors hover:bg-surface-1",
                i > 0 && "border-t border-muted",
              )}
            >
              <div className={cn("flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full text-13 font-semibold text-foreground/70", fillFor(t.id))}>
                {t.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-2">
                  <span className="truncate text-13 font-semibold text-foreground">{t.name}</span>
                  {current === String(t.id) && (
                    <Badge data-testid="current-mark" variant="secondary">
                      当前
                    </Badge>
                  )}
                </div>
                <span className="text-11 capitalize text-placeholder">{t.role}</span>
              </div>
              <Button
                data-testid={`switch-${t.id}`}
                variant="outline"
                size="sm"
                onClick={() => switchTeam(t.id)}
              >
                Switch
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
