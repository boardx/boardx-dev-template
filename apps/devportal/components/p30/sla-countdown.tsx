"use client";
// SlaCountdown — 真实 SLA 倒计时（p30/F06）。共用于 P2 join-wizard 与 W6 governance-console：
// 服务端只给一个真实 deadline（membership.created_at + project.sla.promiseH，见
// packages/coord-directory/src/sla.ts），客户端每分钟重算一次剩余量——不是写死的静态文案。
import { useEffect, useState } from "react";

export function useNowTick(everyMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

export interface LiveSla {
  hoursLeft: number;
  timedOut: boolean;
  urgent: boolean;
  label: string; // "Xh Ym" 或 "已超时"
}

export function liveSlaFromDeadline(deadlineIso: string, now: number): LiveSla {
  const deadlineMs = Date.parse(deadlineIso);
  const msLeft = deadlineMs - now;
  const timedOut = msLeft <= 0;
  const hoursLeft = msLeft / 3_600_000;
  const totalMin = Math.max(0, Math.round(msLeft / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return {
    hoursLeft,
    timedOut,
    urgent: !timedOut && hoursLeft <= 4,
    label: timedOut ? "已超时" : `${h}h ${m}m`,
  };
}

/** 徽章文案 + 危险色阈值（≤4h 变红，W6 契约）。 */
export function SlaBadge({ deadline, promiseH }: { deadline: string; promiseH: number }) {
  const now = useNowTick();
  const live = liveSlaFromDeadline(deadline, now);
  const cls = live.timedOut
    ? "bg-destructive text-destructive-foreground"
    : live.urgent
      ? "bg-destructive text-destructive-foreground"
      : "bg-muted text-muted-foreground";
  return (
    <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-11 tabular-nums ${cls}`}>
      {live.timedOut ? `已超时（承诺 ${promiseH}h）` : `SLA 剩 ${live.label}`}
    </span>
  );
}
