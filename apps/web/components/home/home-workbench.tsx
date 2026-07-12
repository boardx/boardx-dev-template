"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EMPTY_AGENT_GROUPS, type Agent, type AgentGroupKey, type AgentGroups } from "@/lib/agents";

interface SessionUser {
  displayName: string;
}

const GROUPS: { key: AgentGroupKey; title: string }[] = [
  { key: "recent", title: "Recently used" },
  { key: "subscribed", title: "My subscribed" },
  { key: "recommended", title: "Team recommended" },
];

// 柔彩底色循环（对齐设计 agent 图标块）。
const TAG_FILLS = ["bg-tag-green", "bg-tag-blue", "bg-tag-purple", "bg-tag-pink", "bg-tag-yellow"];
function fillFor(id: string | number) {
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return TAG_FILLS[h % TAG_FILLS.length];
}

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div
      data-testid={`agent-${agent.id}`}
      className="rounded-12 border border-border p-3.75 transition-all hover:border-border-strong hover:shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
    >
      <div className="flex items-center gap-2.5">
        <div className={`flex h-8.5 w-8.5 items-center justify-center rounded-9 text-15 ${fillFor(agent.id)}`}>
          {agent.name.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm font-semibold text-foreground">{agent.name}</span>
      </div>
      <p className="mt-2.5 min-h-9 text-13 leading-relaxed text-muted-foreground">
        {agent.description}
      </p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-11 text-placeholder">{agent.model ?? agent.source ?? ""}</span>
        <Button
          variant="outline"
          size="sm"
          className="h-auto whitespace-nowrap rounded-7 border-foreground px-2.75 py-1.25 text-xs hover:bg-primary hover:text-primary-foreground"
        >
          Quick chat
        </Button>
      </div>
    </div>
  );
}

function GroupEmptyState({ groupKey }: { groupKey: AgentGroupKey }) {
  return (
    <div
      data-testid={`empty-${groupKey}`}
      className="flex flex-col items-start gap-3 rounded-12 border border-dashed border-border p-6"
    >
      <p className="text-13 text-muted-foreground">No agents here yet.</p>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => (window.location.href = "/ai-store")} data-testid={`enter-store-${groupKey}`}>
          Browse AI Store
        </Button>
        <Button size="sm" variant="ghost" onClick={() => (window.location.href = "/ai-store/create")} data-testid={`create-agent-${groupKey}`}>
          Create agent
        </Button>
      </div>
    </div>
  );
}

