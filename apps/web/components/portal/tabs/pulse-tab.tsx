"use client";
// p23/F03 脉搏与进度：整体进度（N/M + phase 进度条 + 点击下钻）与 流动时长 flow time。
// 界面契约 = p23 ui-signoff confirmed 的 v3 原型 PulseTab；数据源 = GET /api/portal/pulse（F02）。
// 诚实降级原则（不造假）：
//  - 周增量（本周 +N / ↑n）与近 7 天趋势线需要历史快照数据源，pulse API 暂无 → 显示"数据积累中"空态；
//  - phase 下钻的 进行中/受阻 细分与 feature 明细同理，先展示 API 已有的 通过/未通过 状态计数；
//  - github 未配置（configured:false）→ 流动时长卡走 PortalCard unconfigured 态（部署中间态非故障）。
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PortalCard, type PortalCardState } from "@/components/portal/portal-card";

const FLOW_BASELINE_HOURS = 1.8;

export interface PulsePhase {
  id: string;
  name: string;
  passing: number;
  total: number;
}
export type PulseCoord =
  | { configured: false }
  | { configured: true; error: string }
  | { configured: true; active_claims: Array<{ resource_id: string; agent_id: string; last_heartbeat_at: string; ttl_seconds: number }> };
export type PulseGithub =
  | { configured: false }
  | { configured: true; error: string }
  | { configured: true; merged_last_24h: number; flow_hours_median: number | null };
export interface PulsePayload {
  phases: { items: PulsePhase[]; totals: { passing: number; total: number } };
  coord: PulseCoord;
  github: PulseGithub;
  generated_at: string;
}

/** 单数据源 → 卡片四态映射（互不拖垮：每张卡只看自己的源）。 */
function sourceCardState(failed: boolean, pulse: PulsePayload | null, src: PulseCoord | PulseGithub | null): PortalCardState {
  if (failed) return "degraded";
  if (!pulse || !src) return "loading";
  if (!src.configured) return "unconfigured";
  if ("error" in src) return "degraded";
  return "ready";
}

export function PulseTab() {
  const [pulse, setPulse] = useState<PulsePayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [drill, setDrill] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/portal/pulse");
        if (!res.ok) throw new Error(`status ${res.status}`);
        const body = (await res.json()) as PulsePayload;
        if (!cancelled) {
          setPulse(body);
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

  const phasesState: PortalCardState = failed ? "degraded" : !pulse ? "loading" : "ready";
  const github = pulse?.github ?? null;
  const flowState = sourceCardState(failed, pulse, github);
  const flowReady = github && github.configured && !("error" in github) ? github : null;

  const items = pulse?.phases.items ?? [];
  const totals = pulse?.phases.totals ?? { passing: 0, total: 0 };
  const drillPhase = drill ? (items.find((p) => p.id === drill) ?? null) : null;

  const median = flowReady?.flow_hours_median ?? null;
  const deltaPct = median === null ? null : Math.round(Math.abs(1 - median / FLOW_BASELINE_HOURS) * 100);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <PortalCard title="整体进度" state={phasesState}>
        <div className="flex items-end justify-between">
          <p className="text-26 font-bold text-foreground">
            {totals.passing}
            <span className="text-15 font-normal text-muted-foreground"> / {totals.total} 项通过</span>
          </p>
          {/* 周增量需要历史快照数据源（pulse API 暂无）——诚实空态，不虚构 +N */}
          <Badge variant="muted" className="text-11">本周增量：数据积累中</Badge>
        </div>
        <div className="mt-3 space-y-2" data-testid="phase-bars">
          {items.map((ph) => (
            <Button
              key={ph.id}
              variant="ghost"
              size="sm"
              className="h-auto w-full justify-start gap-2 px-1 py-1"
              aria-expanded={drill === ph.id}
              onClick={() => setDrill(drill === ph.id ? null : ph.id)}
            >
              <span className="w-40 truncate text-left text-13 text-foreground">{ph.id} · {ph.name}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-8 bg-muted">
                <span
                  className="block h-full rounded-8 bg-primary"
                  style={{ width: `${ph.total > 0 ? (ph.passing / ph.total) * 100 : 0}%` }}
                />
              </span>
              <span className="w-16 text-right text-11 tabular-nums text-muted-foreground">{ph.passing}/{ph.total}</span>
            </Button>
          ))}
        </div>
        {drillPhase && (
          <div data-testid="phase-drill" className="mt-3 rounded-8 border border-border bg-surface-2 p-3">
            <div className="flex flex-wrap items-center gap-2 text-13">
              <span className="font-medium text-foreground">{drillPhase.id} 下钻</span>
              <Badge variant="success" className="text-11">通过 {drillPhase.passing}</Badge>
              <Badge variant="outline" className="text-11">未通过 {drillPhase.total - drillPhase.passing}</Badge>
            </div>
            <p className="mt-2 text-11 text-muted-foreground">
              进行中/受阻 细分与 feature 明细：数据积累中（等待 harness 状态字段接入 pulse API）。
            </p>
          </div>
        )}
      </PortalCard>
      <div className="space-y-4">
        <PortalCard
          title="流动时长 flow time（PR 开出→合并 中位）"
          state={flowState}
          unconfiguredHint="GitHub 数据源未配置（GITHUB_TOKEN/GITHUB_REPO）——接线后此卡显示流动时长中位值与基线对比。"
        >
          <div data-testid="flow-time">
            <div className="flex items-end justify-between">
              <p className="text-26 font-bold tabular-nums text-foreground">{median === null ? "—" : `${median}h`}</p>
              {median === null ? (
                <Badge variant="muted" className="text-11">近 24h 无合并 · 中位数暂不可得</Badge>
              ) : median <= FLOW_BASELINE_HOURS ? (
                <Badge variant="success" className="text-11">基线 {FLOW_BASELINE_HOURS}h ↓{deltaPct}%</Badge>
              ) : (
                <Badge variant="destructive" className="text-11">基线 {FLOW_BASELINE_HOURS}h ↑{deltaPct}%</Badge>
              )}
            </div>
            <p className="mt-2 text-13 text-foreground">近 24h 合并 {flowReady?.merged_last_24h ?? 0} 个 PR</p>
            {/* 近 7 天趋势线需要历史快照数据源——诚实空态，不画假曲线 */}
            <p className="mt-2 text-11 text-muted-foreground">近 7 天趋势线：数据积累中（需要按日历史快照）。</p>
          </div>
        </PortalCard>
      </div>
    </div>
  );
}
