// coordinator-lock.ts — CLI 封装：pnpm harness lock-status|lock-acquire|lock-heartbeat|lock-release
//
// Phase 3（coord-service 迁移，见 packages/coord-service）起，acquire/heartbeat/release
// 在完成本地文件锁操作之后，会尝试做一次 opt-in 的 dual-write：只有同时设了
// COORD_SERVICE_URL 和 COORD_SERVICE_TOKEN 环境变量才会发起网络调用；没设 = 和
// Phase 3 之前完全一样，零行为变化。网络调用失败/coord-service 不可用只打一条
// info 日志，绝不影响本地文件锁的结果或这条命令的退出码。
//
// Phase 5 起，lockAcquire 在这两个环境变量都设了的前提下，会先问 D1
// "role:coord-main 现在是不是被别人占着、还新不新鲜"——D1 说"被占且新鲜"就直接
// 拒绝，比本地文件更早一步把关；D1 查不到/查询失败则静默降级为只看本地文件，
// 绝不因为 coord-service 不可用就卡住协调本身。本地文件锁不删除、继续作为兜底
// 和唯一权威（未设两个环境变量时）——没有人被强制切过去：只有显式配置了这两个
// 环境变量的会话，才会真的把 D1 当权威在问。
import { req } from "./lib/args";
import { log, die } from "./lib/log";
import {
  acquireLock,
  heartbeat,
  releaseLock,
  readLock,
  isStale,
  minutesSince,
  patchLock,
  STALE_THRESHOLD_MINUTES,
} from "./lib/lock";
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

  const client = createCoordServiceClientFromEnv();

  // Phase 5 cutover: when dual-write is configured, ask D1 first — it may
  // know about a holder the local file never learned about (e.g. this machine
  // never ran acquire for this session before). Unreachable/erroring D1 is
  // treated as "no opinion," never as a block.
  if (client && !force) {
    try {
      const outcome = await client.queryActiveClaim(REMOTE_RESOURCE_ID);
      if (outcome.kind === "error") {
        // Previously unreachable: a non-ok HTTP response used to collapse
        // into the same value as "genuinely free", with zero log output
        // either way. Now it's a distinct, visible case.
        log.info(`[coord-service] 查询远端认领状态返回非成功状态（HTTP ${outcome.status}），降级为仅本地文件锁把关`);
      } else if (outcome.kind === "held" && outcome.claim.agent_id !== sessionId) {
        const staleMinutes = (Date.now() - new Date(outcome.claim.last_heartbeat_at).getTime()) / 60000;
        if (staleMinutes <= STALE_THRESHOLD_MINUTES) {
          die(
            `[coord-service] 已有 coordinator "${outcome.claim.agent_id}" 持有 role:coord-main 租约` +
              `（最后心跳 ${staleMinutes.toFixed(1)} 分钟前）。不要重复调度——如确认它已失效，加 --force 抢占。`
          );
        }
      }
    } catch (e) {
      log.info(`[coord-service] 查询远端认领状态失败（${(e as Error).message}），降级为仅本地文件锁把关`);
    }
  }

  let lock: CoordinatorLock;
  try {
    lock = acquireLock(sessionId, { force, note });
  } catch (e) {
    die((e as Error).message);
  }
  log.ok(`已获取锁：session=${lock.sessionId}`);

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
