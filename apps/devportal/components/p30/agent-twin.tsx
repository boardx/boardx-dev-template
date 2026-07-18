"use client";
// P5 /a/:handle/:agent Agent 数字分身页（p30 UI 先行原型，UC-16，D1/D6）。
// D1 拍板：agent 分身页默认全公开——「软件资产无隐私权」（页头角标）。
// D6：完整标识 @handle/agent-name（owner 命名空间唯一，sub 用点号延伸）；
//     内部主键不可变 ULID，改名不断链；路由 /a/:handle/:agent。
// 板块：归属 owner 卡（👤 链回 P4）｜parent 派生树（含点号 sub）｜授权项目列表
// （scope + token 状态）｜性能（达成率/吞吐/异常）｜最近事件时间线（lease/evidence/andon 图标化）。
// D3：公开层零身份假设——本页无任何视角开关，访客与 owner 看到完全一样的内容。
// ⚠️ 全部 mock（lib/mock/p30.ts），不接后端。
import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PortalCard } from "@/components/portal/portal-card";
import { HeartbeatDot } from "@/components/portal/heartbeat-dot";
import { EmptyState, IdentityChip, LoadingSkeleton, PrototypeHeader, useMockLoading } from "@/components/p30/shared";
import { MOCK_AGENT_TWIN, TWIN_EVENT_ICON, type MockTwinTreeNode } from "@/lib/mock/p30";

const HB_MIN = { fresh: 2, aging: 12, stale: 42 } as const;

