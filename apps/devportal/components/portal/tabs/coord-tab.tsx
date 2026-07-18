"use client";
// 实时协调板块（p23/F05）：活跃租约 + 协调事件两卡迁入门户，数据源 /api/portal/coordination
// （coord-service 公开 /status 的服务端代理）。界面契约 = p23 ui-signoff 确认的 v3 原型
// CoordTab：中文标题 + 术语括注；租约行 🟢🟡🔴 心跳状态点（时间与 ttl 放 title 悬停）；
// expire 事件 destructive 徽章，cycle-plan/cycle-result/andon 叙述层事件 secondary 徽章。
// 三态诚实降级：未配置（unconfigured）≠ 不可达（degraded），语义沿用 PortalCard。
import { portalFetch } from "@/lib/portal-fetch";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { PortalCard, type PortalCardState } from "@/components/portal/portal-card";
import { DispatchPanel } from "@/components/portal/dispatch-panel";

interface Claim {
  resource_id: string;
  agent_id: string;
  last_heartbeat_at: string;
  ttl_seconds: number;
}

interface CoordEvent {
  id: number;
  type: string;
  resource_id: string;
  agent_id: string;
  at: string;
}

interface CoordPayload {
  configured: boolean;
  active_claims?: Claim[];
  recent_events?: CoordEvent[];
}

const REFRESH_MS = 30_000;

/** 语义心跳状态点：<5min 新鲜 / <30min 渐旧 / ≥30min 陈旧（复用 coord-dashboard 阈值）。 */
function HeartbeatDot({ minutes }: { minutes: number }) {
  if (minutes < 5) return <span aria-label="心跳新鲜" title="心跳新鲜（<5 分钟）" className="inline-block h-2 w-2 shrink-0 rounded-full bg-success" />;
  if (minutes < 30) return <span aria-label="心跳渐旧" title="心跳渐旧（<30 分钟）" className="inline-block h-2 w-2 shrink-0 rounded-full bg-tag-yellow ring-1 ring-border" />;
  return <span aria-label="心跳陈旧" title="心跳陈旧（≥30 分钟）" className="inline-block h-2 w-2 shrink-0 rounded-full bg-destructive" />;
}

function minutesSince(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Infinity;
  return Math.max(0, (Date.now() - t) / 60_000);
}

/** 相对时间（中文，秒级到天级），与原型"28 秒前 / 44 分钟前 / 昨天"的口吻一致。 */
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

/** 事件徽章语义：expire = 故障级（destructive）；cycle-plan/cycle-result/andon = 叙述层
 *  站会/停线信号（secondary）；其余（heartbeat/claim/release/…）低噪声（muted）。 */
function eventBadgeVariant(type: string): "destructive" | "secondary" | "muted" {
  if (type === "expire") return "destructive";
  if (type === "cycle-plan" || type === "cycle-result" || type === "andon") return "secondary";
  return "muted";
}

export function CoordTab() {
  const [state, setState] = useState<PortalCardState>("loading");
  const [claims, setClaims] = useState<Claim[]>([]);
  const [events, setEvents] = useState<CoordEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await portalFetch("/api/portal/coordination");
        if (!res) return; // 401 → 正在整页重新认证（portal-fetch.ts）
        if (cancelled) return;
        if (!res.ok) {
          setState("degraded");
          return;
        }
        const body = (await res.json()) as CoordPayload;
        if (cancelled) return;
        if (!body.configured) {
          setState("unconfigured");
          return;
        }
        setClaims(body.active_claims ?? []);
        setEvents(body.recent_events ?? []);
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

  const unconfiguredHint = "协调服务尚未接线（COORD_SERVICE_URL 未配置）——这是部署中间态，不是故障。";

  return (
    <div className="space-y-4">
      <DispatchPanel />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <PortalCard title="活跃租约（Active Claims）" state={state} unconfiguredHint={unconfiguredHint}>
        {claims.length === 0 ? (
          <p className="text-13 text-muted-foreground">当前没有活跃租约。</p>
        ) : (
          <ul className="space-y-1" data-testid="coord-claims">
            {claims.map((c) => {
              const hbMin = minutesSince(c.last_heartbeat_at);
              return (
                <li
                  key={c.resource_id}
                  title={`最后心跳 ${relTime(c.last_heartbeat_at)} · ttl ${Math.round(c.ttl_seconds / 60)}m`}
                  className="flex items-center justify-between gap-2 rounded-8 px-2 py-1.5 transition-colors duration-200 hover:bg-muted"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <HeartbeatDot minutes={hbMin} />
                    <div className="min-w-0">
                      <div className="truncate text-13 font-medium text-foreground">{c.resource_id}</div>
                      <div className="text-11 text-muted-foreground">持有者 {c.agent_id}</div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PortalCard>
      <PortalCard title="协调事件（Recent Events）" state={state} unconfiguredHint={unconfiguredHint}>
        {events.length === 0 ? (
          <p className="text-13 text-muted-foreground">暂无协调事件。</p>
        ) : (
          <ul className="space-y-1" data-testid="coord-events">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 rounded-8 px-2 py-1.5 transition-colors duration-200 hover:bg-muted">
                <span className="truncate text-13 text-foreground">
                  {e.resource_id}
                  <span className="text-muted-foreground"> · {relTime(e.at)}</span>
                </span>
                <Badge variant={eventBadgeVariant(e.type)} className="shrink-0 text-11">{e.type}</Badge>
              </li>
            ))}
          </ul>
        )}
      </PortalCard>
      </div>
    </div>
  );
}
