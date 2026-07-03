// lock.ts — coordinator 互斥登记（防多个 /loop coordinator 并行调度互相踩踏）。
// 见 .harness/state/coordinator-loop-brief.md §0 安全边界。
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { COORDINATOR_LOCK_PATH } from "./paths";

export interface CoordinatorLock {
  sessionId: string;
  startedAt: string;
  lastHeartbeat: string;
  note?: string;
}

/** 超过这么久没心跳，视为 stale（进程已死/会话已结束），允许新 coordinator 抢占。 */
export const STALE_THRESHOLD_MINUTES = 45;

export function readLock(): CoordinatorLock | null {
  if (!existsSync(COORDINATOR_LOCK_PATH)) return null;
  try {
    return JSON.parse(readFileSync(COORDINATOR_LOCK_PATH, "utf8")) as CoordinatorLock;
  } catch {
    return null; // 损坏的锁文件视为无锁
  }
}

function writeLock(lock: CoordinatorLock): void {
  writeFileSync(COORDINATOR_LOCK_PATH, JSON.stringify(lock, null, 2) + "\n", "utf8");
}

export function minutesSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 60000;
}

export function isStale(lock: CoordinatorLock): boolean {
  return minutesSince(lock.lastHeartbeat) > STALE_THRESHOLD_MINUTES;
}

/** 获取锁。已有其它活跃 session 持锁时抛错（除非 force 或锁已 stale）。 */
export function acquireLock(sessionId: string, opts: { force?: boolean; note?: string } = {}): CoordinatorLock {
  const existing = readLock();
  if (existing && existing.sessionId !== sessionId && !isStale(existing) && !opts.force) {
    throw new Error(
      `已有 coordinator session "${existing.sessionId}" 活跃（最后心跳 ${minutesSince(existing.lastHeartbeat).toFixed(1)} 分钟前）。` +
        `不要重复调度——如确认它已失效，加 --force 抢占。`
    );
  }
  const now = new Date().toISOString();
  const lock: CoordinatorLock = {
    sessionId,
    startedAt: existing && existing.sessionId === sessionId ? existing.startedAt : now,
    lastHeartbeat: now,
    note: opts.note,
  };
  writeLock(lock);
  return lock;
}

export function heartbeat(sessionId: string): CoordinatorLock {
  const existing = readLock();
  if (!existing) throw new Error(`没有活跃的锁，先 acquire`);
  if (existing.sessionId !== sessionId) {
    throw new Error(
      `锁属于 session "${existing.sessionId}"，不是 "${sessionId}"——可能已被别的 coordinator 抢占，本 session 应停止调度`
    );
  }
  existing.lastHeartbeat = new Date().toISOString();
  writeLock(existing);
  return existing;
}

export function releaseLock(sessionId: string, opts: { force?: boolean } = {}): void {
  const existing = readLock();
  if (!existing) return;
  if (existing.sessionId !== sessionId && !opts.force) {
    throw new Error(`锁属于 session "${existing.sessionId}"，不是 "${sessionId}"，拒绝释放（加 --force 强制）`);
  }
  unlinkSync(COORDINATOR_LOCK_PATH);
}
