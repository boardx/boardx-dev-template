// coordinator-lock.ts — CLI 封装：pnpm harness lock-status|lock-acquire|lock-heartbeat|lock-release
import { req } from "./lib/args";
import { log, die } from "./lib/log";
import { acquireLock, heartbeat, releaseLock, readLock, isStale, minutesSince } from "./lib/lock";
import type { Args } from "./lib/args";

export function lockStatus(_args: Args): void {
  const lock = readLock();
  if (!lock) {
    log.info("无活跃锁 — 可以 acquire");
    return;
  }
  const stale = isStale(lock);
  log.info(`session: ${lock.sessionId}`);
  log.info(`started: ${lock.startedAt}`);
  log.info(`last heartbeat: ${lock.lastHeartbeat}（${minutesSince(lock.lastHeartbeat).toFixed(1)} 分钟前）`);
  if (lock.note) log.info(`note: ${lock.note}`);
  log.info(stale ? "状态: STALE（可被新 session acquire）" : "状态: ACTIVE");
}

export function lockAcquire(args: Args): void {
  const sessionId = req(args, "session");
  const force = !!args.flags["force"];
  const note = args.opts["note"];
  try {
    const lock = acquireLock(sessionId, { force, note });
    log.ok(`已获取锁：session=${lock.sessionId}`);
  } catch (e) {
    die((e as Error).message);
  }
}

export function lockHeartbeat(args: Args): void {
  const sessionId = req(args, "session");
  try {
    heartbeat(sessionId);
    log.ok(`心跳已更新：session=${sessionId}`);
  } catch (e) {
    die((e as Error).message);
  }
}

export function lockRelease(args: Args): void {
  const sessionId = req(args, "session");
  const force = !!args.flags["force"];
  try {
    releaseLock(sessionId, { force });
    log.ok(`已释放锁：session=${sessionId}`);
  } catch (e) {
    die((e as Error).message);
  }
}