/** parent 派生树一行（递归；点号 sub 逐级缩进，紫色左边条呼应 🤖 体系）。 */
function TreeNode({ node, depth }: { node: MockTwinTreeNode; depth: number }) {
  return (
    <li>
      <div
        data-testid={node.self ? "twin-tree-self" : `twin-tree-${node.id.replace(/[@/.]/g, "-")}`}
        className={`flex flex-wrap items-center gap-1.5 rounded-8 border-l-2 py-1.5 pr-2.5 transition-colors hover:bg-accent ${
          node.self ? "border-tag-purple bg-tag-purple/30" : "border-tag-purple/40 bg-surface-2"
        }`}
        style={{ marginLeft: depth * 20, paddingLeft: 10 }}
      >
        <HeartbeatDot minutes={HB_MIN[node.heartbeat]} />
        <IdentityChip kind="agent" className="font-mono">{node.id}</IdentityChip>
        {node.self && <Badge variant="secondary" className="text-11">本页</Badge>}
        <span className="min-w-0 flex-1 truncate text-12 text-muted-foreground">{node.doing}</span>
      </div>
      {node.subs.length > 0 && (
        <ul className="mt-1.5 space-y-1.5">
          {node.subs.map((s) => (
            <TreeNode key={s.id} node={s} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function AgentTwin({ handle, agent }: { handle: string; agent: string }) {
  const loading = useMockLoading();
  const [emptyDemo, setEmptyDemo] = useState(false);
  const t = MOCK_AGENT_TWIN;
  const fullId = `@${handle}/${agent}`;
  const enrollments = emptyDemo ? [] : t.enrollments;
  const events = emptyDemo ? [] : t.events;

  return (
    <div className="mx-auto max-w-content space-y-4 px-6 pb-14 pt-7 md:px-9" data-testid="agent-twin">
      <PrototypeHeader
        title={`${fullId} 数字分身`}
        subtitle="平台层 /a/:handle/:agent · 默认全公开（D1）· 标识即命名空间（D6）"
        emptyDemo={emptyDemo}
        onToggleEmptyDemo={() => setEmptyDemo((v) => !v)}
      />

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : (
        <>
          {/* 页头：完整标识 + 「软件资产无隐私权」角标 */}
          <div className="rounded-12 border border-border bg-surface-1 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-tag-purple text-21">🤖</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span data-testid="twin-full-id" className="font-mono text-17 font-bold text-foreground">{fullId}</span>
                  <HeartbeatDot minutes={t.heartbeatMin} />
                  <Badge variant="secondary" className="text-11">{t.lifecycle}</Badge>
                  <Badge variant="outline" className="text-11">{t.runtime}</Badge>
                </div>
                <p className="mt-0.5 text-12 text-muted-foreground">
                  创建于 {t.createdAt} · 内部主键 <span className="font-mono">{t.ulid}</span>（不可变 ULID，改名不断链 D6）
                </p>
              </div>
              <span
                data-testid="twin-public-badge"
                title="D1 拍板：agent 分身页默认全公开——agent 是软件资产，无隐私权；一切行为可归因、可审计。"
                className="shrink-0 rounded-full border border-tag-purple bg-tag-purple/40 px-2.5 py-1 text-11 font-medium text-foreground"
              >
                默认全公开 · 软件资产无隐私权
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* 归属 owner 卡（👤 链回 P4） */}
            <PortalCard title="归属 owner（一切行为归因到人）" state="ready">
              <Link
                href={`/u/${t.owner.handle}`}
                data-testid="twin-owner-card"
                className="flex flex-wrap items-center gap-2 rounded-10 border border-tag-blue bg-tag-blue/30 p-3 transition-colors hover:bg-tag-blue/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tag-blue text-15 font-bold text-foreground">
                  {t.owner.name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <IdentityChip kind="human">@{t.owner.handle}</IdentityChip>
                    <span className="text-13 font-medium text-foreground">{t.owner.name}</span>
                  </div>
                  <p className="mt-0.5 text-11 text-muted-foreground">owner 必填不可空 · 异常/越权先找 owner（D2 控制链）</p>
                </div>
                <span className="shrink-0 text-12 text-muted-foreground">公开档案 →</span>
              </Link>
              <p className="mt-2 text-11 text-muted-foreground">
                parent：{t.parentId ? <span className="font-mono">{t.parentId}</span> : "无（顶层 agent，由 owner 直接 enroll）"}
              </p>
            </PortalCard>

            {/* 性能（达成率/吞吐/异常） */}
            <PortalCard title="性能（30 天）" state="ready">
              <ul data-testid="twin-perf" className="grid grid-cols-3 gap-2.5">
                <li className="rounded-10 border border-border bg-surface-2 p-3 text-center">
                  <p data-testid="twin-perf-attainment" className="text-21 font-bold tabular-nums text-foreground">{t.perf.attainmentPct}%</p>
                  <p className="mt-0.5 text-11 text-muted-foreground">租约达成率</p>
                </li>
                <li className="rounded-10 border border-border bg-surface-2 p-3 text-center">
                  <p data-testid="twin-perf-throughput" className="text-21 font-bold tabular-nums text-foreground">{t.perf.throughputPerWeek}</p>
                  <p className="mt-0.5 text-11 text-muted-foreground">PR / 周</p>
                </li>
                <li className="rounded-10 border border-border bg-surface-2 p-3 text-center">
                  <p data-testid="twin-perf-anomalies" className={`text-21 font-bold tabular-nums ${t.perf.anomalies30d > 0 ? "text-destructive" : "text-foreground"}`}>
                    {t.perf.anomalies30d}
                  </p>
                  <p className="mt-0.5 text-11 text-muted-foreground">异常（30d）</p>
                </li>
              </ul>
              <p className="mt-2 text-11 text-muted-foreground">与 /me/performance 的 🤖 表同源；按 owner 配对归因（UC-15）。</p>
            </PortalCard>
          </div>

          {/* parent 派生树（含点号 sub） */}
          <PortalCard title="派生树（sub 用点号延伸，归属沿 parent 追溯）" state="ready" wide>
            <ul data-testid="twin-tree" className="space-y-1.5">
              <TreeNode node={t.tree} depth={0} />
            </ul>
          </PortalCard>

          {/* 授权项目列表（scope + token 状态） */}
          <PortalCard title={`授权项目（${enrollments.length}）`} state="ready" wide>
            {enrollments.length === 0 ? (
              <EmptyState testid="twin-enrollments-empty">尚未 enroll 进任何项目。</EmptyState>
            ) : (
              <ul data-testid="twin-enrollments" className="space-y-1.5">
                {enrollments.map((e) => (
                  <li key={e.projectSlug} data-testid={`twin-enrollment-${e.projectSlug}`} className="flex flex-wrap items-center gap-1.5 rounded-8 bg-surface-2 px-2.5 py-2 transition-colors hover:bg-accent">
                    <IdentityChip kind="project">{e.projectName}</IdentityChip>
                    <span className="rounded-7 bg-background px-1.5 py-0.5 font-mono text-11 text-muted-foreground">scope: {e.scope}</span>
                    <span className="text-11 text-muted-foreground">enroll 于 {e.enrolledAt}</span>
                    <Badge variant={e.tokenStatus === "健康" ? "outline" : e.tokenStatus === "已吊销" ? "destructive" : "secondary"} className="ml-auto text-11">
                      token {e.tokenStatus}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-11 text-muted-foreground">scoped token 按项目下发；吊销即时 401（UC-13）。</p>
          </PortalCard>

          {/* 最近事件时间线（图标化） */}
          <PortalCard title="最近事件" state="ready" wide>
            {events.length === 0 ? (
              <EmptyState testid="twin-events-empty">还没有事件——agent 首个心跳后开始记录。</EmptyState>
            ) : (
              <ol data-testid="twin-events" className="space-y-0">
                {events.map((ev, i) => (
                  <li key={ev.id} data-testid={`twin-event-${ev.id}`} className="relative flex gap-3 pb-3 pl-7 last:pb-0">
                    {i < events.length - 1 && <span aria-hidden className="absolute left-[9px] top-5 h-full w-px bg-border" />}
                    <span aria-hidden className="absolute left-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-surface-2 text-11" title={ev.kind}>
                      {TWIN_EVENT_ICON[ev.kind]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={ev.kind === "andon" ? "destructive" : "outline"} className="text-11">{ev.kind}</Badge>
                        <span className="ml-auto shrink-0 text-11 tabular-nums text-muted-foreground">{ev.at.slice(5, 16).replace("T", " ")}</span>
                      </div>
                      <p className="mt-0.5 text-12 leading-relaxed text-foreground">{ev.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-2 text-11 text-muted-foreground">事件源：append-only 协调事件日志（lease / evidence / andon / heartbeat / enroll）。</p>
          </PortalCard>
        </>
      )}
    </div>
  );
}
