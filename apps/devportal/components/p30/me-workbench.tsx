"use client";
// M1 /me 跨项目工作台（p30 UI 先行原型，UC-09 / D4）。
// 目标体验：登录默认落点，10 秒知道该干什么。
// 结构：侧栏项目切换器（红点计数）｜coord 晨报条｜三栏今日必办
// （待拍板@我 SLA 排序可展开「为什么需要我?」/ 我卡住的 PR 催办 / 我的 agent 异常）｜项目一行式脉搏。
// ⚠️ 全部 mock（lib/mock/p30.ts），feature 实现时替换数据源，UI 复用不重写。
import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PortalCard } from "@/components/portal/portal-card";
import { EmptyState, IdentityChip, LoadingSkeleton, PrototypeHeader, useMockLoading } from "@/components/p30/shared";
import {
  MOCK_ANOMALIES,
  MOCK_BRIEF,
  MOCK_DECISIONS,
  MOCK_ME,
  MOCK_PROJECTS,
  MOCK_STUCK_PRS,
  type MockDecision,
} from "@/lib/mock/p30";

function slaLabel(h: number): { text: string; urgent: boolean } {
  return h <= 4 ? { text: `SLA 剩 ${h}h`, urgent: true } : { text: `SLA 剩 ${h}h`, urgent: false };
}

