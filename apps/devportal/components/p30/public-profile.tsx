"use client";
// P4 /u/:handle 工程师公开档案（p30 UI 先行原型，UC-16，D1）。
// 分区语义（D1 拍板）：
//   ① 贡献事实区 —— 默认公开（参与项目卡 + PR 合并时间线，事实不可自填）；
//   ② 聚合指标区 —— opt-in 才公开，且必须区间化展示（如 flow-time "6-12h"）；
//   ③ 名下 agents 缩略行 —— 链到 P5 分身页（agent 默认全公开）。
// D3：本页属公开层，零身份假设——「本人视角」开关只是 mock 演示档案公开开关 + 预览模式，
// 真实实现由服务端判定 viewer 是否本人，公开层组件不读任何 cookie/header。
// ⚠️ 全部 mock（lib/mock/p30.ts），不接后端。
import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PortalCard } from "@/components/portal/portal-card";
import { HeartbeatDot } from "@/components/portal/heartbeat-dot";
import { EmptyState, IdentityChip, LoadingSkeleton, PrototypeHeader, useMockLoading } from "@/components/p30/shared";
import { MOCK_PUBLIC_PROFILE } from "@/lib/mock/p30";

const HB_MIN = { fresh: 2, aging: 12, stale: 42 } as const;

/** agent 路由：/a/:handle/:agent（D6）——从完整标识 @handle/name 拆出。 */
function twinHref(agentId: string): string {
  const [handle, ...rest] = agentId.replace(/^@/, "").split("/");
  return `/a/${handle}/${rest.join("/")}`;
}

