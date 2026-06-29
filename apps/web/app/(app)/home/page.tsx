"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EMPTY_AGENT_GROUPS, type Agent, type AgentGroupKey, type AgentGroups } from "@/lib/agents";

interface SessionUser {
  displayName: string;
}

const GROUPS: { key: AgentGroupKey; title: string }[] = [
  { key: "recent", title: "最近使用的 Agent" },
  { key: "subscribed", title: "我订阅的 Agent" },
  { key: "recommended", title: "团队推荐的 Agent" },
];

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div
      data-testid={`agent-${agent.id}`}
      className="flex min-w-[16rem] flex-col gap-2 rounded-lg border bg-card p-4 shadow-sm"
    >
      <span className="text-sm font-semibold text-foreground">{agent.name}</span>
      {agent.description && <span className="text-xs text-muted-foreground">{agent.description}</span>}
      <div className="flex flex-wrap gap-1">
        {(agent.tags ?? []).map((t) => (
          <Badge key={t} variant="muted">
            {t}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function GroupEmptyState({ groupKey }: { groupKey: AgentGroupKey }) {
  return (
    <div
      data-testid={`empty-${groupKey}`}
      className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border p-6"
    >
      <p className="text-sm text-muted-foreground">这里还没有 Agent</p>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => (window.location.href = "/ai-store")} data-testid={`enter-store-${groupKey}`}>
          进入 AI Store
        </Button>
        <Button size="sm" variant="ghost" onClick={() => (window.location.href = "/ai-store/create")} data-testid={`create-agent-${groupKey}`}>
          创建 Agent
        </Button>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [groups] = useState<AgentGroups>(EMPTY_AGENT_GROUPS);
  const [loading, setLoading] = useState(true);

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
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div data-testid="loading" className="mx-auto flex max-w-4xl animate-pulse flex-col gap-6 p-6">
        <div className="h-10 w-1/2 rounded bg-muted" />
        <div className="h-10 w-full rounded bg-muted" />
        <div className="h-32 w-full rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-6">
      {/* 欢迎区 */}
      <section data-testid="home-welcome" className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          你好，<span data-testid="home-username">{user?.displayName}</span>
        </h1>
        {teamName && (
          <p className="text-sm text-muted-foreground">
            当前团队：<span data-testid="home-team">{teamName}</span>
          </p>
        )}
      </section>

      {/* 搜索框（过滤逻辑见 F03） */}
      <Input
        data-testid="agent-search"
        placeholder="搜索 Agent 名称、描述或标签…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {/* Agent 分组：有数据渲染卡片，无数据渲染空状态 + 入口 */}
      <div className="flex flex-col gap-6">
        {GROUPS.map((g) => {
          const items = groups[g.key];
          return (
            <section key={g.key} data-testid={`group-${g.key}`} className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-foreground">{g.title}</h2>
              {items.length === 0 ? (
                <GroupEmptyState groupKey={g.key} />
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2">
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
