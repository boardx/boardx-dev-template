import { parseArgs } from "./lib/args";
import { log } from "./lib/log";
import { newPhase } from "./new-phase";
import { newSprint } from "./new-sprint";
import { verify } from "./verify";
import { syncGithub } from "./sync-github";
import { genSubagents } from "./gen-subagents";
import { claim } from "./claim";

const argv = process.argv.slice(2);
const cmd = argv[0];
const args = parseArgs(argv.slice(1));

try {
  switch (cmd) {
    case "new-phase":     newPhase(args); break;
    case "new-sprint":    newSprint(args); break;
    case "verify":        verify(args); break;
    case "sync":          syncGithub(args); break;
    case "gen-subagents": genSubagents(args); break;
    case "claim":         claim(args); break;
    default:
      log.info("用法:");
      log.info("  pnpm harness new-phase     --id NN --name <name> [--slug <s>] [--goal <g>]");
      log.info("  pnpm harness new-sprint    --phase NN --id MM [--goal <g>] [--features F01,F02]");
      log.info("  pnpm harness verify        --sprint NN/MM | --phase NN [--feature F01] [--owner <id>]");
      log.info("  pnpm harness sync          --phase NN [--apply]");
      log.info("  pnpm harness gen-subagents             # 从 .harness/agents/*.yaml 生成 Claude + Codex subagents");
      log.info("  pnpm harness claim         --phase NN --feature F01 --owner <agent-id>");
      process.exit(cmd ? 1 : 0);
  }
} catch (e) {
  log.err((e as Error).message);
  process.exit(1);
}
