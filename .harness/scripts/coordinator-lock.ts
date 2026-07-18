// coordinator-lock.ts — CLI 封装：pnpm harness lock-status|lock-acquire|lock-heartbeat|lock-release
//
// 2026-07-08 cutover（ADR-009）：coord-service (D1) 是 role:coord-main 租约的
// **唯一跨机器权威**。此前的"本地文件锁权威 + D1 可选影子写"语义已按人类决定升级：
//
// - COORD_SERVICE_URL/COORD_SERVICE_TOKEN 未配置 → acquire/heartbeat 直接报错退出
//   （没有权威可问就不假装能协调）。本地文件锁保留，但降级为"同机多会话的本地
//   快速互斥"，不再是任何意义上的权威。
// - acquire：D1 预查询失败（HTTP 错误/网络异常）→ 拒绝认领（fail-closed）。D1 说
//   被占且新鲜 → 拒绝。D1 claim 本身失败 → 回滚本地文件锁并报错——不允许出现
//   "本地以为拿到了、D1 里没有"的分裂状态。--force 仍可跳过预查询（人类明确授权
//   的抢占仪式用），但 D1 claim 依然必须成功。
// - heartbeat：D1 心跳失败 → 报错退出（可见）。租约新鲜度由服务端 sweeper 裁定，
//   心跳持续丢失 = 租约会被自动过期回收，会话必须感知。
// - release：D1 释放失败 → 大声警告但不阻塞本地释放（sweeper 最终会过期回收）。
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
import type { CoordServiceClient } from "@repo/coord-service/client";

const REMOTE_RESOURCE_ID = "role:coord-main";
const REMOTE_RESOURCE_TYPE = "coordinator-role";

function requireClient(): CoordServiceClient {
  const client = createCoordServiceClientFromEnv();
  if (!client) {
    die(
      "COORD_SERVICE_URL/COORD_SERVICE_TOKEN 未配置。2026-07-08 起 coord-service (D1) 是" +
        "coordinator 租约的唯一跨机器权威（ADR-009）——没有凭据就无法认领/心跳。找人类领取" +
        "本会话身份的 token（packages/coord-service/scripts/seed-agents.ts 产出，只显示一次）。"
    );
  }
  return client;
}

export async function lockStatus(_args: Args): Promise<void> {
  const lock = readLock();
  if (!lock) {
    log.info("本地无活跃锁");
  } else {
    const stale = isStale(lock);
    log.info(`本地锁 session: ${lock.sessionId}`);
    log.info(`started: ${lock.startedAt}`);
    log.info(`last heartbeat: ${lock.lastHeartbeat}（${minutesSince(lock.lastHeartbeat).toFixed(1)} 分钟前）`);
    if (lock.note) log.info(`note: ${lock.note}`);
    if (lock.remoteClaimId) log.info(`coord-service claim id: ${lock.remoteClaimId}`);
    log.info(stale ? "本地状态: STALE" : "本地状态: ACTIVE");
  }

  // 权威状态在 D1——本地文件只反映本机最后一次操作，跨机器一律以下面这段为准。
  const client = createCoordServiceClientFromEnv();
  if (!client) {
    log.warn("COORD_SERVICE_URL/COORD_SERVICE_TOKEN 未配置——只能显示本地状态，权威状态（D1）不可见。");
    return;
  }
  const outcome = await client.queryActiveClaim(REMOTE_RESOURCE_ID);
  if (outcome.kind === "error") {
    log.err(`[coord-service] 权威状态查询失败（HTTP ${outcome.status}）`);
    return;
  }
  if (outcome.kind === "free") {
    log.info(`权威状态（D1）：${REMOTE_RESOURCE_ID} 无活跃租约 — 可以 acquire`);
    return;
  }
  const heartbeatAgeMinutes = (Date.now() - new Date(outcome.claim.last_heartbeat_at).getTime()) / 60000;
  log.info(`权威状态（D1）：${REMOTE_RESOURCE_ID} 由 "${outcome.claim.agent_id}" 持有（claim id=${outcome.claim.id}）`);
  log.info(`最后心跳：${outcome.claim.last_heartbeat_at}（${heartbeatAgeMinutes.toFixed(1)} 分钟前，ttl=${outcome.claim.ttl_seconds}s）`);
}

