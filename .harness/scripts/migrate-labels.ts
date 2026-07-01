// migrate-labels.ts — 把线上漂移的 label 收敛到规范 status:* 状态机（ADR-004）。
// 幂等：可反复跑。默认 dry-run，仅打印计划；加 --apply 才通过 gh CLI 执行。
//
//   pnpm harness migrate-labels            # dry-run，打印将做什么
//   pnpm harness migrate-labels --apply    # 实际执行（需先 gh auth login）
//
// 做两件事：
//  1) 确保规范 label 集合存在（gh label create --force，幂等）。
//  2) 对每个带旧/漂移 label 的 open issue：加规范 label、去旧 label。
//     旧 label 本身**不删除**（删除会从所有 issue 上抹掉，破坏性）——只做迁移，
//     停用留给人工确认后单独 `gh label delete`。
import { parse } from "yaml";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HARNESS_DIR } from "./lib/paths";
import { sh } from "./lib/sh";
import { log } from "./lib/log";
import type { Args } from "./lib/args";

// 规范 status:* 生命周期 + 颜色（见 multi-agent-coordination.md §1.1）
const STATUS_LABELS: Array<{ name: string; color: string; desc: string }> = [
  { name: "status:needs-spec", color: "d4c5f9", desc: "规范/DoR 未达标，不可开发" },
  { name: "status:ready-for-dev", color: "0e8a16", desc: "DoR 达标、依赖全绿、可分派" },
  { name: "status:in-progress", color: "fbca04", desc: "已认领并在写码（认领锁）" },
  { name: "status:in-review", color: "1d76db", desc: "PR 已开，reviewer 评审中" },
  { name: "status:changes-requested", color: "e99695", desc: "review 要求改动，退回开发" },
  { name: "status:approved", color: "0e8a16", desc: "必需 review 全绿，待合并" },
  { name: "status:merged", color: "5319e7", desc: "终态：PR 合并、issue 关闭" },
  { name: "status:blocked", color: "b60205", desc: "外部障碍阻塞" },
];

// review verdict labels
const REVIEW_LABELS: Array<{ name: string; color: string; desc: string }> = [
  { name: "review:code-ok", color: "c2e0c6", desc: "code-reviewer 通过" },
  { name: "review:e2e-ok", color: "c2e0c6", desc: "e2e-verifier 通过" },
  { name: "review:feature-ok", color: "c2e0c6", desc: "feature-evaluator 通过" },
  { name: "review:security-ok", color: "c2e0c6", desc: "安全审查通过" },
  { name: "review:changes", color: "e99695", desc: "有 reviewer 要求改动" },
];

// 旧/漂移 label → 规范 label（迁移映射，见 §1.3）
const MIGRATIONS: Record<string, string> = {
  "in-progress": "status:in-progress",
  blocked: "status:blocked",
  passing: "status:merged",
};

function repo(): string {
  const cfg = parse(readFileSync(join(HARNESS_DIR, "config", "github-sync.yaml"), "utf8")) as {
    repo: string;
  };
  return cfg.repo;
}

export function migrateLabels(args: Args): void {
  const apply = !!args.flags["apply"];
  const r = repo();
  const plan: string[] = [];
  const run = (cmd: string, desc: string) => {
    plan.push(`# ${desc}\n${cmd}`);
    if (apply) {
      const res = sh(cmd);
      if (res.code !== 0) log.err(`失败(${res.code}): ${cmd}\n${res.stderr}`);
      else log.ok(desc);
    }
  };

  // 1) 确保规范 label 存在（幂等 --force：存在则更新颜色/描述）
  for (const l of [...STATUS_LABELS, ...REVIEW_LABELS]) {
    run(
      `gh label create ${JSON.stringify(l.name)} --repo ${r} --color ${l.color} ` +
        `--description ${JSON.stringify(l.desc)} --force`,
      `确保 label: ${l.name}`
    );
  }

  // 2) 迁移带旧 label 的 open issue
  for (const [oldLabel, newLabel] of Object.entries(MIGRATIONS)) {
    if (!apply) {
      run(
        `gh issue list --repo ${r} --state open --label ${JSON.stringify(oldLabel)} --json number`,
        `dry-run：将把带「${oldLabel}」的 issue 迁到「${newLabel}」`
      );
      continue;
    }
    const res = sh(
      `gh issue list --repo ${r} --state open --label ${JSON.stringify(oldLabel)} --json number --limit 200`
    );
    if (res.code !== 0) {
      log.err(`查询 ${oldLabel} 失败：${res.stderr}`);
      continue;
    }
    const issues = JSON.parse(res.stdout) as Array<{ number: number }>;
    for (const it of issues) {
      run(
        `gh issue edit ${it.number} --repo ${r} --add-label ${JSON.stringify(newLabel)} ` +
          `--remove-label ${JSON.stringify(oldLabel)}`,
        `issue #${it.number}: ${oldLabel} → ${newLabel}`
      );
    }
  }

  log.info(`\n— 迁移计划（${apply ? "已执行" : "dry-run，加 --apply 执行"}）—`);
  for (const c of plan) log.info(c);
  log.info(
    `\n共 ${plan.length} 条 gh 操作。旧 label 未删除（迁移后如确认无引用，可人工 gh label delete）。`
  );
}
