// doctor.ts — 审计链一致性体检（ADR-012）。
// 背景：p23 交付（PR #517）连续三轮被 Block，根因不是代码，而是审计链断裂——
// evidence 是裸时间戳、派生视图与 feature_list 矛盾、passing feature 挂在 sprint:null
// 上导致 --sprint 门控覆盖不到。这些断裂全部可以机器判定，却没有任何工具在 push 前
// 判定它们。本命令补上这个缺口：把"reviewer 逐字节人肉验"变成"一条命令跑完"。
//
// 用法：pnpm harness doctor [--phase NN]   （默认体检 roadmap 里的全部 phase）
// 退出码：有 FAIL = 1（供 pre-push hook / CI 门控用）；只有 WARN = 0。
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { findPhaseDir, sprintDir, PROGRESS_PATH, REPO_ROOT } from "./lib/paths";
import { loadFeatureList, countByStatus } from "./lib/features";
import { loadRoadmap } from "./lib/roadmap";
import { sh } from "./lib/sh";
import { log } from "./lib/log";
import type { Args } from "./lib/args";
import type { Feature } from "./lib/types";

interface Finding {
  level: "FAIL" | "WARN";
  phase: string;
  msg: string;
}

/** evidence 字段的合规形态：`evidence/<Fxx>.verify.log @ <ISO时间>`（verify --sprint 产出） */
const EVIDENCE_PATH_RE = /^evidence\/(F\d+)\.verify\.log @ /;
/** 裸 ISO 时间戳（--phase 模式的历史产物，ADR-012 起视为不合规证据） */
const BARE_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;

function checkPassingEvidence(phaseId: string, f: Feature, findings: Finding[]): void {
  if (!f.evidence) {
    findings.push({ level: "FAIL", phase: phaseId, msg: `${f.id} 是 passing 但 evidence 为空——"没有证据=没有完成"` });
    return;
  }
  if (BARE_TIMESTAMP_RE.test(f.evidence.trim())) {
    findings.push({
      level: "FAIL",
      phase: phaseId,
      msg: `${f.id} 的 evidence 是裸时间戳（"${f.evidence}"）——这是 verify --phase 模式的历史产物，不是证据。用 pnpm harness verify --sprint ${phaseId}/<sprint> --backfill-evidence 补真实日志`,
    });
    return;
  }
  if (!EVIDENCE_PATH_RE.test(f.evidence)) {
    // 非标准形态（早期阶段有 commit hash / 截图路径等），不判死，但提示统一
    findings.push({ level: "WARN", phase: phaseId, msg: `${f.id} 的 evidence 非标准形态（"${f.evidence.slice(0, 60)}"），无法机器校验` });
    return;
  }
  // 标准形态 → 文件必须真实存在、非空、且记录了成功退出码
  if (!f.sprint) {
    findings.push({
      level: "FAIL",
      phase: phaseId,
      msg: `${f.id} 是 passing 但 sprint 为 null——evidence 路径无法解析，且 --sprint 门控永远覆盖不到它。给它补 sprint 归属`,
    });
    return;
  }
  const logPath = join(sprintDir(phaseId, f.sprint), "evidence", `${f.id}.verify.log`);
  if (!existsSync(logPath)) {
    findings.push({ level: "FAIL", phase: phaseId, msg: `${f.id} 的 evidence 指向 ${logPath}，但文件不存在` });
    return;
  }
  const size = statSync(logPath).size;
  if (size === 0) {
    findings.push({ level: "FAIL", phase: phaseId, msg: `${f.id} 的 evidence 日志是 0 字节空文件（${logPath}）——空文件不是证据` });
    return;
  }
  const content = readFileSync(logPath, "utf8");
  if (!content.includes("[exit 0]")) {
    findings.push({ level: "FAIL", phase: phaseId, msg: `${f.id} 的 evidence 日志里没有任何 [exit 0] 记录（${logPath}）——日志存在但看不到成功执行` });
  }
  if (content.includes("[BACKFILL: 重跑未通过")) {
    findings.push({ level: "FAIL", phase: phaseId, msg: `${f.id} 的 evidence 标注了补跑未通过，需人工核实这条 passing 是否成立` });
  }
  // 磁盘上存在还不够：必须被 git 跟踪，否则本地体检通过、origin 上依然断链
  // （全仓 85 FAIL 的最大来源正是"verify 落盘了日志但从未 commit"）。
  const rel = relative(REPO_ROOT, logPath);
  if (sh(`git ls-files --error-unmatch "${rel}"`).code !== 0) {
    findings.push({ level: "FAIL", phase: phaseId, msg: `${f.id} 的 evidence 日志只在本地磁盘、未提交进 git（${rel}）——git add 它，否则 origin 上证据链是断的` });
  }
}