export async function lockAcquire(args: Args): Promise<void> {
  const sessionId = req(args, "session");
  const force = !!args.flags["force"];
  const note = args.opts["note"];

  const client = requireClient();

  if (!force) {
    let outcome;
    try {
      outcome = await client.queryActiveClaim(REMOTE_RESOURCE_ID);
    } catch (e) {
      die(
        `[coord-service] 查询权威认领状态失败（${(e as Error).message}）——权威联系不上时不假装能协调，` +
          `拒绝认领（fail-closed，见 ADR-009）。确认要在无权威状态下强行接管，加 --force（人类授权的抢占仪式）。`
      );
    }
    if (outcome.kind === "error") {
      die(
        `[coord-service] 查询权威认领状态返回非成功状态（HTTP ${outcome.status}）——拒绝认领（fail-closed，` +
          `见 ADR-009）。确认要强行接管，加 --force。`
      );
    }
    if (outcome.kind === "held") {
      // #502：属主判定不再比对手填的 --session（曾因 session 标签与 token 身份错位
      // 导致 renew 分支永不触发、tick tick 409）。改为试探性 heartbeat——服务端
      // SQL 带 AND agent_id = <token身份>，成功 = 就是你的（顺便完成续约）。
      const renew = await client.heartbeat(outcome.claim.id);
      if (renew.ok) {
        if (sessionId !== outcome.claim.agent_id) {
          log.info(
            `⚠ --session "${sessionId}" 与 token 权威身份 "${outcome.claim.agent_id}" 不一致——` +
              `续约以 token 为准（--session 仅作本地锁标签，见 issue #502）`
          );
        }
        try {
          acquireLock(sessionId, { force: true, note });
        } catch {
          /* 本地文件锁刷新失败不影响权威续约结果 */
        }
        patchLock({ remoteClaimId: outcome.claim.id });
        log.ok(`已续约：agent=${outcome.claim.agent_id}，coord-service claim id=${outcome.claim.id}（本来就由你持有）`);
        return;
      }
      // 试探续约被拒 = 不是你的 token。新鲜 → 拒绝重复调度；过期 → 放行走新认领
      //（服务端 uq_active_claim 仍是最终原子裁定）。
      const heartbeatAgeMinutes = (Date.now() - new Date(outcome.claim.last_heartbeat_at).getTime()) / 60000;
      if (heartbeatAgeMinutes <= STALE_THRESHOLD_MINUTES) {
        die(
          `[coord-service] 已有 coordinator "${outcome.claim.agent_id}" 持有 role:coord-main 租约` +
            `（最后心跳 ${heartbeatAgeMinutes.toFixed(1)} 分钟前）。不要重复调度——如确认它已失效，加 --force 抢占。`
        );
      }
      log.info(`[coord-service] 持有者 "${outcome.claim.agent_id}" 心跳已过期（${heartbeatAgeMinutes.toFixed(1)} 分钟），按新认领处理`);
    }
  }

  let lock: CoordinatorLock;
  try {
    lock = acquireLock(sessionId, { force, note });
  } catch (e) {
    die((e as Error).message);
  }

  // D1 claim 是权威动作——失败必须回滚本地文件锁，不允许分裂状态。
  let claimId: number | undefined;
  try {
    const result = await client.claim(REMOTE_RESOURCE_ID, REMOTE_RESOURCE_TYPE);
    if (result.ok) {
      claimId = (result.body as { claim?: { id: number } } | undefined)?.claim?.id;
    } else if (result.status === 409) {
      releaseLock(sessionId, { force: true });
      die(`role:coord-main 认领冲突（另一会话刚抢先一步，uq_active_claim 原子判定）——本地锁已回滚。`);
    } else {
      releaseLock(sessionId, { force: true });
      die(`[coord-service] 权威认领失败（HTTP ${result.status}）——本地锁已回滚，未取得租约。`);
    }
  } catch (e) {
    releaseLock(sessionId, { force: true });
    die(`[coord-service] 权威认领网络调用失败（${(e as Error).message}）——本地锁已回滚，未取得租约。`);
  }
  if (claimId === undefined) {
    releaseLock(sessionId, { force: true });
    die("[coord-service] 认领响应缺少 claim id——响应格式异常，本地锁已回滚。");
  }
  patchLock({ remoteClaimId: claimId });
  log.ok(`已获取锁：session=${lock.sessionId}，coord-service claim id=${claimId}`);
}

export async function lockHeartbeat(args: Args): Promise<void> {
  const sessionId = req(args, "session");
  const client = requireClient();
  const priorLock = readLock();

  try {
    heartbeat(sessionId);
  } catch (e) {
    die((e as Error).message);
  }

  if (!priorLock?.remoteClaimId) {
    die(
      "本地锁没有 coord-service claim id 记录——租约不完整（可能是 cutover 前取得的旧锁）。" +
        "重新 lock-acquire 取得带 D1 租约的完整锁。"
    );
  }
  try {
    const result = await client.heartbeat(priorLock.remoteClaimId);
    if (!result.ok) {
      die(
        `[coord-service] 权威心跳失败（HTTP ${result.status}，claim id=${priorLock.remoteClaimId}）——` +
          `心跳持续失败会导致租约被服务端 sweeper 自动过期回收，请尽快排查。`
      );
    }
  } catch (e) {
    die(`[coord-service] 权威心跳网络调用失败（${(e as Error).message}）——同上，请尽快排查。`);
  }
  log.ok(`心跳已更新：session=${sessionId}（本地 + D1 claim id=${priorLock.remoteClaimId}）`);
}

export async function lockRelease(args: Args): Promise<void> {
  const sessionId = req(args, "session");
  const force = !!args.flags["force"];
  const priorLock = readLock(); // capture remoteClaimId before releaseLock() deletes the file

  try {
    releaseLock(sessionId, { force });
    log.ok(`已释放本地锁：session=${sessionId}`);
  } catch (e) {
    die((e as Error).message);
  }

  const client = createCoordServiceClientFromEnv();
  if (!client) {
    log.warn("COORD_SERVICE_URL/COORD_SERVICE_TOKEN 未配置——D1 侧租约未释放，将由服务端 sweeper 过期回收。");
    return;
  }
  if (!priorLock?.remoteClaimId) {
    log.info("本地锁没有 coord-service claim id 记录——无可释放的远端租约。");
    return;
  }
  try {
    const result = await client.release(priorLock.remoteClaimId);
    if (!result.ok) {
      log.err(
        `[coord-service] 权威释放未成功（HTTP ${result.status}，claim id=${priorLock.remoteClaimId}）——` +
          `服务端 sweeper 会在 ttl 过期后自动回收；请在总线上留一句，避免下任按"仍被持有"误判。`
      );
    } else {
      log.ok(`已释放 D1 租约：claim id=${priorLock.remoteClaimId}`);
    }
  } catch (e) {
    log.err(`[coord-service] 权威释放网络调用失败（${(e as Error).message}）——同上，sweeper 会兜底回收。`);
  }
}
