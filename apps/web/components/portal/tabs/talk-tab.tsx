"use client";
// 讨论流板块（p23/F06）：聚合人类 + AI 讨论，权威在 GitHub（门户只读聚合，不提供评论输入）。
// 数据源 GET /api/portal/discussions（F02）。界面契约 = p23 ui-signoff 确认的 v3 原型 TalkTab：
// 👤/🤖/⚡待拍板 过滤按钮；排序待拍板优先；巡检类（【coord-* 巡检】开头）默认折叠可展开；
// 待拍板卡红框高亮 + 问题首行加粗放大（data-testid="decide-question"）+ 快捷回应跳评论；
// 其它条目"去 GitHub 回复 →"。configured:false → PortalCard unconfigured 态（诚实降级）。
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { PortalCard, type PortalCardState } from "@/components/portal/portal-card";
import { cn } from "@/lib/utils";

interface DiscussionItem {
  who: string;
  isAgent: boolean;
  at: string;
  src: string;
  url: string;
  excerpt: string;
  needsHuman: boolean;
}

interface DiscussionsPayload {
  configured: boolean;
  items?: DiscussionItem[];
  needs_human_count?: number;
}

const REFRESH_MS = 60_000;

type Filter = "all" | "human" | "ai" | "decide";

/** 巡检类低优先条目：总线巡检评论形如"【coord-xxx 巡检】…"——默认折叠降噪。 */
function isPatrol(d: DiscussionItem): boolean {
  return d.excerpt.startsWith("【coord-") && d.excerpt.includes("巡检");
}

/** 相对时间（中文），与门户其它板块口吻一致。 */
function relTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const sec = Math.max(0, (Date.now() - t) / 1000);
  if (sec < 60) return `${Math.round(sec)} 秒前`;
  if (sec < 3600) return `${Math.round(sec / 60)} 分钟前`;
  if (sec < 86_400) return `${Math.round(sec / 3600)} 小时前`;
  if (sec < 2 * 86_400) return "昨天";
  return `${Math.floor(sec / 86_400)} 天前`;
}

export function TalkTab() {
  const [state, setState] = useState<PortalCardState>("loading");
  const [items, setItems] = useState<DiscussionItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [showPatrol, setShowPatrol] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/portal/discussions");
        if (cancelled) return;
        if (!res.ok) {
          setState("degraded");
          return;
        }
        const body = (await res.json()) as DiscussionsPayload;
        if (cancelled) return;
        if (!body.configured) {
          setState("unconfigured");
          return;
        }
        setItems(body.items ?? []);
        setState("ready");
      } catch {
        if (!cancelled) setState("degraded");
      }
    }
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const decideCount = items.filter((d) => d.needsHuman).length;
  const patrolCount = items.filter(isPatrol).length;
  const list = items
    .filter((d) => (filter === "all" ? true : filter === "human" ? !d.isAgent : filter === "ai" ? d.isAgent : d.needsHuman))
    .filter((d) => (showPatrol ? true : !isPatrol(d)))
    // 排序待拍板优先；同级维持 API 的时间倒序（items 已按时间倒序返回）
    .sort((a, b) => Number(b.needsHuman) - Number(a.needsHuman));

  return (
    <PortalCard
      title="讨论流（人类 + AI · 权威在 GitHub，此处聚合）"
      state={state}
      wide
      unconfiguredHint="讨论流数据源尚未接线（GITHUB_TOKEN/GITHUB_REPO 未配置）——这是部署中间态，不是故障。"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2" data-testid="talk-filters">
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>全部</Button>
        <Button size="sm" variant={filter === "human" ? "default" : "outline"} onClick={() => setFilter("human")}>👤 人类</Button>
        <Button size="sm" variant={filter === "ai" ? "default" : "outline"} onClick={() => setFilter("ai")}>🤖 AI</Button>
        <Button size="sm" variant={filter === "decide" ? "default" : "outline"} onClick={() => setFilter("decide")}>
          ⚡ 待人类拍板{decideCount > 0 && <Badge variant="destructive" className="ml-1 px-1.5 text-11">{decideCount}</Badge>}
        </Button>
      </div>
      {list.length === 0 ? (
        <p className="text-13 text-muted-foreground">当前过滤条件下暂无讨论条目。</p>
      ) : (
        <ul className="space-y-2" data-testid="talk-stream">
          {list.map((d) => {
            const lines = d.excerpt.split("\n").filter((l) => l.trim() !== "");
            const firstLine = lines[0] ?? d.excerpt;
            const rest = lines.slice(1).join(" ");
            return (
              <li
                key={d.url}
                className={`rounded-8 border p-3 transition-colors duration-200 hover:bg-muted ${d.needsHuman ? "border-destructive/40 bg-destructive/5" : "border-border"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-13 font-medium text-foreground">{d.isAgent ? "🤖" : "👤"} {d.who}</span>
                  <span className="shrink-0 text-11 text-muted-foreground">{d.src} · {relTime(d.at)}</span>
                </div>
                {d.needsHuman ? (
                  <>
                    <p data-testid="decide-question" className="mt-2 text-15 font-bold text-foreground">{firstLine}</p>
                    {rest && <p className="mt-1 text-13 text-foreground">{rest}</p>}
                  </>
                ) : (
                  <p className="mt-1 whitespace-pre-line text-13 text-foreground">{d.excerpt}</p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  {d.needsHuman ? (
                    <>
                      <Badge variant="destructive" className="text-11">待人类拍板</Badge>
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "h-6 px-2 text-11")}
                      >
                        快捷回应（跳该评论回复）
                      </a>
                    </>
                  ) : (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(buttonVariants({ variant: "link", size: "sm" }), "h-6 px-0 text-11")}
                    >
                      去 GitHub 回复 →
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {state === "ready" && patrolCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 text-11 text-muted-foreground"
          data-testid="patrol-toggle"
          onClick={() => setShowPatrol(!showPatrol)}
        >
          {showPatrol ? "收起" : "展开"}巡检类低优先条目（{patrolCount}）{showPatrol ? "↑" : "↓"}
        </Button>
      )}
    </PortalCard>
  );
}
