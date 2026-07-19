"use client";
// M1 /me 跨项目工作台（p30/F08：真数据落地，UC-09 / D4）。
// 目标体验：登录默认落点，10 秒知道该干什么。
// 结构：侧栏项目切换器（红点计数，真实项目/单仓降级见 lib 注释）｜三栏今日必办
// （待拍板@我 SLA 排序，可展开「为什么需要我?」/ 我卡住的 PR 催办真实事件 / 我的 agent 异常）｜
// 每卡四态：loading（首次拉取中）/ 空（真实为零）/ 降级（上游不可达）/ 无权限（无项目成员资格）。
// 数据源：GET /api/p30/me（app/api/p30/me/route.ts，聚合 coord-gateway/GitHub/平台目录）；
// 「晨报」按任务边界保留降级态文案，不实现叙事内容（叙事属 F19，见 phase feature_list 备注）。
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PortalCard } from "@/components/portal/portal-card";
import { EmptyState, IdentityChip, LoadingSkeleton } from "@/components/p30/shared";
import type { DecisionSignal, MeApiPayload } from "@/lib/p30-me-types";

const REFRESH_MS = 30_000;

function slaLabel(h: number): { text: string; urgent: boolean } {
  if (h < 0) return { text: `已逾期 ${Math.abs(Math.round(h))}h`, urgent: true };
  return { text: `SLA 剩 ${Math.round(h)}h`, urgent: h <= 4 };
}