/** PROGRESS.md 的该 phase 行必须与 feature_list 实时计数一致（派生视图不许漂移） */
function checkProgressRow(phaseId: string, findings: Finding[]): void {
  if (!existsSync(PROGRESS_PATH)) return;
  const fl = loadFeatureList(phaseId);
  const c = countByStatus(fl.features);
  const row = readFileSync(PROGRESS_PATH, "utf8")
    .split("\n")
    .find((l) => l.startsWith(`| ${phaseId} `));
  if (!row) {
    findings.push({ level: "WARN", phase: phaseId, msg: `PROGRESS.md 里没有 ${phaseId} 行（新 phase 未聚合过？跑一次 verify/sync 即可）` });
    return;
  }
  // 行格式：| id | name | status | not_started | in_progress | blocked | passing |
  const cells = row.split("|").map((s) => s.trim());
  const [ns, ip, blk, pass] = cells.slice(4, 8).map((n) => Number(n));
  if (ns !== c.not_started || ip !== c.in_progress || blk !== c.blocked || pass !== c.passing) {
    findings.push({
      level: "FAIL",
      phase: phaseId,
      msg:
        `PROGRESS.md 与 feature_list 矛盾：PROGRESS 行 =（not_started ${ns} / in_progress ${ip} / blocked ${blk} / passing ${pass}），` +
        `feature_list 实际 =（${c.not_started} / ${c.in_progress} / ${c.blocked} / ${c.passing}）。` +
        `派生视图漂移 = verify 没走完整路径。跑 pnpm harness verify --sprint ${phaseId}/<sprint> 重新聚合`,
    });
  }
}

/** roadmap 阶段状态与实际进度的粗一致性（有 passing 却still not_started = 漂移） */
function checkRoadmapDrift(phaseId: string, findings: Finding[]): void {
  const rm = loadRoadmap();
  const p = rm.phases.find((x) => x.id === phaseId);
  if (!p) return;
  const c = countByStatus(loadFeatureList(phaseId).features);
  if (p.status === "not_started" && c.passing > 0) {
    findings.push({ level: "WARN", phase: phaseId, msg: `roadmap 标 not_started 但已有 ${c.passing} 个 passing——阶段状态漂移，对齐一下（惯例见 fb9307d）` });
  }
  if (p.status === "done" && c.passing < loadFeatureList(phaseId).features.length) {
    findings.push({ level: "WARN", phase: phaseId, msg: `roadmap 标 done 但并非全部 passing——检查是否早标了` });
  }
}

/** in_progress 却没有 owner，且同阶段存在有 owner 的并行开发 = 派发孤儿（p23 F04/F08 事故形态） */
function checkOrphanInProgress(phaseId: string, findings: Finding[]): void {
  const fl = loadFeatureList(phaseId);
  const active = fl.features.filter((f) => f.status === "in_progress");
  const orphans = active.filter((f) => !f.owner);
  if (orphans.length > 0 && active.some((f) => !!f.owner)) {
    findings.push({
      level: "WARN",
      phase: phaseId,
      msg: `多 agent 并行阶段存在无 owner 的 in_progress：${orphans.map((f) => f.id).join(", ")}——认领断档（claim 被 ADR-001 拒后没有回补），用 pnpm harness claim 补 owner`,
    });
  }
}

export function doctor(args: Args): void {
  const only = args.opts["phase"] ?? null;
  const rm = loadRoadmap();
  const phaseIds = (only ? [only] : rm.phases.map((p) => p.id)).filter((id) => {
    try {
      findPhaseDir(id);
      return true;
    } catch {
      return false; // roadmap 里已规划但还没 scaffold 的 phase，跳过
    }
  });

  const findings: Finding[] = [];
  for (const id of phaseIds) {
    let fl;
    try {
      fl = loadFeatureList(id);
    } catch {
      continue; // 没有 feature_list 的 phase（纯 requirements 期）不体检
    }
    for (const f of fl.features) {
      if (f.status === "passing") checkPassingEvidence(id, f, findings);
    }
    checkProgressRow(id, findings);
    checkRoadmapDrift(id, findings);
    checkOrphanInProgress(id, findings);
  }

  const fails = findings.filter((f) => f.level === "FAIL");
  const warns = findings.filter((f) => f.level === "WARN");
  for (const f of fails) log.err(`[${f.phase}] ${f.msg}`);
  for (const f of warns) log.info(`⚠ [${f.phase}] ${f.msg}`);
  log.info(`doctor：体检 ${phaseIds.length} 个 phase — ${fails.length} FAIL / ${warns.length} WARN`);
  if (fails.length) {
    log.err("审计链存在断裂。FAIL 项修复前不要开 PR / 交 review——reviewer 会用同样的标准 Block。");
    process.exitCode = 1;
  } else {
    log.ok("审计链完整：所有 passing 都有真实非空证据，派生视图与源一致。");
  }
}
