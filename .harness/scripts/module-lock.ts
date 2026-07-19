// module-lock.ts — CLI 封装：pnpm harness module-lock-status|acquire|heartbeat|release
//   --module <name> [--session <agent-id>] [--note <handoff>]
//
// 2026-07-18 割接（p29-F10 stage-1，ADR-017）：module-coordinator 租约的**唯一权威**
// 从 coord-service (D1) 切到 coord-gateway（每仓一个 RepoHub DO）。ADR-009 的协议
// 语义不变，只换载体；resource 命名从 D1 时代的 `role:coord-<module>` 对齐协议规格的
// `module:<name>`（lease.md 资源命名，resource_type=module）。
//
// 语义要点（对照 ADR-006/ADR-009 时代）：
// - COORD_GATEWAY_URL/COORD_API_TOKEN/COORD_REPO 未配置 → 直接报错退出（没有权威
//   可问就不假装能协调）。旧 COORD_SERVICE_URL/COORD_SERVICE_TOKEN 已退役（ADR-017）。
// - acquire 先问权威是否被占：被占且未过期 → 拒绝；查询失败 → 拒绝（fail-closed）。
//   真正的原子性由 RepoHub DO 单线程串行执行保证（禁止 SELECT-then-INSERT，
//   lease.md §原子性保证），这里的预查询只是为了给出可读的"被谁占着"报错，抢占竞态
//   最终以 claim 的 409（带 holder）为准。
// - heartbeat 失败 → 报错退出（可见），租约新鲜度由 DO alarm 机械裁定，心跳丢失的
//   后果是租约会被自动过期回收，会话必须知道这件事，不能静默吞掉。
// - release 需要 handoff_note（≥10 字符，没有交接就不能放手）——从 --note 读，缺省
//   生成规范默认文案。释放失败 → 大声警告但不阻塞（fail-open 但绝不 fail-silent，
//   DO alarm 最终会过期回收）。
import { req } from "./lib/args";
import { log, die } from "./lib/log";
import { requireClient as requireClientShared, errDetail } from "./lib/coord-client";
import type { CoordClient } from "@repo/coord-protocol/client";
import {
  readModuleRemoteClaimId,
  writeModuleRemoteClaimId,
  clearModuleRemoteClaimId,
} from "./lib/module-lock-state";
import type { Args } from "./lib/args";

const RESOURCE_TYPE = "module";

function resourceId(moduleName: string): string {
  // lease.md 资源命名：module:<name>（模块协调锁）。D1 时代的 role:coord-<module>
  // 映射随 coord-service 退役（ADR-017）；dashboard/status 展示按新命名对齐。
  return `module:${moduleName}`;
}

function requireClient(): CoordClient {
  return requireClientShared(
    "COORD_GATEWAY_URL/COORD_API_TOKEN/COORD_REPO 未配置。2026-07-18 起 coord-gateway" +
      "（RepoHub DO，ADR-017）是协调租约的唯一权威——没有凭据就无法认领/心跳/退位。" +
      "按仓 scoped token 走 devportal 自助领取（p29-F08）；旧 COORD_SERVICE_URL/" +
      "COORD_SERVICE_TOKEN 已随 coord-service 退役（ADR-017），配了也不会被读取。"
  );
}

export async function moduleLockStatus(args: Args): Promise<void> {
  const moduleName = req(args, "module");
  const client = requireClient();
  const rid = resourceId(moduleName);

  const outcome = await client.queryActiveClaim(rid);
  if (outcome.kind === "error") {
    // 三态纪律：问不到 ≠ 空闲，绝不显示成"可以 acquire"
    die(`[coord-gateway] 查询 ${rid} 失败（${errDetail(outcome)}）——权威联系不上，无法给出状态。`);
  }
  if (outcome.kind === "free") {
    log.info(`${rid}: 无活跃租约 — 可以 acquire`);
    return;
  }
  const heartbeatAgeMinutes = (Date.now() - new Date(outcome.claim.last_heartbeat_at).getTime()) / 60000;
  log.info(`${rid}: 由 "${outcome.claim.agent_id}" 持有（lease id=${outcome.claim.lease_id}）`);
  log.info(`最后心跳：${outcome.claim.last_heartbeat_at}（${heartbeatAgeMinutes.toFixed(1)} 分钟前，ttl=${outcome.claim.ttl_seconds}s）`);
}

