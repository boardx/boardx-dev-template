import { parseArgs } from "./lib/args";
import { log } from "./lib/log";
import { newPhase } from "./new-phase";
import { newSprint } from "./new-sprint";
import { verify } from "./verify";
import { syncGithub } from "./sync-github";
import { genSubagents } from "./gen-subagents";
import { claim } from "./claim";
import { migrateLabels } from "./migrate-labels";
import { sweepUnblock } from "./sweep-unblock";
import { sweepWorktrees } from "./sweep-worktrees";
import { depGraph } from "./dep-graph";
import { lockStatus, lockAcquire, lockHeartbeat, lockRelease } from "./coordinator-lock";
import { moduleLockStatus, moduleLockAcquire, moduleLockHeartbeat, moduleLockRelease } from "./module-lock";

const argv = process.argv.slice(2);
const cmd = argv[0];
const args = parseArgs(argv.slice(1));

// Wrapped in an async function only because lock-acquire/heartbeat/release now
// optionally await a coord-service dual-write (Phase 3) — every other command
// is still called synchronously below, unchanged from before.
async function main(): Promise<void> {
  switch (cmd) {
    case "new-phase":     newPhase(args); break;
    case "new-sprint":    newSprint(args); break;
    case "verify":        verify(args); break;
    case "sync":          syncGithub(args); break;
    case "gen-subagents": genSubagents(args); break;
    case "claim":         claim(args); break;
    case "migrate-labels": migrateLabels(args); break;
    case "sweep-unblock":  sweepUnblock(args); break;
    case "sweep-worktrees": sweepWorktrees(args); break;
    case "dep-graph":      depGraph(args); break;
    case "lock-status":    lockStatus(args); break;
    case "lock-acquire":   await lockAcquire(args); break;
    case "lock-heartbeat": await lockHeartbeat(args); break;
    case "lock-release":   await lockRelease(args); break;
    case "module-lock-status":    moduleLockStatus(args); break;
    case "module-lock-acquire":   await moduleLockAcquire(args); break;
    case "module-lock-heartbeat": await moduleLockHeartbeat(args); break;
    case "module-lock-release":   await moduleLockRelease(args); break;
    default:
      log.info("用法:");
      log.info("  pnpm harness new-phase     --id NN --name <name> [--slug <s>] [--goal <g>] [--ui]");
      log.info("                             --ui：有界面的阶段，scaffold UI 先行确认关卡（ADR-003）");
      log.info("  pnpm harness new-sprint    --phase NN --id MM [--goal <g>] [--features F01,F02]");
      log.info("  pnpm harness verify        --sprint NN/MM | --phase NN [--feature F01] [--owner <id>]");
      log.info("  pnpm harness sync          --phase NN [--apply]");
      log.info("  pnpm harness gen-subagents             # 从 .harness/agents/*.yaml 生成 Claude + Codex subagents");
      log.info("  pnpm harness claim         --phase NN --feature F01 --owner <agent-id>");
      log.info("  pnpm harness migrate-labels            # 收敛线上 label 到规范 status:*（ADR-004）；加 --apply 执行");
      log.info("  pnpm harness sweep-unblock [--dry-run]                 # depends_on 全 passing 的 blocked → not_started");
      log.info("  pnpm harness sweep-worktrees [--threshold-minutes N]   # 巡检未提交改动的 worker worktree（默认阈值 60）");
      log.info("  pnpm harness dep-graph                                 # 生成 .harness/state/dep-graph.md 依赖图快照");
      log.info("  pnpm harness lock-status");
      log.info("  pnpm harness lock-acquire   --session <id> [--force] [--note <text>]");
      log.info("  pnpm harness lock-heartbeat --session <id>");
      log.info("  pnpm harness lock-release   --session <id> [--force]");
      log.info("  pnpm harness module-lock-status    --module <name>");
      log.info("  pnpm harness module-lock-acquire   --module <name> --session <agent-id>");
      log.info("  pnpm harness module-lock-heartbeat --module <name> --session <agent-id>");
      log.info("  pnpm harness module-lock-release   --module <name> --session <agent-id>");
      process.exit(cmd ? 1 : 0);
  }
}

main().catch((e: unknown) => {
  log.err((e as Error).message);
  process.exit(1);
});
