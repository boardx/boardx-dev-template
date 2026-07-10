// module-lock.ts — CLI 封装：pnpm harness module-lock-status|acquire|heartbeat|release
//   --module <name> --session <agent-id>
//
// 2026-07-08 cutover（ADR-009）：coord-service (D1) 是 module-coordinator 租约的
// **唯一权威**。此前版本的"发 GitHub lease issue 评论为主 + 可选 D1 影子写"已按
// 人类决定整体退役——本命令不再读写任何 GitHub issue/评论/label。
//
// 语义变化（对照 ADR-006 时代）：
// - COORD_SERVICE_URL/COORD_SERVICE_TOKEN 未配置 → 直接报错退出，不再有
//   "静默降级回 GitHub"的路径（那条路已被取消，见 ADR-009 激活门槛一节）。
// - acquire 先问 D1 是否被占：被占且未过期 → 拒绝；查询失败 → 拒绝（fail-closed，
//   权威联系不上就不假装能协调）。真正的原子性仍由服务端 uq_active_claim 唯一索引
//   保证，这里的预查询只是为了给出可读的"被谁占着"报错，抢占竞态最终以 INSERT
//   冲突（409）为准。
// - heartbeat 失败 → 报错退出（可见），租约新鲜度现在完全由 D1 sweeper 裁定，
//   心跳丢失的后果是租约会被自动过期回收，会话必须知道这件事，不能静默吞掉。
// - release 失败 → 大声警告但不阻塞（sweeper 最终会过期回收，释放动作宽容处理）。
import { req } from "./lib/args";
import { log, die } from "./lib/log";
import { createCoordServiceClientFromEnv } from "@repo/coord-service/client";
import type { CoordServiceClient } from "@repo/coord-service/client";
import {
  readModuleRemoteClaimId,
  writeModuleRemoteClaimId,
  clearModuleRemoteClaimId,
} from "./lib/module-lock-state";
import type { Args } from "./lib/args";

const RESOURCE_TYPE = "coordinator-role";

function resourceId(moduleName: string): string {
  // 与 projector 的 role:coord-<module> ↔ coordination:lease:<module> 映射约定一致
  // （projector 本身已随 ADR-009 退役，但 resource_id 命名约定保留，dashboard/
  // status API 按同一约定展示）。
  return `role:coord-${moduleName}`;
}

function requireClient(): CoordServiceClient {
  const client = createCoordServiceClientFromEnv();
  if (!client) {
    die(
      "COORD_SERVICE_URL/COORD_SERVICE_TOKEN 未配置。2026-07-08 起 coord-service (D1) 是" +
        "协调租约的唯一权威（ADR-009），GitHub issue 评论机制已退役——没有凭据就无法认领/" +
        "心跳/退位。找人类或 coord-main 领取本会话身份的 token（packages/coord-service/" +
        "scripts/seed-agents.ts 产出，只显示一次）。"
    );
  }
  return client;
}

export async function moduleLockStatus(args: Args): Promise<void> {
  const moduleName = req(args, "module");
  const client = requireClient();
  const rid = resourceId(moduleName);

  const outcome = await client.queryActiveClaim(rid);
  if (outcome.kind === "error") {
    die(`[coord-service] 查询 ${rid} 失败（HTTP ${outcome.status}）——权威联系不上，无法给出状态。`);
  }
  if (outcome.kind === "free") {
    log.info(`${rid}: 无活跃租约 — 可以 acquire`);
    return;
  }
  const heartbeatAgeMinutes = (Date.now() - new Date(outcome.claim.last_heartbeat_at).getTime()) / 60000;
  log.info(`${rid}: 由 "${outcome.claim.agent_id}" 持有（claim id=${outcome.claim.id}）`);
  log.info(`最后心跳：${outcome.claim.last_heartbeat_at}（${heartbeatAgeMinutes.toFixed(1)} 分钟前，ttl=${outcome.claim.ttl_seconds}s）`);
}

