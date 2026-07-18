"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Plus, Users } from "lucide-react";
import { cn } from "@/lib/utils";

// uc-team-002「前端入口：左侧团队头像菜单」——侧栏 rail 顶部的团队切换器。
// oldcode 参照：boardx-web-develop/src/components/navigation/TeamSelector.tsx（Slack 式
// workspace 切换器）。数据与权限完全复用既有 API：GET /api/teams（含 role/team_type）、
// GET/POST /api/teams/current（服务端 getMembership 校验，前端不重复实现鉴权）。
interface TeamRow {
  id: number | string;
  name: string;
  team_type?: string | null;
  role?: string | null;
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// team_type 数据库值 → 展示标签（uc-team-002：Personal / Enterprise 类型标识）。
function typeLabel(t?: string | null) {
  if (!t) return "Personal";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function TeamSwitcher() {
  const [open, setOpen] = useState(false);
  const [teams, setTeams] = useState<TeamRow[] | null>(null);
  const [currentId, setCurrentId] = useState<number | string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 打开时才拉取（与账号菜单的余额拉取同一模式），保证列表/当前团队总是新鲜的。
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        const [ts, cur] = await Promise.all([
          fetch("/api/teams").then((r) => (r.ok ? r.json() : { teams: [] })),
          fetch("/api/teams/current").then((r) => (r.ok ? r.json() : { teamId: null })),
        ]);
        if (!alive) return;
        setTeams(ts.teams ?? []);
        setCurrentId(cur.teamId ?? null);
      } catch {
        if (alive) setTeams([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const current = teams?.find((t) => String(t.id) === String(currentId)) ?? null;

  async function switchTo(team: TeamRow) {
    // A1：点击当前团队不重复切换。
    if (String(team.id) === String(currentId) || switching) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    setError(false);
    try {
      const res = await fetch("/api/teams/current", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teamId: team.id }),
      });
      if (!res.ok) throw new Error(String(res.status));
      // 主流程第 7 步：切换完成后进入 Home。整页跳转让全部服务端组件
      // （rooms/成员/AI Store 等）以新团队 cookie 重新渲染，不做局部刷新。
      window.location.href = "/";
    } catch {
      // E2：切换失败提示，当前团队保持不变。
      setSwitching(false);
      setError(true);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="切换团队"
        aria-label="团队菜单"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="team-switcher"
        className={cn(
          "mb-1.5 flex h-8.5 w-8.5 items-center justify-center rounded-9 text-11 font-semibold transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open
            ? "bg-muted text-foreground"
            : "bg-surface-2 text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        {current ? initialsOf(current.name) : <Users className="h-4 w-4" />}
      </button>

      {open && (
        <div
          role="menu"
          data-testid="team-switcher-popup"
          className="absolute left-[3.25rem] top-0 z-50 w-64 rounded-12 border border-border bg-popover p-2 shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
        >
          {teams == null ? (
            <div data-testid="team-switcher-loading" className="px-2.5 py-3">
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            </div>
          ) : (
            <>
              {/* 菜单顶部：当前团队名称 + 首字母 + 角色 + 类型（uc-team-002 主流程第 2 步） */}
              {current ? (
                <div
                  data-testid="team-switcher-current"
                  className="flex items-center gap-2.5 px-2 pb-2.5 pt-2"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-9 bg-foreground text-13 font-semibold text-background">
                    {initialsOf(current.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-13 font-semibold text-foreground">
                      {current.name}
                    </div>
                    <div className="text-11 capitalize text-placeholder">
                      {current.role ?? "member"} · {typeLabel(current.team_type)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="px-2.5 pb-2 pt-2 text-13 font-semibold text-foreground">
                  Teams
                </div>
              )}

              {error && (
                <p
                  role="alert"
                  data-testid="team-switcher-error"
                  className="mx-1 mb-1.5 rounded-7 bg-surface-2 px-2 py-1.5 text-11 text-destructive"
                >
                  Failed to switch team. Please try again.
                </p>
              )}

              {teams.length === 0 ? (
                // E1：无团队空态 + 创建入口。
                <div
                  data-testid="team-switcher-empty"
                  className="mx-1 mb-1 rounded-9 border border-dashed border-border px-2.5 py-3 text-12 text-muted-foreground"
                >
                  No teams yet. Create one to collaborate.
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto">
                  <div className="px-2.5 pb-0.5 text-10 font-semibold uppercase text-placeholder">
                    Team list
                  </div>
                  {teams.map((t) => {
                    const active = String(t.id) === String(currentId);
                    return (
                      <button
                        key={String(t.id)}
                        type="button"
                        role="menuitem"
                        data-testid={`team-switcher-item-${t.id}`}
                        aria-current={active ? "true" : undefined}
                        disabled={switching}
                        onClick={() => switchTo(t)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-7 px-2.5 py-2 text-13 transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          active ? "bg-muted text-foreground" : "text-foreground hover:bg-muted",
                          switching && "opacity-60",
                        )}
                      >
                        <span className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-7 bg-surface-2 text-10 font-semibold text-foreground">
                          {initialsOf(t.name)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-left">{t.name}</span>
                        <span className="text-10 text-placeholder">{typeLabel(t.team_type)}</span>
                        {active && <Check className="h-3.5 w-3.5 shrink-0 text-foreground" />}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mx-1.5 my-1.5 h-px bg-muted" />

              <Link
                role="menuitem"
                href="/teams"
                data-testid="team-switcher-manage"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-7 px-2.5 py-2 text-13 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Users className="h-3.5 w-3.5" /> Manage team
              </Link>
              <Link
                role="menuitem"
                href="/teams"
                data-testid="team-switcher-create"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-7 px-2.5 py-2 text-13 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="h-3.5 w-3.5" /> Create team
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
