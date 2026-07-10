// portal 共享卡片（p23/F02）：统一承载三态——loading 骨架 / 数据源降级 / 正常内容。
// "互不拖垮"的 UI 半边：每张卡只反映自己数据源的状态，GitHub 侧挂了协调侧照常。
// 未配置(unconfigured)与不可达(degraded)是两个不同状态：前者是合法部署中间态（提示接线），
// 后者才是故障（红色降级横幅）——沿用 admin/coordination 卡片确立的语义。
import type { ReactNode } from "react";

export type PortalCardState = "loading" | "unconfigured" | "degraded" | "ready";

export function PortalCard({
  title,
  state,
  unconfiguredHint,
  children,
  wide,
}: {
  title: string;
  state: PortalCardState;
  unconfiguredHint?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`rounded-12 border border-border bg-surface-1 p-5 ${wide ? "md:col-span-2" : ""}`}>
      <h2 className="text-15 font-semibold text-foreground">{title}</h2>
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
