// coordinator-lock.ts — CLI 封装：pnpm harness lock-status|lock-acquire|lock-heartbeat|lock-release
//
// Phase 3（coord-service 迁移，见 packages/coord-service）起，acquire/heartbeat/release
// 在完成本地文件锁操作之后，会尝试做一次 opt-in 的 dual-write：只有同时设了
// COORD_SERVICE_URL 和 COORD_SERVICE_TOKEN 环境变量才会发起网络调用；没设 = 和
// Phase 3 之前完全一样，零行为变化。网络调用失败/coord-service 不可用只打一条
// info 日志，绝不影响本地文件锁的结果或这条命令的退出码——本地文件锁在 Phase 5
// 之前始终是唯一权威。
import { req } from "./lib/args";
import { log, die } from "./lib/log";
import { acquireLock, heartbeat, releaseLock, readLock, isStale, minutesSince, patchLock } from "./lib/lock";
import type { CoordinatorLock } from "./lib/lock";
import type { Args } from "./lib/args";
import { createCoordServiceClientFromEnv } from "@repo/coord-service/client";

const REMOTE_RESOURCE_ID = "role:coord-main";
const REMOTE_RESOURCE_TYPE = "coordinator-role";

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
  if (lock.remoteClaimId) log.info(`coord-service claim id: ${lock.remoteClaimId}`);
  log.info(stale ? "状态: STALE（可被新 session acquire）" : "状态: ACTIVE");
}

export async function lockAcquire(args: Args): Promise<void> {
  const sessionId = req(args, "session");
  const force = !!args.flags["force"];
  const note = args.opts["note"];

  let lock: CoordinatorLock;
  try {
    lock = acquireLock(sessionId, { force, note });
  } catch (e) {
    die((e as Error).message);
  }
  log.ok(`已获取锁：session=${lock.sessionId}`);

  const client = createCoordServiceClientFromEnv();
  if (!client) return;
  try {
    const result = await client.claim(REMOTE_RESOURCE_ID, REMOTE_RESOURCE_TYPE);
    if (result.ok) {
      const claim = (result.body as { claim?: { id: number } } | undefined)?.claim;
      if (claim) {
        patchLock({ remoteClaimId: claim.id });
        log.info(`[coord-service] dual-write claim 成功：id=${claim.id}`);
      }
    } else {
      log.info(`[coord-service] dual-write claim 未成功（status=${result.status}），本地文件锁不受影响`);
    }
  } catch (e) {
    log.info(`[coord-service] dual-write 网络调用失败（${(e as Error).message}），本地文件锁不受影响——这是设计好的降级行为`);
  }
}

export async function lockHeartbeat(args: Args): Promise<void> {
  const sessionId = req(args, "session");
  const priorLock = readLock();

  try {
    heartbeat(sessionId);
    log.ok(`心跳已更新：session=${sessionId}`);
  } catch (e) {
    die((e as Error).message);
  }

  const client = createCoordServiceClientFromEnv();
  if (!client || !priorLock?.remoteClaimId) return;
  try {
    const result = await client.heartbeat(priorLock.remoteClaimId);
    if (!result.ok) {
      log.info(`[coord-service] dual-write heartbeat 未成功（status=${result.status}）`);
    }
  } catch (e) {
    log.info(`[coord-service] dual-write heartbeat 网络调用失败（${(e as Error).message}）`);
  }
}

export async function lockRelease(args: Args): Promise<void> {
  const sessionId = req(args, "session");
  const force = !!args.flags["force"];
  const priorLock = readLock(); // capture remoteClaimId before releaseLock() deletes the file

  try {
    releaseLock(sessionId, { force });
    log.ok(`已释放锁：session=${sessionId}`);
  } catch (e) {
    die((e as Error).message);
  }

  const client = createCoordServiceClientFromEnv();
  if (!client || !priorLock?.remoteClaimId) return;
  try {
    const result = await client.release(priorLock.remoteClaimId);
    if (!result.ok) {
      log.info(`[coord-service] dual-write release 未成功（status=${result.status}）`);
    }
  } catch (e) {
    log.info(`[coord-service] dual-write release 网络调用失败（${(e as Error).message}）`);
  }
}
