// verify.ts — 逐条执行 feature.verification；全部通过 + base verify 通过才门控 passing。
// 这是"通过状态门控"的唯一实现。agent 不能自己改 passing。
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { sprintDir } from "./lib/paths";
import {
  loadFeatureList,
  saveFeatureList,
  featuresForSprint,
  assertSingleInProgress,
  writeActiveFeatures,
} from "./lib/features";
import { refreshProgress } from "./lib/progress";
import { loadHarnessConfig } from "./lib/config";
import { sh } from "./lib/sh";
import { req } from "./lib/args";
import { log, die } from "./lib/log";
import type { Args } from "./lib/args";
import type { Feature } from "./lib/types";

export function verify(args: Args): void {
  const cfg = loadHarnessConfig();

  // --sprint NN/MM  或  --phase NN --feature F01
  let phaseId: string, sprintId: string | null = null, only: string | null = null;
  if (args.opts["sprint"]) {
    const parts = req(args, "sprint").split("/");
    phaseId = parts[0]!;
    sprintId = parts[1] ?? null;
  } else {
    phaseId = req(args, "phase");
  }
  only = args.opts["feature"] ?? null;

  const fl = loadFeatureList(phaseId);

  // 门控：同一时刻只允许一个 in_progress（读 config）
  if (cfg.gates.single_in_progress) {
    assertSingleInProgress(fl);
  }

  let targets: Feature[] = sprintId ? featuresForSprint(fl, sprintId) : fl.features;
  if (only) targets = targets.filter((f) => f.id === only);
  if (!targets.length) die("没有匹配的 feature 可验证");

  let promoted = 0, failed = 0;
  for (const f of targets) {
    if (f.status === "passing") {
      log.info(`${f.id} 已 passing，跳过（不可逆）`);
      continue;
    }
    log.step(`验证 ${f.id} — ${f.title}`);
    const logs: string[] = [];
    let ok = true;

    // 1) 逐条执行 feature.verification
    for (const cmd of f.verification) {
      const r = sh(cmd);
      logs.push(`$ ${cmd}\n[exit ${r.code}]\n${r.stdout}${r.stderr}`);
      if (r.code !== 0) {
        ok = false;
        log.err(`失败: ${cmd}`);
        if (cfg.verification.fail_fast) break;
      } else {
        log.ok(`通过: ${cmd}`);
      }
    }

    // 2) 如果 feature verification 全部通过，且 config 要求 base verify，额外运行基础验证
    if (ok && cfg.verification.require_base_pass) {
      const baseCmd = cfg.verification.base_verify_cmd;
      log.step(`运行基础验证（require_base_pass=true）: ${baseCmd}`);
      const br = sh(baseCmd);
      logs.push(`\n[BASE VERIFY] $ ${baseCmd}\n[exit ${br.code}]\n${br.stdout}${br.stderr}`);
      if (br.code !== 0) {
        ok = false;
        log.err(`基础验证失败，拒绝将 ${f.id} 升为 passing`);
        log.err(`请先修复: ${baseCmd}`);
      } else {
        log.ok(`基础验证通过`);
      }
    }

    // 3) 证据落盘到 sprint evidence
    if (sprintId) {
      const ev = join(sprintDir(phaseId, sprintId), "evidence", `${f.id}.verify.log`);
      writeFileSync(ev, logs.join("\n\n"), "utf8");
    }

    if (ok) {
      f.status = "passing";
      f.evidence = sprintId
        ? `evidence/${f.id}.verify.log @ ${new Date().toISOString()}`
        : new Date().toISOString();
      promoted++;
      log.ok(`门控通过 -> ${f.id} = passing`);
    } else {
      if (f.status === "not_started") f.status = "in_progress";
      failed++;
    }
  }

  saveFeatureList(phaseId, fl);
  if (sprintId) writeActiveFeatures(phaseId, sprintId, fl);
  refreshProgress();
  log.info(`完成：${promoted} 个升级为 passing，${failed} 个未通过。`);
  if (failed) process.exitCode = 1;
}
