"use client";
// p23-F10「我」视角首页：登录后第一屏，10 秒内知道"我现在该干什么"（ADR-011 P2 解锁）。
// 四象限，全部按当前 Access 身份过滤（/api/portal/my-home）；待拍板计数由 shell 传入
// （复用其 discussions 轮询，不重复抓取）。任一象限未配置/空 → 诚实空态，不虚构。
import { useEffect, useState } from "react";
import { portalFetch } from "@/lib/portal-fetch";
import { Badge } from "@/components/ui/badge";
import { PortalCard } from "@/components/portal/portal-card";

interface MyAgent {
  id: string;
  kind: string;
  role: string | null;
  lease: string | null;
  heartbeat_age_min: number | null;
  fresh: boolean;
}
interface MyPr {
  number: number;
  title: string;
  url: string;
  age_hours: number;
  stale: boolean;
}
interface MyHome {
  login: string | null;
  agents: MyAgent[];
  coord_configured: boolean;
  prs: { configured: true; items: MyPr[] } | { configured: false };
  flow_hours_median: number | null;
  flow_configured: boolean;
  generated_at: string;
}

function fmtAge(h: number): string {
  return h < 1 ? `${Math.round(h * 60)}分钟` : `${h.toFixed(1)}h`;
}

export function MeTab({ developer, decideCount }: { developer: { name: string; email: string }; decideCount: number | null }) {
  const [data, setData] = useState<MyHome | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "degraded">("loading");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await portalFetch("/api/portal/my-home");
        if (!res) return; // 401 → 正在整页重新认证
        if (!res.ok) {
          if (!cancelled) setState("degraded");
          return;
        }
        const body = (await res.json()) as MyHome;
        if (!cancelled) {
          setData(body);
          setState("ready");
        }
      } catch {
        if (!cancelled) setState("degraded");
      }
    }
    void load();
    const timer = setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (state === "loading") return <PortalCard state="loading" title="我的视角"><span /></PortalCard>;
  if (state === "degraded" || !data) return <PortalCard state="degraded" title="我的视角"><span /></PortalCard>;

  const stalePrs = data.prs.configured ? data.prs.items.filter((p) => p.stale) : [];
  const activeAgents = data.agents.filter((a) => a.fresh);

  return (
    <div className="space-y-4" data-testid="me-home">
      <p className="text-13 text-muted-foreground">
        👋 {developer.name}，这是你的视角——10 秒看清"现在该干什么"。
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* 象限 1：我的 agent 队伍 */}
        <PortalCard state="ready" title={`我的 agent 队伍（${data.agents.length}）`}>
          {data.agents.length === 0 ? (
            <p className="text-13 text-muted-foreground">你名下还没有登记的 agent——去「加入开发」onboarding。</p>
          ) : (
            <ul className="space-y-1.5" data-testid="my-agents">
              {data.agents.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 rounded-8 px-2 py-1.5 hover:bg-muted">
                  <span className="min-w-0">
                    <span className="block truncate text-13 text-foreground">{a.id}</span>
                    <span className="block text-11 text-muted-foreground">{a.role ?? a.kind}</span>
                  </span>
                  {!data.coord_configured ? (
                    <Badge variant="muted" className="shrink-0 text-11">协调未接线</Badge>
                  ) : a.fresh ? (
                    <Badge variant="outline" className="shrink-0 text-11">🟢 {a.lease}</Badge>
                  ) : (
                    <Badge variant="muted" className="shrink-0 text-11">空闲</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
          {data.coord_configured && data.agents.length > 0 && (
            <p className="mt-2 text-11 text-muted-foreground">{activeAgents.length} 个在干活 · {data.agents.length - activeAgents.length} 个空闲</p>
          )}
        </PortalCard>

        {/* 象限 2：我卡住的 PR */}
        <PortalCard state="ready" title="我卡住的 PR">
          {!data.prs.configured ? (
            <p className="text-13 text-muted-foreground">GitHub 数据源未接线。</p>
          ) : stalePrs.length === 0 ? (
            <p className="text-13 text-muted-foreground">
              {data.prs.items.length === 0 ? "你当前没有 open PR。" : `你有 ${data.prs.items.length} 个 open PR，都在正常推进（没有超期）。`}
            </p>
          ) : (
            <ul className="space-y-1.5" data-testid="my-stale-prs">
              {stalePrs.map((p) => (
                <li key={p.number} className="rounded-8 border border-destructive/40 bg-destructive/5 px-2 py-1.5">
                  <a href={p.url} target="_blank" rel="noopener" className="block truncate text-13 text-foreground underline">
                    #{p.number} {p.title}
                  </a>
                  <span className="text-11 text-destructive">已开 {fmtAge(p.age_hours)} · 超 1 个周期未动</span>
                </li>
              ))}
            </ul>
          )}
        </PortalCard>

        {/* 象限 3：@我的待拍板 */}
        <PortalCard state="ready" title="@我的待拍板">
          {decideCount === null ? (
            <p className="text-13 text-muted-foreground">讨论流数据源未接线。</p>
          ) : decideCount === 0 ? (
            <p className="text-13 text-muted-foreground">没有等你拍板的事项 ✓</p>
          ) : (
            <div data-testid="my-decisions" className="flex items-center gap-3">
              <span className="text-30 font-bold text-foreground">{decideCount}</span>
              <span className="text-13 text-muted-foreground">项决策在等你——系统无法替你做这些决定。</span>
            </div>
          )}
        </PortalCard>

        {/* 象限 4：我的 flow-time */}
        <PortalCard state="ready" title="我的 flow-time（PR 开→合 中位）">
          {!data.flow_configured ? (
            <p className="text-13 text-muted-foreground">GitHub 数据源未接线。</p>
          ) : data.flow_hours_median === null ? (
            <p className="text-13 text-muted-foreground">还没有已合并的 PR 可统计。</p>
          ) : (
            <div data-testid="my-flow-time">
              <span className="text-30 font-bold text-foreground">{data.flow_hours_median}h</span>
              <p className="mt-1 text-11 text-muted-foreground">你近期已合并 PR 的开出→合并中位时长。越短越好。</p>
            </div>
          )}
        </PortalCard>
      </div>
    </div>
  );
}
