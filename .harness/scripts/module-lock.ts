// module-lock.ts — CLI 封装：pnpm harness module-lock-status|acquire|heartbeat|release
//   --module <name> --session <agent-id>
//
// Phase 4（coord-service 迁移）：module-coordinator 的租约今天纯靠手动
// `gh issue comment` 达成（见 .agents/skills/module-coordinator/SKILL.md），没有像
// coord-main 那样的本地文件锁可以包一层。这个命令把"发规范格式评论"这件事固化
// 成一条命令而不是每个会话手打 gh——评论内容、格式与今天的 SKILL.md 约定完全一致，
// 只是不用再手动拼命令。GitHub 评论在 Phase 5 之前仍是唯一权威；coord-service
// dual-write 是 opt-in 的（同 Phase 3：COORD_SERVICE_URL/COORD_SERVICE_TOKEN 都设了
// 才发起网络调用，失败只记日志，不影响 GitHub 评论已经发出去这件事）。
//
// 这条命令是新增能力，不强制任何人使用——不设置这两个环境变量、继续手打
// `gh issue comment` 完全等价，行为不变。
import { sh } from "./lib/sh";
import { req } from "./lib/args";
import { log } from "./lib/log";
import { createCoordServiceClientFromEnv } from "@repo/coord-service/client";
import {
  readModuleRemoteClaimId,
  writeModuleRemoteClaimId,
  clearModuleRemoteClaimId,
} from "./lib/module-lock-state";
import type { Args } from "./lib/args";

function leaseLabel(moduleName: string): string {
  return `coordination:lease:${moduleName}`;
}

function findLeaseIssueNumber(moduleName: string): number {
  const label = leaseLabel(moduleName);
  const result = sh(`gh issue list --state open --label ${JSON.stringify(label)} --json number --limit 1`);
  if (result.code !== 0) {
    throw new Error(`gh issue list 失败：${result.stderr || result.stdout}`);
  }
  const parsed = JSON.parse(result.stdout || "[]") as Array<{ number: number }>;
  const first = parsed[0];
  if (!first) {
    throw new Error(
      `找不到 label 为 "${label}" 的 lease issue——先按 module-coordinator SKILL.md 建一个`
    );
  }
  return first.number;
}

function postComment(issueNumber: number, body: string): void {
  const result = sh(`gh issue comment ${issueNumber} --body ${JSON.stringify(body)}`);
  if (result.code !== 0) {
    throw new Error(`gh issue comment 失败：${result.stderr || result.stdout}`);
  }
}

async function dualWriteClaim(moduleName: string, sessionId: string): Promise<void> {
  const client = createCoordServiceClientFromEnv();
  if (!client) return;
  try {
    const result = await client.claim(`role:${sessionId}`, "coordinator-role");
    if (result.ok) {
      const claim = (result.body as { claim?: { id: number } } | undefined)?.claim;
      if (claim) {
        writeModuleRemoteClaimId(moduleName, claim.id);
        log.info(`[coord-service] dual-write claim 成功：id=${claim.id}`);
      }
    } else {
      log.info(`[coord-service] dual-write claim 未成功（status=${result.status}），GitHub 评论不受影响`);
    }
  } catch (e) {
    log.info(`[coord-service] dual-write 网络调用失败（${(e as Error).message}），GitHub 评论不受影响`);
  }
}

async function dualWriteHeartbeat(moduleName: string): Promise<void> {
  const client = createCoordServiceClientFromEnv();
  const remoteClaimId = readModuleRemoteClaimId(moduleName);
  if (!client || !remoteClaimId) return;
  try {
    const result = await client.heartbeat(remoteClaimId);
    if (!result.ok) log.info(`[coord-service] dual-write heartbeat 未成功（status=${result.status}）`);
  } catch (e) {
    log.info(`[coord-service] dual-write heartbeat 网络调用失败（${(e as Error).message}）`);
  }
}

async function dualWriteRelease(moduleName: string): Promise<void> {
  const client = createCoordServiceClientFromEnv();
  const remoteClaimId = readModuleRemoteClaimId(moduleName);
  if (client && remoteClaimId) {
    try {
      const result = await client.release(remoteClaimId);
      if (!result.ok) log.info(`[coord-service] dual-write release 未成功（status=${result.status}）`);
    } catch (e) {
      log.info(`[coord-service] dual-write release 网络调用失败（${(e as Error).message}）`);
    }
  }
  clearModuleRemoteClaimId(moduleName);
}

export function moduleLockStatus(args: Args): void {
  const moduleName = req(args, "module");
  const issueNumber = findLeaseIssueNumber(moduleName);
  log.info(`lease issue: #${issueNumber}（label ${leaseLabel(moduleName)}）`);
  const remoteClaimId = readModuleRemoteClaimId(moduleName);
  if (remoteClaimId) log.info(`coord-service claim id: ${remoteClaimId}`);
  log.info(`最近评论请看：gh issue view ${issueNumber} --comments`);
}

export async function moduleLockAcquire(args: Args): Promise<void> {
  const moduleName = req(args, "module");
  const sessionId = req(args, "session");
  const issueNumber = findLeaseIssueNumber(moduleName);
  const at = new Date().toISOString();

  postComment(issueNumber, `module-coordinator-claim by:${sessionId} at ${at}`);
  log.ok(`已在 lease issue #${issueNumber} 发认领评论：${sessionId}`);

  await dualWriteClaim(moduleName, sessionId);
}

export async function moduleLockHeartbeat(args: Args): Promise<void> {
  const moduleName = req(args, "module");
  const sessionId = req(args, "session");
  const issueNumber = findLeaseIssueNumber(moduleName);
  const at = new Date().toISOString();

  postComment(issueNumber, `module-coordinator-heartbeat by:${sessionId} at ${at}`);
  log.ok(`已在 lease issue #${issueNumber} 发心跳评论：${sessionId}`);

  await dualWriteHeartbeat(moduleName);
}

export async function moduleLockRelease(args: Args): Promise<void> {
  const moduleName = req(args, "module");
  const sessionId = req(args, "session");
  const issueNumber = findLeaseIssueNumber(moduleName);
  const at = new Date().toISOString();

  postComment(issueNumber, `module-coordinator-release by:${sessionId} at ${at}`);
  log.ok(`已在 lease issue #${issueNumber} 发退位评论：${sessionId}`);

  await dualWriteRelease(moduleName);
}