export async function moduleLockAcquire(args: Args): Promise<void> {
  const moduleName = req(args, "module");
  const sessionId = req(args, "session");
  const client = requireClient();
  const rid = resourceId(moduleName);

  const outcome = await client.queryActiveClaim(rid);
  if (outcome.kind === "error") {
    die(
      `[coord-service] 查询 ${rid} 失败（HTTP ${outcome.status}）——权威联系不上时不假装能协调，` +
        `拒绝认领（fail-closed，见 ADR-009）。`
    );
  }
  if (outcome.kind === "held" && outcome.claim.agent_id !== sessionId) {
    const heartbeatAgeMinutes = (Date.now() - new Date(outcome.claim.last_heartbeat_at).getTime()) / 60000;
    die(
      `${rid} 已由 "${outcome.claim.agent_id}" 持有（最后心跳 ${heartbeatAgeMinutes.toFixed(1)} 分钟前）。` +
        `过期租约由服务端 sweeper 自动回收——等它过期，或与持有者协调交接。`
    );
  }
  if (outcome.kind === "held") {
    // acquire-or-renew（2026-07-08 租约语义定稿）：自己仍持有且新鲜 → 转为续约，
    // 而不是撞 uq_active_claim 得到一个吓人的 409。协议规范是"每个 tick
    // acquire-or-renew"——tick 间隔撑不过 ttl 时租约正常过期、下个 tick 重新
    // 认领即自愈，席位间歇性空缺是诚实信号不是故障。
    const renew = await client.heartbeat(outcome.claim.id);
    if (renew.ok) {
      writeModuleRemoteClaimId(moduleName, outcome.claim.id);
      log.ok(`已续约 ${rid}：session=${sessionId}，claim id=${outcome.claim.id}（本来就由你持有）`);
      return;
    }
    log.info(`[coord-service] 续约未成功（HTTP ${renew.status}），按新认领处理`);
  }

  const result = await client.claim(rid, RESOURCE_TYPE);
  if (!result.ok) {
    if (result.status === 409) {
      die(`${rid} 认领冲突（另一会话刚抢先一步）——这是 uq_active_claim 原子判定的结果，不要重试抢占。`);
    }
    die(`[coord-service] 认领失败（HTTP ${result.status}）。`);
  }
  const claim = (result.body as { claim?: { id: number } } | undefined)?.claim;
  if (!claim) {
    die("[coord-service] 认领响应缺少 claim id——响应格式异常，视为失败。");
  }
  writeModuleRemoteClaimId(moduleName, claim.id);
  log.ok(`已认领 ${rid}：session=${sessionId}，claim id=${claim.id}`);
}

export async function moduleLockHeartbeat(args: Args): Promise<void> {
  const moduleName = req(args, "module");
  req(args, "session"); // 保持接口不变；身份最终由 token 决定，不信任这里的自称
  const client = requireClient();

  const remoteClaimId = readModuleRemoteClaimId(moduleName);
  if (!remoteClaimId) {
    die(`本地没有 ${moduleName} 的 claim id 记录——先 module-lock-acquire，或该租约已在别处释放。`);
  }
  const result = await client.heartbeat(remoteClaimId);
  if (!result.ok) {
    die(
      `[coord-service] 心跳失败（HTTP ${result.status}，claim id=${remoteClaimId}）——租约新鲜度由 D1 ` +
        `sweeper 裁定，心跳持续失败会导致租约被自动过期回收，请尽快排查。`
    );
  }
  log.ok(`心跳已更新：module=${moduleName}，claim id=${remoteClaimId}`);
}

export async function moduleLockRelease(args: Args): Promise<void> {
  const moduleName = req(args, "module");
  req(args, "session");
  const client = requireClient();

  const remoteClaimId = readModuleRemoteClaimId(moduleName);
  if (!remoteClaimId) {
    log.info(`本地没有 ${moduleName} 的 claim id 记录——无可释放的远端租约（可能已释放/已过期）。`);
    return;
  }
  try {
    const result = await client.release(remoteClaimId);
    if (!result.ok) {
      log.err(
        `[coord-service] 释放未成功（HTTP ${result.status}，claim id=${remoteClaimId}）——服务端 sweeper ` +
          `会在 ttl 过期后自动回收，本地记录照常清理，但请在总线上留一句，避免下任按"仍被持有"误判。`
      );
    } else {
      log.ok(`已释放：module=${moduleName}，claim id=${remoteClaimId}`);
    }
  } finally {
    clearModuleRemoteClaimId(moduleName);
  }
}
