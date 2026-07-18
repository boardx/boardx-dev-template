// cycle.ts — C-cycle 时钟的**唯一权威实现**（ADR-014 统一时钟）。
//
// 迁移注记（p29-F10 stage-2）：纯函数逐行搬运自已退役的
// packages/coord-service/src/lib/cycle.ts（ADR-017 决策 2）。ADR-014 语义零变更：
// 周期仍锚定 UTC 整点 00/03/06/09/12/15/18/21，cycle id 仍是起始时刻的紧凑 ISO。
//
// 为什么必须集中：此前每个 agent 用自己机器的 Date.now() 算周期边界与租约新鲜度
// （.harness/scripts/cycle-report.ts 就是本地时钟），机器时钟漂移 → 各算各的
// cycle id、各判各的"租约还新鲜吗" → 协调层对"现在几点、当前哪个周期"没有共识。
// coord-gateway 是协调权威（ADR-017），它的时钟就是全队的时钟：所有 agent 一律
// 读 GET /api/coord/time，不信自己的 date。
export const CYCLE_HOURS = 3; // UTC 整点 00/03/06/09/12/15/18/21 锚定

/** 给定时刻所属周期的起始 UTC 时刻。 */
export function cycleStart(now: Date): Date {
  const d = new Date(now.getTime());
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(Math.floor(d.getUTCHours() / CYCLE_HOURS) * CYCLE_HOURS);
  return d;
}

/** cycle id = 起始时刻的紧凑 ISO（如 2026-07-15T09Z）——全队用同一个字符串指代同一周期。 */
export function cycleId(start: Date): string {
  const iso = start.toISOString();
  return `${iso.slice(0, 13)}Z`;
}

export interface CycleInfo {
  id: string;
  started_at: string;
  ends_at: string;
  remaining_seconds: number;
  elapsed_seconds: number;
}

export function describeCycle(now: Date): CycleInfo {
  const start = cycleStart(now);
  const end = new Date(start.getTime() + CYCLE_HOURS * 3600_000);
  return {
    id: cycleId(start),
    started_at: start.toISOString(),
    ends_at: end.toISOString(),
    remaining_seconds: Math.max(0, Math.round((end.getTime() - now.getTime()) / 1000)),
    elapsed_seconds: Math.max(0, Math.round((now.getTime() - start.getTime()) / 1000)),
  };
}