export function PublicProfile({ handle }: { handle: string }) {
  const loading = useMockLoading();
  const [emptyDemo, setEmptyDemo] = useState(false);
  /** mock 本人视角：展示「档案公开开关 + 预览模式」（访客视角 = 预览模式的效果） */
  const [asSelf, setAsSelf] = useState(true);
  const [optIn, setOptIn] = useState(MOCK_PUBLIC_PROFILE.optInPublic);
  const [previewing, setPreviewing] = useState(false);

  const p = MOCK_PUBLIC_PROFILE;
  const projects = emptyDemo ? [] : p.projects;
  const timeline = emptyDemo ? [] : p.mergeTimeline;
  const agents = emptyDemo ? [] : p.agents;
  /** 聚合指标区是否可见：opt-in 开着才有；预览模式 = 以访客眼光看当前设置的效果 */
  const showMetrics = optIn;

  return (
    <div className="mx-auto max-w-content space-y-4 px-6 pb-14 pt-7 md:px-9" data-testid="public-profile">
      <PrototypeHeader
        title={`@${handle} 公开档案`}
        subtitle="平台层 /u/:handle · 贡献事实默认公开；聚合指标 opt-in 且区间化（D1）"
        emptyDemo={emptyDemo}
        onToggleEmptyDemo={() => setEmptyDemo((v) => !v)}
      />

      {/* mock 视角开关：本人（可管理公开设置）vs 访客（纯公开层，零身份假设 D3） */}
      <div className="flex flex-wrap items-center gap-2 rounded-10 border border-dashed border-border p-2.5">
        <span className="text-12 text-muted-foreground">原型视角开关（mock，真实实现由服务端判定）：</span>
        <Button size="sm" variant={asSelf ? "default" : "outline"} data-testid="profile-view-self" aria-pressed={asSelf} onClick={() => { setAsSelf(true); setPreviewing(false); }}>
          👤 本人视角
        </Button>
        <Button size="sm" variant={asSelf ? "outline" : "default"} data-testid="profile-view-visitor" aria-pressed={!asSelf} onClick={() => { setAsSelf(false); setPreviewing(false); }}>
          访客视角（未登录）
        </Button>
      </div>

      {/* 本人专属：档案公开开关 + 预览模式（D1 的 opt-in 控制点） */}
      {asSelf && (
        <div data-testid="profile-owner-controls" className="flex flex-wrap items-center gap-2 rounded-10 border border-tag-blue bg-tag-blue/30 p-2.5">
          <span className="text-12 font-medium text-foreground">聚合指标公开（opt-in）：</span>
          <Button
            size="sm"
            variant={optIn ? "default" : "outline"}
            data-testid="optin-toggle"
            role="switch"
            aria-checked={optIn}
            onClick={() => setOptIn((v) => !v)}
          >
            {optIn ? "已公开（区间化）· 点击关闭" : "未公开 · 点击开启"}
          </Button>
          <Button size="sm" variant={previewing ? "default" : "outline"} data-testid="profile-preview-toggle" aria-pressed={previewing} onClick={() => setPreviewing((v) => !v)}>
            {previewing ? "退出预览" : "以访客身份预览"}
          </Button>
          <span className="text-11 text-muted-foreground">贡献事实区不受此开关影响——事实默认公开且不可自填。</span>
        </div>
      )}
      {previewing && (
        <p data-testid="profile-preview-banner" role="status" className="rounded-8 border border-tag-yellow bg-tag-yellow/40 px-3 py-2 text-12 text-foreground">
          预览模式：下面就是访客现在看到的档案（聚合指标区{optIn ? "已 opt-in，区间化展示" : "未公开，整区隐藏"}）。
        </p>
      )}

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : (
        <>
          {/* 档案头 */}
          <div className="flex flex-wrap items-center gap-3 rounded-12 border border-border bg-surface-1 p-5">
            <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-tag-blue text-17 font-bold text-foreground">
              {p.name.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <IdentityChip kind="human">@{p.handle}</IdentityChip>
                <span className="text-17 font-bold text-foreground">{p.name}</span>
                <Badge variant="secondary" className="text-11">{p.trust}</Badge>
              </div>
              <p className="mt-0.5 text-13 text-muted-foreground">{p.bio} · 加入于 {p.joinedAt}</p>
            </div>
          </div>

          {/* ① 贡献事实区（默认公开） */}
          <PortalCard title="贡献事实（默认公开 · 自动生成，不可自填）" state="ready" wide>
            <div data-testid="profile-facts" className="space-y-4">
              {projects.length === 0 ? (
                <EmptyState testid="profile-projects-empty">还没有参与任何项目——从项目目录（P1）找一个感兴趣的开始。</EmptyState>
              ) : (
                <ul data-testid="profile-projects" className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                  {projects.map((pr) => (
                    <li key={pr.slug} data-testid={`profile-project-${pr.slug}`} className="rounded-10 border border-border bg-surface-2 p-3 transition-colors hover:bg-accent">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <IdentityChip kind="project">{pr.name}</IdentityChip>
                        <Badge variant="outline" className="text-11">{pr.role}</Badge>
                        <span className="ml-auto text-11 tabular-nums text-muted-foreground">{pr.prsMerged} PR 合并</span>
                      </div>
                      <p className="mt-1.5 text-12 text-muted-foreground">
                        {pr.since} 起 · 模块：{pr.modules.join(" / ")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              <div>
                <p className="text-13 font-semibold text-foreground">最近合并时间线</p>
                {timeline.length === 0 ? (
                  <div className="mt-2">
                    <EmptyState testid="profile-timeline-empty">还没有合并记录。</EmptyState>
                  </div>
                ) : (
                  <ol data-testid="profile-merge-timeline" className="mt-2 space-y-0">
                    {timeline.map((m, i) => (
                      <li key={m.id} data-testid={`merge-event-${m.id}`} className="relative flex gap-3 pb-3 pl-4 last:pb-0">
                        {i < timeline.length - 1 && <span aria-hidden className="absolute left-[5px] top-3 h-full w-px bg-border" />}
                        <span aria-hidden className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-success bg-surface-1" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <IdentityChip kind="project">{m.projectSlug}</IdentityChip>
                            <span className="text-12 font-medium text-foreground">#{m.prNumber}</span>
                            <span className="min-w-0 truncate text-12 text-foreground">{m.title}</span>
                            <span className="ml-auto shrink-0 text-11 tabular-nums text-muted-foreground">{m.mergedAt.slice(5, 16).replace("T", " ")}</span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </PortalCard>

          {/* ② 聚合指标区（opt-in + 区间化，D1） */}
          {showMetrics ? (
            <PortalCard title="聚合指标（区间化）" state="ready" wide>
              <div data-testid="profile-metrics" className="space-y-2.5">
                <p data-testid="metrics-optin-note" className="rounded-8 border border-tag-blue bg-tag-blue/30 px-3 py-2 text-12 text-foreground">
                  本区已由 @{p.handle} <span className="font-semibold">opt-in 公开</span>（D1）：只展示区间，不展示精确值；
                  精确值仅本人与所在项目 owner/maintainer 可见。
                </p>
                <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  {p.rangedMetrics.map((m) => (
                    <li key={m.id} data-testid={`metric-${m.id}`} className="rounded-10 border border-border bg-surface-2 p-3">
                      <p className="text-11 text-muted-foreground">{m.label}</p>
                      <p className="mt-1 text-21 font-bold tabular-nums text-foreground">{m.range}</p>
                      <p className="mt-0.5 text-11 text-muted-foreground">{m.note}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </PortalCard>
          ) : (
            <div data-testid="profile-metrics-hidden" className="rounded-12 border border-dashed border-border bg-surface-1 p-5 text-center">
              <p className="text-13 text-muted-foreground">
                聚合指标未公开——@{p.handle} 尚未 opt-in（D1 默认仅本人与项目 owner/maintainer 可见）。
              </p>
            </div>
          )}

          {/* ③ 名下 agents 缩略行 → P5 */}
          <PortalCard title={`名下 agents（${agents.length}）· 分身页默认全公开`} state="ready" wide>
            {agents.length === 0 ? (
              <EmptyState testid="profile-agents-empty">名下还没有 agent——在车队管理台 enroll 第一个。</EmptyState>
            ) : (
              <ul data-testid="profile-agents" className="space-y-1.5">
                {agents.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={twinHref(a.id)}
                      data-testid={`profile-agent-${a.id.replace(/[@/.]/g, "-")}`}
                      className="flex flex-wrap items-center gap-1.5 rounded-8 bg-surface-2 px-2.5 py-1.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <HeartbeatDot minutes={HB_MIN[a.heartbeat]} />
                      <IdentityChip kind="agent" className="font-mono">{a.id}</IdentityChip>
                      <span className="min-w-0 flex-1 truncate text-12 text-muted-foreground">{a.doing}</span>
                      <span className="shrink-0 text-12 text-muted-foreground">查看分身页 →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </PortalCard>

        </>
      )}
    </div>
  );
}