function DecisionCard({ d }: { d: DecisionSignal }) {
  const [open, setOpen] = useState(false);
  const sla = slaLabel(d.slaHoursLeft);
  const concern = d.kind === "raise-concern";
  return (
    <li
      data-testid={`decision-card-${d.id}`}
      className={`rounded-10 border p-3 transition-colors ${concern ? "border-tag-yellow bg-tag-yellow/40" : "border-border bg-surface-1 hover:bg-surface-2"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-13 font-medium leading-snug text-foreground">{d.title}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-11 tabular-nums ${sla.urgent ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"}`}>
          {sla.text}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <IdentityChip kind="project">{d.projectSlug}</IdentityChip>
        <IdentityChip kind="agent">{d.from}</IdentityChip>
        {concern && <Badge variant="outline" className="text-11">✋ 举手 · 不阻断</Badge>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" data-testid={`decision-why-toggle-${d.id}`} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? "收起" : "为什么需要我?"}
        </Button>
      </div>
      {open && (
        <ul data-testid={`decision-why-${d.id}`} className="mt-2 space-y-1 rounded-8 bg-surface-2 p-2.5">
          {d.why.map((w, i) => (
            <li key={i} className="text-12 leading-relaxed text-muted-foreground">
              · {w}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function NoAccess({ testid }: { testid: string }) {
  return (
    <div data-testid={testid} className="flex flex-col items-center gap-2 rounded-10 border border-dashed border-destructive/40 bg-destructive/5 py-8 text-center">
      <p className="text-13 text-muted-foreground">你还不是本项目成员，看不到这些数据——去项目主页申请加入。</p>
    </div>
  );
}

function Degraded({ testid }: { testid: string }) {
  return (
    <div data-testid={testid} role="alert" className="rounded-8 border border-destructive/30 bg-destructive/5 p-3 text-13 text-destructive">
      数据源暂不可达，稍后自动重试——其余板块不受影响（互不拖垮）。
    </div>
  );
}

export function MeWorkbench() {
  const [data, setData] = useState<MeApiPayload | null>(null);
  const [errored, setErrored] = useState(false);
  const [nudged, setNudged] = useState<Record<string, "sent" | "failed">>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/p30/me", { cache: "no-store" });
      if (!res.ok) {
        setErrored(true);
        return;
      }
      setErrored(false);
      setData((await res.json()) as MeApiPayload);
    } catch {
      setErrored(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  async function nudge(pr: { number: number; title: string; url: string }) {
    setNudged((cur) => ({ ...cur, [pr.number]: cur[pr.number] === "sent" ? "sent" : cur[pr.number] ?? "sent" }));
    try {
      const res = await fetch("/api/p30/me/pr-nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pr),
      });
      setNudged((cur) => ({ ...cur, [pr.number]: res.ok ? "sent" : "failed" }));
    } catch {
      setNudged((cur) => ({ ...cur, [pr.number]: "failed" }));
    }
  }

  const loading = data === null && !errored;
  const noAccess = data?.access === "denied";
  const project = data?.project ?? null;

  return (
    <div className="mx-auto flex max-w-screen-xl gap-5 px-6 pb-14 pt-7 md:px-9">
      {/* 侧栏项目切换器（真实红点计数；p30/F04 多租户未合并前降级为单仓一个项目） */}
      <aside data-testid="project-switcher" className="hidden w-52 shrink-0 md:block">
        <p className="px-2 text-11 font-semibold uppercase tracking-wide text-muted-foreground">我的项目</p>
        <ul className="mt-2 space-y-1">
          {project ? (
            <li>
              <Link
                href={`/p/${project.slug}`}
                data-testid={`switcher-${project.slug}`}
                className="flex w-full items-center justify-between gap-2 rounded-10 bg-surface-2 px-3 py-2 text-13 font-semibold text-foreground transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-tag-green ring-1 ring-border" />
                  <span className="truncate">{project.name}</span>
                </span>
                {project.badgeCount > 0 && (
                  <span
                    data-testid={`switcher-badge-${project.slug}`}
                    className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-11 font-semibold tabular-nums text-destructive-foreground"
                    title={`${project.badgeCount} 项最高级通知`}
                  >
                    {project.badgeCount}
                  </span>
                )}
              </Link>
            </li>
          ) : (
            <li className="px-2 text-12 text-muted-foreground">GITHUB_REPO 未配置——单项目视图不可用。</li>
          )}
        </ul>
        <p className="mt-3 border-t border-border px-2 pt-3 text-11 text-muted-foreground">
          多项目跨仓聚合待 p30/F04（工作区分片）合并后接入。
        </p>
      </aside>

      {/* 主区 */}
      <div className="min-w-0 flex-1 space-y-4" data-testid="me-workbench">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-21 font-bold text-foreground">我的工作台</h1>
            <p className="mt-1 text-13 text-muted-foreground">
              {data ? `👤 @${data.login} · 登录默认落点（D4）` : "加载中…"}
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex h-8 items-center rounded-lg px-3 text-13 font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            回门户 →
          </Link>
        </div>

        {/* 晨报占位：叙事内容属 F19 范围，本 feature 只保留降级态文案（边界写死防蔓延）。 */}
        <div data-testid="morning-brief" className="rounded-12 border border-dashed border-border bg-surface-1 p-4 text-muted-foreground">
          <p className="text-13">晨报叙事（F19）尚未接入——这里先占位，避免范围蔓延。</p>
        </div>

        {/* 三栏今日必办 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <PortalCard title={`待拍板 @我（${data?.decisions.items.length ?? 0}）`} state={loading ? "loading" : "ready"}>
            {loading ? (
              <LoadingSkeleton rows={2} testid="decisions-loading" />
            ) : noAccess ? (
              <NoAccess testid="decisions-no-access" />
            ) : data?.decisions.state === "degraded" ? (
              <Degraded testid="decisions-degraded" />
            ) : data && data.decisions.items.length === 0 ? (
              <EmptyState testid="decisions-empty">没有等你拍板的事项 ✓</EmptyState>
            ) : (
              <ul data-testid="col-decisions" className="space-y-2.5">
                {(data?.decisions.items ?? []).map((d) => (
                  <DecisionCard key={d.id} d={d} />
                ))}
              </ul>
            )}
          </PortalCard>

          <PortalCard title={`我卡住的 PR（${data?.stuckPrs.items.length ?? 0}）`} state={loading ? "loading" : "ready"}>
            {loading ? (
              <LoadingSkeleton rows={2} testid="stuck-prs-loading" />
            ) : noAccess ? (
              <NoAccess testid="stuck-prs-no-access" />
            ) : data?.stuckPrs.state === "degraded" ? (
              <Degraded testid="stuck-prs-degraded" />
            ) : data && data.stuckPrs.items.length === 0 ? (
              <EmptyState testid="stuck-prs-empty">你的 PR 都在正常推进 ✓</EmptyState>
            ) : (
              <ul data-testid="col-stuck-prs" className="space-y-2.5">
                {(data?.stuckPrs.items ?? []).map((p) => (
                  <li key={p.id} className="rounded-10 border border-destructive/40 bg-destructive/5 p-3 transition-colors hover:bg-destructive/10">
                    <a href={p.url} target="_blank" rel="noreferrer" className="text-13 font-medium text-foreground underline-offset-4 hover:underline">
                      #{p.number} {p.title}
                    </a>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="text-11 text-destructive">已开 {p.ageHours}h</span>
                    </div>
                    <p className="mt-1 text-12 text-muted-foreground">{p.waitingOn}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      data-testid={`pr-nudge-${p.id}`}
                      disabled={nudged[p.number] === "sent"}
                      onClick={() => void nudge(p)}
                    >
                      {nudged[p.number] === "sent" ? "已催办 ✓" : nudged[p.number] === "failed" ? "催办失败，重试 →" : "催办 →"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </PortalCard>

          <PortalCard title={`我的 agent 异常（${data?.anomalies.items.length ?? 0}）`} state={loading ? "loading" : "ready"}>
            {loading ? (
              <LoadingSkeleton rows={2} testid="anomalies-loading" />
            ) : noAccess ? (
              <NoAccess testid="anomalies-no-access" />
            ) : data?.anomalies.state === "degraded" ? (
              <Degraded testid="anomalies-degraded" />
            ) : data && data.anomalies.items.length === 0 ? (
              <EmptyState testid="anomalies-empty">你的 agent 全部心跳正常 ✓</EmptyState>
            ) : (
              <ul data-testid="col-agent-anomalies" className="space-y-2.5">
                {(data?.anomalies.items ?? []).map((a) => (
                  <li key={a.id} className="rounded-10 border border-border bg-surface-1 p-3 transition-colors hover:bg-surface-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span aria-hidden className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-destructive" />
                      <IdentityChip kind="agent" className="min-w-0 truncate">{a.agentId}</IdentityChip>
                    </div>
                    <p className="mt-1.5 text-13 font-medium text-foreground">心跳丢失 {a.sinceMin} 分钟</p>
                    <p className="mt-1 text-12 text-muted-foreground">{a.detail}</p>
                    <Link
                      href="/me/agents"
                      className="mt-2 inline-flex h-8 items-center rounded-lg border border-input px-3 text-13 font-semibold text-foreground transition-colors hover:bg-surface-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      去车队处理 →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </PortalCard>
        </div>

        {/* 项目一行式脉搏：单项目降级视图（p30/F04 合并前）。 */}
        <PortalCard title="项目脉搏" state={loading ? "loading" : "ready"}>
          {loading ? (
            <LoadingSkeleton rows={1} testid="pulse-loading" />
          ) : noAccess ? (
            <NoAccess testid="pulse-no-access" />
          ) : !project ? (
            <EmptyState testid="pulse-empty">GITHUB_REPO 未配置，无法生成项目脉搏。</EmptyState>
          ) : (
            <ul className="divide-y divide-border" data-testid="project-pulse">
              <li data-testid={`project-pulse-row-${project.slug}`} className="flex flex-wrap items-center gap-2 py-2.5 transition-colors hover:bg-surface-1">
                <IdentityChip kind="project">{project.name}</IdentityChip>
                <span className="min-w-0 flex-1 truncate text-13 text-muted-foreground">
                  {(data?.decisions.items.length ?? 0)} 待拍板 · {(data?.stuckPrs.items.length ?? 0)} 卡住 PR ·{" "}
                  {(data?.anomalies.items.length ?? 0)} agent 异常
                </span>
                <Link
                  href={`/p/${project.slug}`}
                  className="shrink-0 text-13 font-medium text-primary underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  进入工作区 →
                </Link>
              </li>
            </ul>
          )}
        </PortalCard>
      </div>
    </div>
  );
}
