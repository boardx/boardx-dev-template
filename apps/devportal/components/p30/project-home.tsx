"use client";
// P2 /projects/:slug 项目公开主页（招募页，p30 UI 先行原型，UC-03）。
// 访客视角（mock 未登录态）：README 摘要｜活跃度证明（合并火花线/flow-time/andon 响应中位，
// 自动生成自 GitHub 数据、不可自填）｜需要帮助的模块｜成员头像墙（👤/🤖 分开计数）｜
// 审批 SLA 兑现记录｜「加入这个项目」CTA → UC-04 三步向导。
// ⚠️ 全部 mock（lib/mock/p30.ts）。D3：公开层页面不依赖 Access 注入 header 的任何假设——
// 本组件无身份读取、无 cookie/header 分支，任何人打开看到的都一样。
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JoinWizard } from "@/components/p30/join-wizard";
import { EmptyState, IdentityChip, LoadingSkeleton, PrototypeHeader, useMockLoading } from "@/components/p30/shared";
import { MOCK_PUBLIC_PROJECT } from "@/lib/mock/p30";

/** 合并火花线（SVG mock）：数据来自 GitHub 合并统计，纯展示、currentColor 走语义色。 */
function MergeSparkline({ data }: { data: readonly number[] }) {
  const w = 220;
  const h = 48;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 6) - 3}`).join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-12 w-full text-primary"
      role="img"
      aria-label={`近 ${data.length} 周每周合并数，最近一周 ${data[data.length - 1]} 个`}
      data-testid="merge-sparkline"
    >
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((v, i) => (
        <circle key={i} cx={(i / (data.length - 1)) * w} cy={h - (v / max) * (h - 6) - 3} r={i === data.length - 1 ? 3 : 1.5} fill="currentColor" />
      ))}
    </svg>
  );
}

function ProofStat({ testid, label, value, hint }: { testid: string; label: string; value: string; hint: string }) {
  return (
    <div data-testid={testid} className="rounded-10 border border-border bg-surface-1 p-3 transition-colors hover:bg-surface-2">
      <p className="text-11 text-muted-foreground">{label}</p>
      <p className="mt-1 text-21 font-bold tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 text-11 text-muted-foreground">{hint}</p>
    </div>
  );
}

/** 头像墙格子：mock 用首字母 + 三色底，👤 蓝 / 🤖 紫。 */
function AvatarTile({ label, kind }: { label: string; kind: "human" | "agent" }) {
  const short = kind === "human" ? label.slice(0, 2) : (label.split("/")[1] ?? label).slice(0, 2);
  return (
    <span
      title={kind === "human" ? `@${label}` : label}
      className={`flex h-9 w-9 items-center justify-center rounded-full text-12 font-semibold uppercase ring-1 ring-border transition-transform hover:scale-105 ${
        kind === "human" ? "bg-tag-blue text-foreground" : "bg-tag-purple text-foreground"
      }`}
    >
      {short}
    </span>
  );
}

export function ProjectHome({ slug }: { slug: string }) {
  const loading = useMockLoading();
  const [emptyDemo, setEmptyDemo] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const p = MOCK_PUBLIC_PROJECT;

  return (
    <div className="mx-auto max-w-content space-y-4 px-6 pb-14 pt-7 md:px-9" data-testid="project-home">
      <PrototypeHeader
        title={`${p.name} · 项目公开主页`}
        subtitle={`/projects/${slug} · 访客视角（mock 未登录，公开层免登录，D3）· 双边市场供给侧`}
        emptyDemo={emptyDemo}
        onToggleEmptyDemo={() => setEmptyDemo((v) => !v)}
      />

      {/* 访客态提示 + CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-12 border border-border bg-surface-dark p-4 text-surface-dark-foreground">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <IdentityChip kind="project">{p.slug}</IdentityChip>
            <span className="text-11 opacity-70">未登录 · 你看到的即所有访客看到的</span>
          </div>
          {/* 设计稿：招募页 tagline 走 Newsreader 斜体叙事声线 */}
          <p className="mt-1.5 font-serif text-17 font-semibold italic">{p.tagline}</p>
        </div>
        <Button data-testid="join-cta" size="lg" onClick={() => setJoinOpen(true)}>
          加入这个项目 →
        </Button>
      </div>

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : (
        <>
          {/* README 摘要 */}
          <section className="rounded-12 border border-border bg-surface-1 p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-15 font-semibold text-foreground">README 摘要</h2>
              <span className="text-11 text-muted-foreground">自动截取自仓库 README</span>
            </div>
            {emptyDemo ? (
              <div className="mt-3">
                <EmptyState testid="readme-empty">仓库还没有 README——接入向导会引导 owner 补上。</EmptyState>
              </div>
            ) : (
              <ul data-testid="readme-summary" className="mt-3 space-y-1.5">
                {p.readmeSummary.map((line, i) => (
                  <li key={i} className="text-13 leading-relaxed text-muted-foreground">
                    · {line}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 活跃度证明（不可自填） */}
          <section data-testid="activity-proof" className="rounded-12 border border-border bg-surface-1 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-15 font-semibold text-foreground">活跃度证明</h2>
              <Badge variant="outline" className="text-11" data-testid="proof-autogen-note">
                自动生成自 GitHub 数据，不可自填
              </Badge>
            </div>
            {emptyDemo ? (
              <div className="mt-3">
                <EmptyState testid="proof-empty">还没有足够的 GitHub 数据——合并 10 个 PR 后火花线开始出现。</EmptyState>
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-10 border border-border bg-surface-1 p-3 transition-colors hover:bg-surface-2 md:col-span-1">
                  <p className="text-11 text-muted-foreground">近 12 周合并火花线</p>
                  <div className="mt-2">
                    <MergeSparkline data={p.mergeSparkline} />
                  </div>
                  <p className="mt-1 text-11 tabular-nums text-muted-foreground">上周合并 {p.mergeSparkline[p.mergeSparkline.length - 1]} 个 PR</p>
                </div>
                <ProofStat testid="proof-flow-time" label="flow-time 中位（认领 → 合并）" value={`${p.flowTimeMedianH}h`} hint="近 30 天全部 PR" />
                <ProofStat testid="proof-andon-median" label="andon 响应中位" value={`${p.andonResponseMedianMin}min`} hint="拉停 → 有权者首次响应" />
              </div>
            )}
          </section>

          {/* 需要帮助的模块 */}
          <section className="rounded-12 border border-border bg-surface-1 p-5">
            <h2 className="text-15 font-semibold text-foreground">需要帮助的模块</h2>
            {emptyDemo ? (
              <div className="mt-3">
                <EmptyState testid="help-wanted-empty">当前没有公开招募的模块——关注本页，缺口出现会第一时间挂出来。</EmptyState>
              </div>
            ) : (
              <ul data-testid="help-wanted" className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                {p.helpWanted.map((hwItem) => (
                  <li key={hwItem.module} data-testid={`help-wanted-${hwItem.module}`} className="rounded-10 border border-border bg-surface-1 p-3 transition-colors hover:bg-surface-2">
                    <div className="flex items-center gap-1.5">
                      <IdentityChip kind="project">{hwItem.module}</IdentityChip>
                      <Badge variant="secondary" className="text-11">good-first ×{hwItem.goodFirst}</Badge>
                    </div>
                    <p className="mt-2 text-12 leading-relaxed text-muted-foreground">{hwItem.need}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* 成员头像墙（👤/🤖 分开计数） */}
            <section className="rounded-12 border border-border bg-surface-1 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-15 font-semibold text-foreground">谁在这里</h2>
                <span data-testid="wall-count-humans" className="rounded-full bg-tag-blue px-2.5 py-0.5 text-12 font-medium tabular-nums text-foreground">
                  👤 成员 {emptyDemo ? 0 : p.humans}
                </span>
                <span data-testid="wall-count-agents" className="rounded-full bg-tag-purple px-2.5 py-0.5 text-12 font-medium tabular-nums text-foreground">
                  🤖 agent {emptyDemo ? 0 : p.agents}
                </span>
              </div>
              {emptyDemo ? (
                <div className="mt-3">
                  <EmptyState testid="wall-empty">还没有成员——你可以成为第一个。</EmptyState>
                </div>
              ) : (
                <div data-testid="member-wall" className="mt-3 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {p.memberWall.map((m) => (
                      <AvatarTile key={m.handle} label={m.handle} kind="human" />
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {p.agentWall.map((a) => (
                      <AvatarTile key={a.id} label={a.id} kind="agent" />
                    ))}
                    <span className="text-11 text-muted-foreground">+{p.agents - p.agentWall.length} 更多</span>
                  </div>
                  <p className="text-11 text-muted-foreground">👤 与 🤖 严格区分（三色体系）；agent 归属沿 owner 追溯，详情见花名册。</p>
                </div>
              )}
            </section>

            {/* 审批 SLA 兑现记录 */}
            <section data-testid="sla-record" className="rounded-12 border border-border bg-surface-1 p-5">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-15 font-semibold text-foreground">审批 SLA 兑现记录</h2>
                <span className="text-11 text-muted-foreground">公开可查，招募的信任凭证</span>
              </div>
              {emptyDemo ? (
                <div className="mt-3">
                  <EmptyState testid="sla-empty">还没有审批记录——第一份申请会开始累积兑现率。</EmptyState>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <p className="text-13 text-foreground">
                    承诺 <span className="font-semibold tabular-nums">{p.approvalSla.promiseH}h</span> 内审批；过去 30 天中位{" "}
                    <span className="font-semibold tabular-nums text-success">{p.approvalSla.last30dMedianH}h</span>
                  </p>
                  <p className="text-12 tabular-nums text-muted-foreground">
                    兑现 {p.approvalSla.kept}/{p.approvalSla.total} 份申请（{Math.round((p.approvalSla.kept / p.approvalSla.total) * 100)}%）
                  </p>
                  <div className="h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`SLA 兑现率 ${Math.round((p.approvalSla.kept / p.approvalSla.total) * 100)}%`}>
                    <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(p.approvalSla.kept / p.approvalSla.total) * 100}%` }} />
                  </div>
                  <p className="text-11 text-muted-foreground">数据来源：审批事件审计日志（N5），与治理台同源。</p>
                </div>
              )}
            </section>
          </div>

          {/* 底部再给一次 CTA */}
          <div className="flex flex-col items-center gap-2 rounded-12 border border-dashed border-border py-8 text-center">
            <p className="text-13 text-muted-foreground">看对眼了？三步加入：GitHub 登录 → 选角色/模块 → 提交等审批（SLA 透明）。</p>
            <Button data-testid="join-cta-bottom" onClick={() => setJoinOpen(true)}>
              加入这个项目 →
            </Button>
          </div>
        </>
      )}

      {joinOpen && <JoinWizard projectSlug={slug} projectName={p.name} onClose={() => setJoinOpen(false)} />}
    </div>
  );
}