export function HomeWorkbench() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [groups] = useState<AgentGroups>(EMPTY_AGENT_GROUPS);
  const [recentBoards, setRecentBoards] = useState<{ id: number | string; public_id: string; name: string }[]>([]);
  const [guideDismissed, setGuideDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage.getItem("home_guide_dismissed") === "1") {
      setGuideDismissed(true);
    }
  }, []);

  function dismissGuide() {
    setGuideDismissed(true);
    if (typeof window !== "undefined") window.localStorage.setItem("home_guide_dismissed", "1");
  }

  function reopenGuide() {
    setGuideDismissed(false);
    if (typeof window !== "undefined") window.localStorage.removeItem("home_guide_dismissed");
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await (await fetch("/api/auth/session")).json();
      if (!alive) return;
      if (!s.user) {
        router.replace("/login");
        return;
      }
      setUser(s.user);
      const cur = await (await fetch("/api/teams/current")).json();
      if (cur.teamId) {
        const ts = await (await fetch("/api/teams")).json();
        const t = (ts.teams ?? []).find((x: { id: number | string }) => String(x.id) === String(cur.teamId));
        if (alive) setTeamName(t?.name ?? null);
      }
      const rb = await (await fetch("/api/boards?scope=recent")).json();
      if (alive) setRecentBoards(rb.boards ?? []);
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div data-testid="loading" className="mx-auto flex max-w-content animate-pulse flex-col gap-6 px-9 py-10">
        <div className="h-10 w-1/2 rounded bg-muted" />
        <div className="h-12 w-full rounded bg-muted" />
        <div className="h-32 w-full rounded bg-muted" />
      </div>
    );
  }

  const totalAgents = GROUPS.reduce((n, g) => n + groups[g.key].length, 0);

  return (
    <div className="mx-auto max-w-content px-9 pb-14 pt-10">
      {/* 欢迎区 */}
      <section data-testid="home-welcome" className="flex flex-col gap-1">
        <h1 className="text-26 font-bold tracking-tight text-foreground">
          Hello, <span data-testid="home-username">{user?.displayName}</span>
        </h1>
        {teamName && (
          <p className="text-sm text-muted-foreground">
            Team · <span data-testid="home-team">{teamName}</span>
          </p>
        )}
      </section>

      {/* 搜索框 */}
      <div className="relative mt-5.5">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-placeholder" />
        <Input
          data-testid="agent-search"
          placeholder="Search agents by name, description or tag…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-12 rounded-11 pl-10"
        />
      </div>

      {/* 最近白板（Continue 卡片列表） */}
      <section data-testid="recent-boards" className="mt-3.5">
        {recentBoards.length === 0 ? (
          <div
            data-testid="recent-boards-empty"
            className="flex items-center gap-3 rounded-11 border border-foreground px-4 py-3"
          >
            <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
              AI
            </div>
            <div className="flex-1">
              <div className="text-13 font-semibold text-foreground">No recent boards yet</div>
              <div className="mt-px text-xs text-muted-foreground">Create one in a room to get started</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => router.push("/rooms")} data-testid="goto-rooms">
              Go to rooms
            </Button>
          </div>
        ) : (
          <ul data-testid="recent-boards-list" className="flex flex-col gap-2">
            {recentBoards.map((b) => (
              <li key={String(b.id)} data-testid={`recent-board-${b.id}`}>
                <a
                  href={`/boards/${b.public_id}`}
                  className="flex items-center gap-3 rounded-11 border border-border px-4 py-3 transition-all hover:border-border-strong hover:bg-surface-1"
                >
                  <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                    {b.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 text-13 font-semibold text-foreground">{b.name}</span>
                  <ArrowRight className="h-4 w-4 text-placeholder" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 新用户引导（无 Agent 时） */}
      {totalAgents === 0 &&
        (guideDismissed ? (
          <Button
            data-testid="onboarding-reopen"
            size="sm"
            variant="ghost"
            className="mt-7 self-start"
            onClick={reopenGuide}
          >
            Show getting-started guide
          </Button>
        ) : (
          <div
            data-testid="onboarding"
            className="mt-7 flex flex-col gap-3 rounded-12 border border-border bg-surface-1 p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-foreground">Welcome to BoardX 👋</p>
                <p className="text-13 text-muted-foreground">
                  Subscribe an agent from the AI Store, or create your own, to start AI-native work.
                </p>
              </div>
              <Button data-testid="onboarding-dismiss" size="sm" variant="ghost" onClick={dismissGuide}>
                Dismiss
              </Button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" data-testid="onboarding-store" onClick={() => (window.location.href = "/ai-store")}>
                Browse AI Store
              </Button>
              <Button size="sm" variant="ghost" data-testid="onboarding-create" onClick={() => (window.location.href = "/ai-store/create")}>
                Create agent
              </Button>
            </div>
          </div>
        ))}

      {/* Agent 分组 */}
      <div className="mt-2">
        {GROUPS.map((g) => {
          const items = groups[g.key];
          return (
            <section key={g.key} data-testid={`group-${g.key}`} className="mt-7">
              <h2 className="mb-3 text-13 font-semibold text-foreground">{g.title}</h2>
              {items.length === 0 ? (
                <GroupEmptyState groupKey={g.key} />
              ) : (
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((a) => (
                    <AgentCard key={String(a.id)} agent={a} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
