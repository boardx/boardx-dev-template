"use client";
// p23 wave1 占位：本文件由负责该板块的子 agent 独立实现（每 tab 一文件，避免 shell 三方冲突）。
import { PortalCard } from "@/components/portal/portal-card";

export function PerfTab() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <PortalCard title="板块接入中" state="ready" wide>
        <p className="text-13 text-muted-foreground">wave 1 实现中——界面契约见 p23 ui-signoff 确认的原型。</p>
      </PortalCard>
    </div>
  );
}