function DecisionCard({ d }: { d: MockDecision }) {
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
        <Button size="sm">去拍板 →</Button>
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

export function MeWorkbench() {
  const loading = useMockLoading();
  const [emptyDemo, setEmptyDemo] = useState(false);
  const [activeProject, setActiveProject] = useState<string | null>(null);

  const decisions = emptyDemo ? [] : [...MOCK_DECISIONS].sort((a, b) => a.slaHoursLeft - b.slaHoursLeft);
  const stuckPrs = emptyDemo ? [] : MOCK_STUCK_PRS;
  const anomalies = emptyDemo ? [] : MOCK_ANOMALIES;
  const filteredDecisions = activeProject ? decisions.filter((d) => d.projectSlug === activeProject) : decisions;

  return (
    <div className="mx-auto flex max-w-screen-xl gap-5 px-6 pb-14 pt-7 md:px-9">
      {/* 侧栏项目切换器（红点计数，UC-18：只计最高级） */}
      <aside data-testid="project-switcher" className="hidden w-52 shrink-0 md:block">
        <p className="px-2 text-11 font-semibold uppercase tracking-wide text-muted-foreground">我的项目</p>
        <ul className="mt-2 space-y-1">
          <li>
            <button
              type="button"
              data-testid="switcher-all"
              onClick={() => setActiveProject(null)}
              className={`flex w-full items-center justify-between rounded-10 px-3 py-2 text-13 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeProject === null ? "bg-surface-2 font-semibold text-foreground" : "text-muted-foreground"}`}
            >
              全部项目
            </button>
          </li>
          {MOCK_PROJECTS.map((p) => (
            <li key={p.slug}>
              <button
                type="button"
                data-testid={`switcher-${p.slug}`}
                onClick={() => setActiveProject((cur) => (cur === p.slug ? null : p.slug))}
                className={`flex w-full items-center justify-between gap-2 rounded-10 px-3 py-2 text-13 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeProject === p.slug ? "bg-surface-2 font-semibold text-foreground" : "text-foreground"}`}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-tag-green ring-1 ring-border" />
                  <span className="truncate">{p.name}</span>
                </span>
                {!emptyDemo && p.badgeCount > 0 && (
                  <span
                    data-testid={`switcher-badge-${p.slug}`}
                    className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-11 font-semibold tabular-nums text-destructive-foreground"
                    title={`${p.badgeCount} 项最高级通知`}
                  >
                    {p.badgeCount}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t border-border px-2 pt-3 text-11 text-muted-foreground">＋ 新建项目（接入向导 P3，后续批次）</p>
      </aside>

      {/* 主区 */}
      <div className="min-w-0 flex-1 space-y-4" data-testid="me-workbench">
        <PrototypeHeader
          title="我的工作台"
          subtitle={`👤 @${MOCK_ME.handle} · 跨 ${MOCK_PROJECTS.length} 个项目聚合 · 登录默认落点（D4）`}
          emptyDemo={emptyDemo}
          onToggleEmptyDemo={() => setEmptyDemo((v) => !v)}
        />

        {/* coord-agent 晨报条（叙事式） */}
        {loading ? (
          <LoadingSkeleton rows={1} testid="brief-loading" />
        ) : emptyDemo ? (
          <EmptyState testid="brief-empty">今天没有需要你的事——晨报会在有事时出现。</EmptyState>
        ) : (
          <div data-testid="morning-brief" className="rounded-12 border border-border bg-surface-dark p-4 text-surface-dark-foreground">
            <div className="flex flex-wrap items-center gap-1.5">
              <IdentityChip kind="agent">{MOCK_BRIEF.from}</IdentityChip>
              <span className="text-11 opacity-70">晨报 · 08:00</span>
            </div>
            <p className="mt-2 text-13 leading-relaxed">{MOCK_BRIEF.narrative}</p>
          </div>
        )}

        {/* 三栏今日必办 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <PortalCard title={`待拍板 @我（${filteredDecisions.length}）`} state={loading ? "loading" : "ready"}>
            {filteredDecisions.length === 0 ? (
              <EmptyState testid="decisions-empty">没有等你拍板的事项 ✓</EmptyState>
            ) : (
              <ul data-testid="col-decisions" className="space-y-2.5">
                {filteredDecisions.map((d) => (
                  <DecisionCard key={d.id} d={d} />
                ))}
              </ul>
            )}
          </PortalCard>

          <PortalCard title={`我卡住的 PR（${stuckPrs.length}）`} state={loading ? "loading" : "ready"}>
            {stuckPrs.length === 0 ? (
              <EmptyState testid="stuck-prs-empty">你的 PR 都在正常推进 ✓</EmptyState>
            ) : (
              <ul data-testid="col-stuck-prs" className="space-y-2.5">
                {stuckPrs.map((p) => (
                  <li key={p.id} className="rounded-10 border border-destructive/40 bg-destructive/5 p-3 transition-colors hover:bg-destructive/10">
                    <p className="text-13 font-medium text-foreground">
                      #{p.number} {p.title}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <IdentityChip kind="project">{p.projectSlug}</IdentityChip>
                      <span className="text-11 text-destructive">已开 {p.ageHours}h</span>
                    </div>
                    <p className="mt-1 text-12 text-muted-foreground">{p.waitingOn}</p>
                    <Button size="sm" variant="outline" className="mt-2" data-testid={`pr-nudge-${p.id}`}>
                      催办 →
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </PortalCard>

          <PortalCard title={`我的 agent 异常（${anomalies.length}）`} state={loading ? "loading" : "ready"}>
            {anomalies.length === 0 ? (
              <EmptyState testid="anomalies-empty">你的 agent 全部心跳正常 ✓</EmptyState>
            ) : (
              <ul data-testid="col-agent-anomalies" className="space-y-2.5">
                {anomalies.map((a) => (
                  <li key={a.id} className="rounded-10 border border-border bg-surface-1 p-3 transition-colors hover:bg-surface-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        aria-hidden
                        className={`h-2 w-2 shrink-0 rounded-full ${a.kind === "heartbeat-lost" ? "animate-pulse bg-destructive" : "bg-tag-yellow ring-1 ring-border"}`}
                      />
                      <IdentityChip kind="agent" className="min-w-0 truncate">{a.agentId}</IdentityChip>
                    </div>
                    <p className="mt-1.5 text-13 font-medium text-foreground">
                      {a.kind === "heartbeat-lost" ? `心跳丢失 ${a.sinceMin} 分钟` : a.kind === "token-expiring" ? "token 即将到期" : "租约陈旧"}
                    </p>
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

        {/* 项目一行式脉搏 */}
        <PortalCard title="项目脉搏" state={loading ? "loading" : "ready"}>
          {emptyDemo ? (
            <EmptyState testid="pulse-empty">你还没有加入任何项目——去项目目录探索（P1，后续批次）。</EmptyState>
          ) : (
            <ul className="divide-y divide-border" data-testid="project-pulse">
              {MOCK_PROJECTS.map((p) => (
                <li key={p.slug} data-testid={`project-pulse-row-${p.slug}`} className="flex flex-wrap items-center gap-2 py-2.5 transition-colors hover:bg-surface-1">
                  <IdentityChip kind="project">{p.name}</IdentityChip>
                  {p.andon && <Badge variant="destructive" className="text-11">andon 拉停</Badge>}
                  <span className="min-w-0 flex-1 truncate text-13 text-muted-foreground">{p.pulseLine}</span>
                  <Link
                    href={`/p/${p.slug}/people`}
                    className="shrink-0 text-13 font-medium text-primary underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    进入工作区 →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PortalCard>
      </div>
    </div>
  );
}
