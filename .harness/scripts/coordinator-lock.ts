// coordinator-lock.ts — CLI 封装：pnpm harness lock-status|lock-acquire|lock-heartbeat|lock-release
//
// 2026-07-18 割接（p29-F10 stage-1，ADR-017）：role:coord-main 租约的**唯一跨机器
// 权威**从 coord-service (D1) 切到 coord-gateway（每仓一个 RepoHub DO）。ADR-009
// 确立的协议语义不变（claim/heartbeat/TTL/机械回收），只换载体：
//
// - COORD_GATEWAY_URL/COORD_API_TOKEN/COORD_REPO 未配置 → acquire/heartbeat 直接
//   报错退出（没有权威可问就不假装能协调）。旧 COORD_SERVICE_URL/COORD_SERVICE_TOKEN
//   已随 coord-service 退役（ADR-017），配了也没用。本地文件锁保留，但降级为
//   "同机多会话的本地快速互斥"，不再是任何意义上的权威。
// - acquire：权威预查询失败（HTTP 错误/网络异常）→ 拒绝认领（fail-closed）。权威说
//   被占且新鲜 → 拒绝。权威 claim 本身失败 → 回滚本地文件锁并报错——不允许出现
//   "本地以为拿到了、权威里没有"的分裂状态。--force 仍可跳过预查询（人类明确授权
//   的抢占仪式用），但权威 claim 依然必须成功。
// - heartbeat：权威心跳失败 → 报错退出（可见）。租约新鲜度由 DO alarm 机械裁定，
//   心跳持续丢失 = 租约会被自动过期回收，会话必须感知。
// - release：需要 handoff_note（lease.md：≥10 字符，没有交接就不能放手）——从 --note
//   读，缺省生成规范默认文案。权威释放失败 → 大声警告但不阻塞本地释放（fail-open
//   但绝不 fail-silent：错误必须可见，DO alarm 最终会过期回收）。
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
import { createCoordClientFromEnv } from "@repo/coord-protocol/client";
import type { CoordClient, CoordCallError } from "@repo/coord-protocol/client";

const REMOTE_RESOURCE_ID = "role:coord-main";
const REMOTE_RESOURCE_TYPE = "coordinator-role";

const ENV_HINT =
  "COORD_GATEWAY_URL/COORD_API_TOKEN/COORD_REPO 未配置。2026-07-18 起 coord-gateway" +
  "（RepoHub DO，ADR-017）是 coordinator 租约的唯一跨机器权威——没有凭据就无法认领/心跳。" +
  "按仓 scoped token 走 devportal 自助领取（p29-F08）；旧 COORD_SERVICE_URL/" +
  "COORD_SERVICE_TOKEN 已随 coord-service 退役（ADR-017），配了也不会被读取。";

function requireClient(): CoordClient {
  const client = createCoordClientFromEnv();
  if (!client) die(ENV_HINT);
  return client;
}

function errDetail(e: CoordCallError): string {
  return e.status !== undefined ? `HTTP ${e.status}` : `网络异常：${e.message}`;
}

/** release 的 handoff_note：--note 优先；缺省生成规范默认文案（≥10 字符，含身份与时间语境）。 */
function handoffNoteOf(args: Args, sessionId: string, resourceId: string): string {
  const note = args.opts["note"];
  if (note !== undefined && note.length > 0) return note;
  return `[auto] ${sessionId} 于 ${new Date().toISOString()} 释放 ${resourceId}（未提供 --note 的机器默认交接文案）`;
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
    if (lock.remoteClaimId !== undefined) log.info(`coord-gateway lease id: ${lock.remoteClaimId}`);
    log.info(stale ? "本地状态: STALE" : "本地状态: ACTIVE");
  }

  // 权威状态在 coord-gateway（RepoHub DO）——本地文件只反映本机最后一次操作，
  // 跨机器一律以下面这段为准。
  const client = createCoordClientFromEnv();
  if (!client) {
    log.warn(
      "COORD_GATEWAY_URL/COORD_API_TOKEN/COORD_REPO 未配置——只能显示本地状态，权威状态" +
        "（coord-gateway）不可见。旧 COORD_SERVICE_* 已退役（ADR-017）。"
    );
    return;
  }
  const outcome = await client.queryActiveClaim(REMOTE_RESOURCE_ID);
  if (outcome.kind === "error") {
    // 三态纪律：问不到 ≠ 空闲——这里必须可见地报错，绝不显示成"可以 acquire"
    log.err(`[coord-gateway] 权威状态查询失败（${errDetail(outcome)}）`);
    return;
  }
  if (outcome.kind === "free") {
    log.info(`权威状态（coord-gateway）：${REMOTE_RESOURCE_ID} 无活跃租约 — 可以 acquire`);
    return;
  }
  const heartbeatAgeMinutes = (Date.now() - new Date(outcome.claim.last_heartbeat_at).getTime()) / 60000;
  log.info(`权威状态（coord-gateway）：${REMOTE_RESOURCE_ID} 由 "${outcome.claim.agent_id}" 持有（lease id=${outcome.claim.lease_id}）`);
  log.info(`最后心跳：${outcome.claim.last_heartbeat_at}（${heartbeatAgeMinutes.toFixed(1)} 分钟前，ttl=${outcome.claim.ttl_seconds}s）`);
}

