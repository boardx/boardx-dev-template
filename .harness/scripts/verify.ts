// verify.ts — 逐条执行 feature.verification；全部通过 + base verify 通过才门控 passing。
// 这是"通过状态门控"的唯一实现。agent 不能自己改 passing。
// ADR-012 D5：只有 --sprint 模式能把 status 翻成 passing（证据落盘 + 派生视图刷新
// 与翻转原子绑定）；--phase/--feature 模式仅作调试观察，验证通过也不改 status。
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

  // --backfill-evidence：仅补写已 passing feature 的真实证据日志（重跑 verification 命令），
  // 绝不改动 status —— 用于修复"verify 曾在非 --sprint 模式下运行、从未落盘证据"的历史缺口。
  // 只在 --sprint 模式下开放，因为只有这条路径才会真的落盘日志文件；--phase 裸时间戳模式
  // 正是被修复的 bug 本身，不应继续被用来产出"证据"。
  const backfillEvidence = args.flags["backfill-evidence"] === true;
  if (backfillEvidence && !sprintId) die("--backfill-evidence 仅支持 --sprint 模式（需要落盘证据目录）");

  let promoted = 0, failed = 0;
  for (const f of targets) {
    if (f.status === "passing" && !backfillEvidence) {
      log.info(`${f.id} 已 passing，跳过（不可逆）`);
      continue;
    }
    const isBackfill = f.status === "passing" && backfillEvidence;
    log.step(`${isBackfill ? "补写证据" : "验证"} ${f.id} — ${f.title}`);
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

    if (isBackfill) {
      // 补写模式：不判 base verify，不动 status；只落真实日志 + 更新 evidence 指针。
      // 若重跑发现命令实际失败，如实记录，绝不悄悄抹平——status 仍保持 passing 不动，
      // 留给人工核实这条 passing 判定当初是否有效。
      const ev = join(sprintDir(phaseId, sprintId!), "evidence", `${f.id}.verify.log`);
      writeFileSync(ev, logs.join("\n\n"), "utf8");
      f.evidence = `evidence/${f.id}.verify.log @ ${new Date().toISOString()}${ok ? "" : " [BACKFILL: 重跑未通过，请人工核实]"}`;
      if (ok) log.ok(`${f.id} 补写证据完成，重跑通过`);
      else log.err(`${f.id} 补写时重跑未通过——status 不变，已在 evidence 中标注，需人工核实`);
      continue;
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
      if (!sprintId) {
        // ADR-012 D5：--phase 模式不落证据日志、不刷派生视图——曾产出"门控真实通过
        // 但审计链断裂"的假 passing（P23 事件，见 docs/postmortems/postmortem-p23-false-passing.md）。
        // 该模式保留为调试观察用途，翻转 passing 一律走 --sprint。
        log.info(`${f.id} 验证全部通过，但 --phase 模式不翻转 passing（无证据落盘）。`);
        log.info(`  正式门控请跑: pnpm harness verify --sprint ${phaseId}/<MM>`);
        continue;
      }
      f.status = "passing";
      f.evidence = `evidence/${f.id}.verify.log @ ${new Date().toISOString()}`;
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
  if (backfillEvidence) {
    log.info(`补写证据完成：共处理 ${targets.filter((f) => f.status === "passing").length} 个已 passing feature。`);
  } else {
    log.info(`完成：${promoted} 个升级为 passing，${failed} 个未通过。`);
  }
  if (failed) process.exitCode = 1;
}
