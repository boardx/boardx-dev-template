"use client";
// p23/F04 「现在谁在干活」卡：pulse.coord.active_claims 驱动。
// 每行：🟢🟡🔴 心跳状态点（时间悬停）+ 🤖 agent_id + 正在做什么（当前 claim 的 resource_id）。
// agent → 开发者归属标注：registry 数据暂无 owner 映射进 pulse API → 按契约省略（诚实降级）。
import { PortalCard, type PortalCardState } from "@/components/portal/portal-card";
import { HeartbeatDot } from "@/components/portal/heartbeat-dot";
import type { PulseCoord } from "@/components/portal/tabs/pulse-tab";

function minutesSince(iso: string): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - t) / 60_000);
}

export function ActiveAgentsCard({ state, coord, freshAt }: { state: PortalCardState; coord: PulseCoord | null; freshAt?: string | null }) {
  const claims = coord && coord.configured && "active_claims" in coord ? coord.active_claims : [];
  return (
    <PortalCard
      title="现在谁在干活"
      state={state}
      unconfiguredHint="协调数据源未配置（COORD_GATEWAY_URL/COORD_API_TOKEN）——接线后此卡显示活跃 agent 与心跳状态。"
      freshAt={freshAt}
    >
      {claims.length === 0 ? (
        <p className="text-13 text-muted-foreground">当前没有活跃租约——没有 agent 在干活。</p>
      ) : (
        <ul className="space-y-1" data-testid="active-agents">
          {claims.map((c) => (
            <li
              key={`${c.agent_id}:${c.resource_id}`}
              title={`最后心跳 ${c.last_heartbeat_at}`}
              className="flex items-center gap-2 rounded-8 px-2 py-1.5 transition-colors duration-200 hover:bg-muted"
            >
              <HeartbeatDot minutes={minutesSince(c.last_heartbeat_at)} />
              <span className="text-13 font-medium text-foreground">🤖 {c.agent_id}</span>
              <span className="min-w-0 flex-1 truncate text-right text-13 text-muted-foreground">{c.resource_id}</span>
            </li>
          ))}
        </ul>
      )}
    </PortalCard>
  );
}