export async function lockAcquire(args: Args): Promise<void> {
  const sessionId = req(args, "session");
  const force = !!args.flags["force"];
  const note = args.opts["note"];

  const client = requireClient();

  if (!force) {
    const outcome = await client.queryActiveClaim(REMOTE_RESOURCE_ID);
    if (outcome.kind === "error") {
      die(
        `[coord-gateway] 查询权威认领状态失败（${errDetail(outcome)}）——权威联系不上时不假装能协调，` +
          `拒绝认领（fail-closed，见 ADR-009/ADR-017）。确认要在无权威状态下强行接管，加 --force` +
          `（人类授权的抢占仪式）。`
      );
    }
    if (outcome.kind === "held") {
      // #502：属主判定不比对手填的 --session（曾因 session 标签与 token 身份错位导致
      // renew 分支永不触发）。改为试探性 heartbeat——服务端校验 agent_id 与租约持有者
      // 一致（scoped token 由网关注入在册身份，#721），成功 = 就是你的（顺便完成续约）。
      const renew = await client.heartbeat(outcome.claim.lease_id);
      if (renew.kind === "ok") {
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
        patchLock({ remoteClaimId: outcome.claim.lease_id });
        log.ok(`已续约：agent=${outcome.claim.agent_id}，coord-gateway lease id=${outcome.claim.lease_id}（本来就由你持有）`);
        return;
      }
      // 试探续约被拒 = 不是你的 token（403）或租约已终态（410）。新鲜 → 拒绝重复调度；
      // 过期 → 放行走新认领（服务端单线程 claim 仍是最终原子裁定）。
      const heartbeatAgeMinutes = (Date.now() - new Date(outcome.claim.last_heartbeat_at).getTime()) / 60000;
      if (renew.kind !== "gone" && heartbeatAgeMinutes <= STALE_THRESHOLD_MINUTES) {
        die(
          `[coord-gateway] 已有 coordinator "${outcome.claim.agent_id}" 持有 role:coord-main 租约` +
            `（最后心跳 ${heartbeatAgeMinutes.toFixed(1)} 分钟前）。不要重复调度——如确认它已失效，加 --force 抢占。`
        );
      }
      log.info(
        `[coord-gateway] 持有者 "${outcome.claim.agent_id}" 的租约已失效` +
          `（${renew.kind === "gone" ? "已被机械回收" : `心跳 ${heartbeatAgeMinutes.toFixed(1)} 分钟前`}），按新认领处理`
      );
    }
  }

  let lock: CoordinatorLock;
  try {
    lock = acquireLock(sessionId, { force, note });
  } catch (e) {
    die((e as Error).message);
  }

  // 权威 claim 是权威动作——失败必须回滚本地文件锁，不允许分裂状态。
  const result = await client.claim(REMOTE_RESOURCE_ID, REMOTE_RESOURCE_TYPE);
  if (result.kind === "conflict") {
    releaseLock(sessionId, { force: true });
    die(
      `role:coord-main 认领冲突——已由 "${result.holder.agent_id}" 持有（lease id=${result.holder.lease_id}，` +
        `最后心跳 ${result.holder.last_heartbeat_at}）。这是 DO 单线程的原子判定，本地锁已回滚。`
    );
  }
  if (result.kind === "error") {
    releaseLock(sessionId, { force: true });
    die(`[coord-gateway] 权威认领失败（${errDetail(result)}）——本地锁已回滚，未取得租约。`);
  }
  patchLock({ remoteClaimId: result.lease.lease_id });
  log.ok(
    `已获取锁：session=${lock.sessionId}，coord-gateway lease id=${result.lease.lease_id}` +
      `${result.kind === "already_yours" ? "（幂等：该租约本就由你的 token 持有）" : ""}`
  );
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

  if (typeof priorLock?.remoteClaimId !== "string") {
    die(
      "本地锁没有 coord-gateway lease id 记录——租约不完整（可能是 ADR-017 割接前取得的旧锁，" +
        "旧 coord-service 数字 claim id 已无效）。重新 lock-acquire 取得带 gateway 租约的完整锁。"
    );
  }
  const result = await client.heartbeat(priorLock.remoteClaimId);
  if (result.kind === "gone") {
    die(
      `[coord-gateway] 租约已终态（${result.leaseStatus ?? "released/expired"}，lease id=${priorLock.remoteClaimId}）——` +
        `已被释放或被 DO alarm 机械过期回收，不能僵尸续命。重新 lock-acquire。`
    );
  }
  if (result.kind === "error") {
    die(
      `[coord-gateway] 权威心跳失败（${errDetail(result)}，lease id=${priorLock.remoteClaimId}）——` +
        `心跳持续失败会导致租约被 DO alarm 自动过期回收，请尽快排查。`
    );
  }
  log.ok(`心跳已更新：session=${sessionId}（本地 + coord-gateway lease id=${priorLock.remoteClaimId}）`);
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

  const client = createCoordClientFromEnv();
  if (!client) {
    log.warn(
      "COORD_GATEWAY_URL/COORD_API_TOKEN/COORD_REPO 未配置——权威侧租约未释放，将由 DO alarm " +
        "过期回收（旧 COORD_SERVICE_* 已退役，ADR-017）。"
    );
    return;
  }
  if (typeof priorLock?.remoteClaimId !== "string") {
    log.info("本地锁没有 coord-gateway lease id 记录——无可释放的远端租约。");
    return;
  }
  const result = await client.release(priorLock.remoteClaimId, handoffNoteOf(args, sessionId, REMOTE_RESOURCE_ID));
  if (result.kind === "gone") {
    log.info(`[coord-gateway] 租约已是终态（lease id=${priorLock.remoteClaimId}）——无需重复释放。`);
  } else if (result.kind === "error") {
    // fail-open（不阻塞本地释放）但绝不 fail-silent：错误大声可见
    log.err(
      `[coord-gateway] 权威释放未成功（${errDetail(result)}，lease id=${priorLock.remoteClaimId}）——` +
        `DO alarm 会在 ttl 过期后自动回收；请在总线上留一句，避免下任按"仍被持有"误判。`
    );
  } else {
    log.ok(`已释放 coord-gateway 租约：lease id=${priorLock.remoteClaimId}`);
  }
}