export async function moduleLockAcquire(args: Args): Promise<void> {
  const moduleName = req(args, "module");
  // #502：--session 只是显示标签，不参与属主判定。真实身份来自 token——scoped token
  // 由网关按 DO 在册记录强绑定/注入 agent_id（#721），请求侧自证一律不信。
  const sessionLabel = args.opts["session"] ?? "(token 身份)";
  const client = requireClient();
  const rid = resourceId(moduleName);

  const outcome = await client.queryActiveClaim(rid);
  if (outcome.kind === "error") {
    die(
      `[coord-gateway] 查询 ${rid} 失败（${errDetail(outcome)}）——权威联系不上时不假装能协调，` +
        `拒绝认领（fail-closed，见 ADR-009/ADR-017）。`
    );
  }
  if (outcome.kind === "held") {
    // acquire-or-renew：是不是"自己仍持有"用试探性 heartbeat 判定——成功 = token
    // 证明这个 lease 就是你的（顺便完成续约）；失败 = 属主另有其人（或已被回收）。
    const renew = await client.heartbeat(outcome.claim.lease_id);
    if (renew.kind === "ok") {
      if (args.opts["session"] && args.opts["session"] !== outcome.claim.agent_id) {
        log.info(
          `⚠ --session "${args.opts["session"]}" 与 token 权威身份 "${outcome.claim.agent_id}" 不一致——` +
            `以 token 为准（--session 仅作标签，见 issue #502）`
        );
      }
      writeModuleRemoteClaimId(moduleName, outcome.claim.lease_id);
      log.ok(`已续约 ${rid}：agent=${outcome.claim.agent_id}，lease id=${outcome.claim.lease_id}（本来就由你持有）`);
      return;
    }
    if (renew.kind !== "gone") {
      const heartbeatAgeMinutes = (Date.now() - new Date(outcome.claim.last_heartbeat_at).getTime()) / 60000;
      die(
        `${rid} 已由 "${outcome.claim.agent_id}" 持有（最后心跳 ${heartbeatAgeMinutes.toFixed(1)} 分钟前，` +
          `试探续约被权威拒绝 ${errDetail(renew)}——不是你的 token）。过期租约由 DO alarm 自动回收——` +
          `等它过期，或与持有者协调交接。`
      );
    }
    // gone = 刚被释放/机械回收，按新认领处理（DO 单线程 claim 仍是最终原子裁定）
    log.info(`[coord-gateway] ${rid} 的租约已被回收，按新认领处理`);
  }

  const result = await client.claim(rid, RESOURCE_TYPE);
  if (result.kind === "conflict") {
    die(
      `${rid} 认领冲突——已由 "${result.holder.agent_id}" 持有（lease id=${result.holder.lease_id}，` +
        `最后心跳 ${result.holder.last_heartbeat_at}）。这是 DO 单线程的原子判定，不要重试抢占。`
    );
  }
  if (result.kind === "error") {
    die(`[coord-gateway] 认领失败（${errDetail(result)}）。`);
  }
  writeModuleRemoteClaimId(moduleName, result.lease.lease_id);
  log.ok(
    `已认领 ${rid}：session=${sessionLabel}，lease id=${result.lease.lease_id}` +
      `${result.kind === "already_yours" ? "（幂等：该租约本就由你的 token 持有）" : ""}`
  );
}

export async function moduleLockHeartbeat(args: Args): Promise<void> {
  const moduleName = req(args, "module");
  // --session 已可选（#502）：身份由 token 决定，属主校验在服务端
  const client = requireClient();

  const remoteClaimId = readModuleRemoteClaimId(moduleName);
  if (!remoteClaimId) {
    die(
      `本地没有 ${moduleName} 的 lease id 记录——先 module-lock-acquire，或该租约已在别处释放` +
        `（ADR-017 割接前的旧数字 claim id 也按无记录处理）。`
    );
  }
  const result = await client.heartbeat(remoteClaimId);
  if (result.kind === "gone") {
    die(
      `[coord-gateway] 租约已终态（${result.leaseStatus ?? "released/expired"}，lease id=${remoteClaimId}）——` +
        `已被释放或被 DO alarm 机械过期回收，不能僵尸续命。重新 module-lock-acquire。`
    );
  }
  if (result.kind === "error") {
    die(
      `[coord-gateway] 心跳失败（${errDetail(result)}，lease id=${remoteClaimId}）——租约新鲜度由 ` +
        `DO alarm 机械裁定，心跳持续失败会导致租约被自动过期回收，请尽快排查。`
    );
  }
  log.ok(`心跳已更新：module=${moduleName}，lease id=${remoteClaimId}`);
}

export async function moduleLockRelease(args: Args): Promise<void> {
  const moduleName = req(args, "module");
  // --session 已可选（#502），仅用于默认交接文案的身份标注
  const sessionLabel = args.opts["session"] ?? "(token 身份)";
  const client = requireClient();

  const remoteClaimId = readModuleRemoteClaimId(moduleName);
  if (!remoteClaimId) {
    log.info(`本地没有 ${moduleName} 的 lease id 记录——无可释放的远端租约（可能已释放/已过期）。`);
    return;
  }
  const note =
    args.opts["note"] && args.opts["note"].length > 0
      ? args.opts["note"]
      : `[auto] ${sessionLabel} 于 ${new Date().toISOString()} 释放 ${resourceId(moduleName)}（未提供 --note 的机器默认交接文案）`;
  try {
    const result = await client.release(remoteClaimId, note);
    if (result.kind === "gone") {
      log.info(`[coord-gateway] 租约已是终态（lease id=${remoteClaimId}）——无需重复释放。`);
    } else if (result.kind === "error") {
      // fail-open（本地记录照常清理）但绝不 fail-silent：错误大声可见
      log.err(
        `[coord-gateway] 释放未成功（${errDetail(result)}，lease id=${remoteClaimId}）——DO alarm ` +
          `会在 ttl 过期后自动回收，本地记录照常清理，但请在总线上留一句，避免下任按"仍被持有"误判。`
      );
    } else {
      log.ok(`已释放：module=${moduleName}，lease id=${remoteClaimId}`);
    }
  } finally {
    clearModuleRemoteClaimId(moduleName);
  }
}
