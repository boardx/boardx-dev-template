// portal 共享卡片（p23/F02）：统一承载三态——loading 骨架 / 数据源降级 / 正常内容。
// "互不拖垮"的 UI 半边：每张卡只反映自己数据源的状态，GitHub 侧挂了协调侧照常。
// 未配置(unconfigured)与不可达(degraded)是两个不同状态：前者是合法部署中间态（提示接线），
// 后者才是故障（红色降级横幅）——沿用 admin/coordination 卡片确立的语义。
// F09：freshAt = 本卡数据的新鲜度时间戳（上游 mirrored_at/generated_at，或本次拉取时刻），
// 渲染在标题行右侧的既有元信息位——不新增视图、不改卡片布局（ADR-003 约束）。
import type { ReactNode } from "react";

export type PortalCardState = "loading" | "unconfigured" | "degraded" | "ready";

/** 相对时间（中文，秒级到天级），悬停 title 有完整 ISO。 */
function relTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const sec = Math.max(0, (Date.now() - t) / 1000);
  if (sec < 60) return `${Math.round(sec)} 秒前`;
  if (sec < 3600) return `${Math.round(sec / 60)} 分钟前`;
  if (sec < 86_400) return `${Math.round(sec / 3600)} 小时前`;
  return `${Math.floor(sec / 86_400)} 天前`;
}

export function PortalCard({
  title,
  state,
  unconfiguredHint,
  children,
  wide,
  freshAt,
}: {
  title: string;
  state: PortalCardState;
  unconfiguredHint?: string;
  children: ReactNode;
  wide?: boolean;
  /** 数据新鲜度时间戳（ISO）；仅 ready 态渲染——loading/降级下没有"新鲜"可言。 */
  freshAt?: string | null;
}) {
  return (
    <div className={`rounded-12 border border-border bg-surface-1 p-5 ${wide ? "md:col-span-2" : ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-15 font-semibold text-foreground">{title}</h2>
        {state === "ready" && freshAt && (
          <span data-testid="card-fresh-at" title={`数据时点 ${freshAt}`} className="shrink-0 text-11 tabular-nums text-muted-foreground">
            {relTime(freshAt)}
          </span>
        )}
      </div>
      <div className="mt-4">
        {state === "loading" && (
          <div data-testid="card-loading" className="animate-pulse space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 rounded-8 bg-muted" />
            ))}
          </div>
        )}
        {state === "unconfigured" && (
          <p data-testid="card-unconfigured" className="text-13 text-muted-foreground">
            {unconfiguredHint ?? "该数据源尚未在本部署配置——这是部署中间态，不是故障。"}
          </p>
        )}
        {state === "degraded" && (
          <div data-testid="card-degraded" role="alert" className="rounded-8 border border-destructive/30 bg-destructive/5 p-3 text-13 text-destructive">
            数据源暂不可达，稍后自动重试——其余板块不受影响（互不拖垮）。
          </div>
        )}
        {state === "ready" && children}
      </div>
    </div>
  );
}
