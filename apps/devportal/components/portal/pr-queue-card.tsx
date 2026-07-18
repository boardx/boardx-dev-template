"use client";
// p23/F04 「PR 队列」卡：GET /api/portal/prs（open PR 列表）驱动，按状态分组（评审中/草稿）。
// 堵点高亮：开出超 1 个工作周期（3h）未动（updated_at 距今 >3h）的行红框高亮
// （border-destructive/30 bg-destructive/5）+ 三个行动按钮：催办 / 认领 review / 去 GitHub。
// 催办与认领 review 当前形态 = 跳转到该 PR 的 GitHub 页（权威在 GitHub，门户不写入）。
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PortalCard, type PortalCardState } from "@/components/portal/portal-card";

const STALE_MS = 3 * 3600_000; // 1 个工作周期 = 3h

interface PrItem {
  number: number;
  title: string;
  url: string;
  draft: boolean;
  created_at: string;
  updated_at: string;
}
type PrsPayload =
  | { configured: false }
  | { configured: true; error: string }
  | { configured: true; items: PrItem[]; generated_at: string };

function ageHours(iso: string): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (Date.now() - t) / 3600_000);
}
function fmtAge(hours: number): string {
  if (hours < 48) return `${Math.round(hours * 10) / 10}h`;
  return `${Math.round((hours / 24) * 10) / 10} 天`;
}

const actionBtn = (variant: "secondary" | "link") =>
  cn(buttonVariants({ variant, size: "sm" }), variant === "secondary" ? "h-6 px-2 text-11" : "h-6 px-1 text-11");

function PrRow({ pr }: { pr: PrItem }) {
  const stale = Date.now() - new Date(pr.updated_at).getTime() > STALE_MS;
  return (
    <li className={`rounded-8 px-2 py-1.5 transition-colors duration-200 hover:bg-muted ${stale ? "border border-destructive/30 bg-destructive/5" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <a href={pr.url} target="_blank" rel="noreferrer" className="truncate text-13 text-foreground underline-offset-4 transition-colors duration-200 hover:underline">
          PR {pr.number} · {pr.title}
        </a>
        <Badge variant={pr.draft ? "muted" : "outline"} className="shrink-0 text-11">{pr.draft ? "草稿" : "评审中"}</Badge>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="text-11 text-muted-foreground">
          已开 {fmtAge(ageHours(pr.created_at))}{stale ? " · 超过 1 个周期（3h）未动" : ""}
        </span>
        {stale && (
          <span className="flex gap-1" data-testid="pr-actions">
            {/* 催办/认领 review 当前形态 = 跳该 PR 的 GitHub 页留言/自派（权威在 GitHub） */}
            <a href={pr.url} target="_blank" rel="noreferrer" className={actionBtn("secondary")}>催办</a>
            <a href={pr.url} target="_blank" rel="noreferrer" className={actionBtn("secondary")}>认领 review</a>
            <a href={pr.url} target="_blank" rel="noreferrer" className={actionBtn("link")}>去 GitHub →</a>
          </span>
        )}
      </div>
    </li>
  );
}

export function PrQueueCard() {
  const [payload, setPayload] = useState<PrsPayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/portal/prs");
        if (!res.ok) throw new Error(`status ${res.status}`);
        const body = (await res.json()) as PrsPayload;
        if (!cancelled) {
          setPayload(body);
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    void load();
    const timer = setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const state: PortalCardState = failed
    ? "degraded"
    : !payload
      ? "loading"
      : !payload.configured
        ? "unconfigured"
        : "error" in payload
          ? "degraded"
          : "ready";
  const items = payload && payload.configured && "items" in payload ? payload.items : [];
  const groups: Array<{ label: string; prs: PrItem[] }> = [
    { label: "评审中", prs: items.filter((p) => !p.draft) },
    { label: "草稿", prs: items.filter((p) => p.draft) },
  ].filter((g) => g.prs.length > 0);

  return (
    <PortalCard
      title="PR 队列（超 1 个周期未动的高亮，可立即行动）"
      state={state}
      unconfiguredHint="GitHub 数据源未配置（GITHUB_TOKEN/GITHUB_REPO）——接线后此卡显示 open PR 队列与堵点高亮。"
    >
      {items.length === 0 ? (
        <p className="text-13 text-muted-foreground">当前没有 open PR——队列干净。</p>
      ) : (
        <div className="space-y-3" data-testid="pr-queue">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="mb-1 text-11 uppercase tracking-wide text-muted-foreground">{g.label}（{g.prs.length}）</p>
              <ul className="space-y-1">
                {g.prs.map((pr) => <PrRow key={pr.number} pr={pr} />)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </PortalCard>
  );
}
