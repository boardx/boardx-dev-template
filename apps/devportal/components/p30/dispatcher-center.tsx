"use client";
// /platform/dispatcher 调度中心（p30 UI 先行原型，UC-17，平台 admin 视角）。
// @platform/dispatcher = 全平台唯一后台调度 agent：五个固定 loop 跨项目巡检 + 事实定位，
// 把问题**路由**给各项目 coord-agent——永不直接改项目内状态，所以「已采取动作」
// 全部是起草/通知/路由类文案。
// 权限：平台 admin（@usamshen 固定）/ operator 可见；非 admin → 无权限态（N1 第四态，
// 页内 mock 视角开关演示；真实实现由服务端按平台角色裁剪，UC-19）。
// ⚠️ 全部 mock（lib/mock/p30.ts），倒计时是静态起点的本地递减演示，不接后端。
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PortalCard } from "@/components/portal/portal-card";
import { EmptyState, IdentityChip, LoadingSkeleton, PrototypeHeader, useMockLoading } from "@/components/p30/shared";
import {
  DISPATCHER_SEVERITY_STYLE,
  MOCK_DISPATCHER_ISSUES,
  MOCK_DISPATCHER_LOOPS,
  type MockDispatcherLoop,
} from "@/lib/mock/p30";

/** 秒 → "34s" / "3m34s" / "9h36m" 倒计时展示。 */
function fmtCountdown(sec: number): string {
  if (sec <= 0) return "运行中…";
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m${sec % 60 > 0 ? `${sec % 60}s` : ""}`;
  return `${Math.floor(sec / 3600)}h${Math.floor((sec % 3600) / 60)}m`;
}

function fmtLastRun(min: number): string {
  if (min <= 0) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  return `${Math.floor(min / 60)} 小时 ${min % 60} 分钟前`;
}

/** loop 卡：上次运行时间 + 下次倒计时（mock 本地递减，归零后按周期重置演示循环感）。 */
function LoopCard({ loop }: { loop: MockDispatcherLoop }) {
  const [left, setLeft] = useState(loop.nextInSec);
  useEffect(() => {
    const period = Math.max(loop.nextInSec, 30);
    const t = setInterval(() => setLeft((s) => (s <= 1 ? period : s - 1)), 1000);
    return () => clearInterval(t);
  }, [loop.nextInSec]);
  return (
    <li data-testid={`loop-card-${loop.id}`} className="flex flex-col rounded-12 border border-border bg-surface-1 p-4 transition-colors hover:bg-surface-2">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-tag-purple px-2 py-0.5 font-mono text-11 font-semibold text-foreground">每 {loop.cadence}</span>
        <p className="text-13 font-semibold text-foreground">{loop.name}</p>
      </div>
      <p className="mt-1.5 flex-1 text-12 leading-relaxed text-muted-foreground">{loop.desc}</p>
      <dl className="mt-3 space-y-1 border-t border-border pt-2.5 text-11">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">上次运行</dt>
          <dd data-testid={`loop-last-${loop.id}`} className="tabular-nums text-foreground">{fmtLastRun(loop.lastRunMinAgo)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">下次运行</dt>
          <dd data-testid={`loop-next-${loop.id}`} className="font-mono tabular-nums text-foreground">{fmtCountdown(left)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">上轮扫描 / 定位</dt>
          <dd className="tabular-nums text-foreground">
            {loop.scanned} 项 / <span className={loop.found > 0 ? "font-semibold text-destructive" : ""}>{loop.found} 个问题</span>
          </dd>
        </div>
      </dl>
    </li>
  );
}

export function DispatcherCenter() {
  const loading = useMockLoading();
  const [emptyDemo, setEmptyDemo] = useState(false);
  const [asAdmin, setAsAdmin] = useState(true);
  const issues = emptyDemo ? [] : MOCK_DISPATCHER_ISSUES;

  return (
    <div className="mx-auto max-w-content space-y-4 px-6 pb-14 pt-7 md:px-9" data-testid="dispatcher-center">
      <PrototypeHeader
        title="调度中心"
        subtitle="/platform/dispatcher · @platform/dispatcher 五 loop 巡检 · 只定位与路由，永不直接改项目内状态"
        emptyDemo={emptyDemo}
        onToggleEmptyDemo={() => setEmptyDemo((v) => !v)}
      />

      {/* mock 视角开关：核对无权限态（UC-19 平台角色） */}
      <div className="flex flex-wrap items-center gap-2 rounded-10 border border-dashed border-border p-2.5">
        <span className="text-12 text-muted-foreground">原型视角开关（mock，真实实现由服务端按平台角色裁剪）：</span>
        <Button size="sm" variant={asAdmin ? "default" : "outline"} data-testid="view-as-admin" aria-pressed={asAdmin} onClick={() => setAsAdmin(true)}>
          👤 平台 admin 视角
        </Button>
        <Button size="sm" variant={asAdmin ? "outline" : "default"} data-testid="view-as-member" aria-pressed={!asAdmin} onClick={() => setAsAdmin(false)}>
          👤 普通成员视角（无权限）
        </Button>
      </div>

      {!asAdmin ? (
        <div data-testid="dispatcher-no-access" className="flex flex-col items-center gap-3 rounded-12 border border-border bg-surface-1 py-14 text-center">
          <span aria-hidden className="text-21">🔒</span>
          <p className="text-15 font-semibold text-foreground">调度中心仅平台 admin / operator 可见</p>
          <p className="max-w-brand text-13 leading-relaxed text-muted-foreground">
            你当前是普通成员。dispatcher 定位到与你相关的问题时，会主动通知到你的 /me 工作台与通知中心——
            无需进入本页。平台角色由 @usamshen（固定管理员，UC-19）在后台管理调整。
          </p>
        </div>
      ) : loading ? (
        <LoadingSkeleton rows={6} />
      ) : (
        <>
          {/* dispatcher 身份条 */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-10 border border-tag-purple bg-tag-purple/30 p-3">
            <IdentityChip kind="agent" className="font-mono">@platform/dispatcher</IdentityChip>
            <span className="text-12 text-foreground">全平台唯一后台调度 agent</span>
            <span data-testid="dispatcher-readonly-note" className="ml-auto text-11 text-muted-foreground">
              只做事实定位 + 路由给各项目 coord-agent；写动作仅限起草与通知（UC-17）
            </span>
          </div>

          {/* 五个固定 loop */}
          <section aria-label="调度 loop">
            <ul data-testid="dispatcher-loops" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {MOCK_DISPATCHER_LOOPS.map((l) => (
                <LoopCard key={l.id} loop={l} />
              ))}
            </ul>
          </section>

          {/* 当前定位到的问题 */}
          <PortalCard title={`当前定位到的问题（${issues.length}）`} state="ready" wide>
            {issues.length === 0 ? (
              <EmptyState testid="dispatcher-issues-empty">
                当前没有定位到问题——五个 loop 均按周期正常运行，全平台无异常。
              </EmptyState>
            ) : (
              <ul data-testid="dispatcher-issues" className="space-y-2.5">
                {issues.map((it) => {
                  const sev = DISPATCHER_SEVERITY_STYLE[it.severity];
                  return (
                    <li key={it.id} data-testid={`dispatcher-issue-${it.id}`} className="rounded-10 border border-border bg-surface-1 p-3 transition-colors hover:bg-surface-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span data-testid={`issue-severity-${it.id}`} className={`shrink-0 rounded-full px-2 py-0.5 text-11 font-semibold ${sev.cls}`}>
                          {sev.label}
                        </span>
                        <IdentityChip kind="project">{it.projectSlug}</IdentityChip>
                        <Badge variant="outline" className="font-mono text-11">{it.loopId.replace("loop-", "")} loop</Badge>
                        <span className="ml-auto shrink-0 text-11 tabular-nums text-muted-foreground">{it.atMinAgo} 分钟前定位</span>
                      </div>
                      <p className="mt-1.5 text-13 text-foreground">{it.text}</p>
                      <p data-testid={`issue-action-${it.id}`} className="mt-1.5 rounded-8 bg-surface-2 px-2.5 py-1.5 text-12 leading-relaxed text-muted-foreground">
                        <span className="font-medium text-foreground">已采取动作：</span>
                        {it.action}
                        <span className="ml-1 text-11">→ 路由至 <span className="font-mono">{it.routedTo}</span></span>
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-2 text-11 text-muted-foreground">
              动作边界：dispatcher 的一切动作都是「起草 / 通知 / 路由」——改状态的权力在各项目 coord-agent 与人类（UC-17）。
            </p>
          </PortalCard>
        </>
      )}
    </div>
  );
}
