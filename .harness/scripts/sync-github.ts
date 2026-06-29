// sync-github.ts — 单向投影。文件是事实来源，GitHub 只读。
// phase→Milestone, sprint→label, feature→Issue；只对当前/近期 sprint 开 Issue。
// 默认只打印计划（dry-run），加 --apply 才通过 gh CLI 执行（需先 gh auth login）。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { HARNESS_DIR } from "./lib/paths";
import { loadRoadmap } from "./lib/roadmap";
import { loadFeatureList, featuresForSprint } from "./lib/features";
import { sh } from "./lib/sh";
import { req } from "./lib/args";
import { log } from "./lib/log";
import type { Args } from "./lib/args";
import type { Feature } from "./lib/types";

interface StatusActions {
  close_issue?: boolean;
  add_label?: string;
}

interface SyncCfg {
  repo: string;
  issue_policy: { open_for: string; near_term_window: number };
  labels: { blocked: string; passing: string; area_prefix: string };
  status_actions: Record<string, StatusActions>;
}

function loadCfg(): SyncCfg {
  const raw = parse(readFileSync(join(HARNESS_DIR, "config", "github-sync.yaml"), "utf8")) as SyncCfg;
  return raw;
}

/** 通过 title 搜索 issue number（apply 模式下执行；dry-run 只打印意图） */
function findIssueNumber(repo: string, title: string, apply: boolean): number | null {
  if (!apply) return null; // dry-run 不实际查询
  // --state all：含已关闭 issue，否则幂等检查会漏掉 closed issue 而重复创建
  const r = sh(
    `gh issue list --repo ${JSON.stringify(repo)} --state all --search ${JSON.stringify(title)} --json number,title --limit 10`
  );
  if (r.code !== 0) return null;
  try {
    const items = JSON.parse(r.stdout) as Array<{ number: number; title: string }>;
    const match = items.find((i) => i.title === title);
    return match?.number ?? null;
  } catch {
    return null;
  }
}

export function syncGithub(args: Args): void {
  const phaseId = req(args, "phase");
  const apply = !!args.flags["apply"];
  const cfg = loadCfg();
  const rm = loadRoadmap();
  const phase = rm.phases.find((p) => p.id === phaseId);
  if (!phase) throw new Error(`roadmap 中找不到 Phase ${phaseId}`);
  const fl = loadFeatureList(phaseId);

  const plan: string[] = [];
  const run = (cmd: string, description?: string) => {
    plan.push(description ? `# ${description}\n${cmd}` : cmd);
    if (apply) {
      const r = sh(cmd);
      if (r.code !== 0) log.err(`gh 命令失败(${r.code}): ${cmd}\n${r.stderr}`);
      else log.ok(cmd);
    }
  };

  // 1) phase → milestone
  const milestone = `Phase ${phase.id}: ${phase.name}`;
  run(
    `gh api repos/${cfg.repo}/milestones -X POST -f title=${JSON.stringify(milestone)} ` +
      `-f state=open -f description=${JSON.stringify(phase.goal)} || true`,
    `创建 Milestone: ${milestone}`
  );

  // 2) 计算"当前/近期" sprint 集合
  const sprintIds = [
    ...new Set(fl.features.map((f) => f.sprint).filter((s): s is string => !!s)),
  ].sort();
  const nearTerm =
    cfg.issue_policy.open_for === "all"
      ? sprintIds
      : sprintIds.slice(0, Math.max(1, cfg.issue_policy.near_term_window));

  // 2.5) 先确保用到的 label 都存在——GitHub 不允许给 issue 加不存在的 label。
  //      收集近期 sprint 会用到的全部 label，逐个 gh label create --force（幂等）。
  const neededLabels = new Set<string>();
  for (const sid of nearTerm) {
    neededLabels.add(`sprint:${phaseId}-${sid}`);
    for (const f of featuresForSprint(fl, sid)) {
      neededLabels.add(`${cfg.labels.area_prefix}${f.area}`);
      const sa = cfg.status_actions?.[f.status];
      if (sa?.add_label) neededLabels.add(sa.add_label);
    }
  }
  for (const label of neededLabels) {
    run(
      `gh label create ${JSON.stringify(label)} --repo ${cfg.repo} --force`,
      `确保 label 存在: ${label}`
    );
  }

  // 3) 对近期 sprint 的 feature 开/更新 Issue
  for (const sid of nearTerm) {
    for (const f of featuresForSprint(fl, sid)) {
      const labels = [`sprint:${phaseId}-${sid}`, `${cfg.labels.area_prefix}${f.area}`];

      // 完整实现 status_actions（之前只处理了 blocked/passing）
      const statusAction: StatusActions = cfg.status_actions?.[f.status] ?? {};
      if (statusAction.add_label) labels.push(statusAction.add_label);

      const title = `[${f.id}] ${f.title}`;
      const body = [
        f.user_visible_behavior,
        "",
        "### 验证",
        ...f.verification.map((v) => `- [ ] \`${v}\``),
      ].join("\n");

      // owner → GitHub assignee（单向投影；owner 为 null 则不设 assignee）
      const assigneeArg = f.owner
        ? ` --assignee ${JSON.stringify(f.owner)}`
        : "";

      // 幂等：已存在同名 issue 则跳过创建（apply 模式才查询；避免重复开 issue）。
      const existing = findIssueNumber(cfg.repo, title, apply);
      if (apply && existing !== null) {
        log.info(`已存在 Issue #${existing}: ${title}，跳过创建`);
      } else {
        run(
          `gh issue create --repo ${cfg.repo} --title ${JSON.stringify(title)} ` +
            `--body ${JSON.stringify(body)} --label ${JSON.stringify(labels.join(","))} --milestone ${JSON.stringify(milestone)}${assigneeArg}`,
          `创建 Issue: ${title} [${f.status}]${f.owner ? ` @${f.owner}` : ""}`
        );
      }

      // 修复：gh issue close 使用 issue number，不是 title 字符串
      if (statusAction.close_issue) {
        const issueNum = findIssueNumber(cfg.repo, title, apply);
        if (apply && issueNum !== null) {
          run(
            `gh issue close --repo ${cfg.repo} ${issueNum}`,
            `关闭 Issue #${issueNum}: ${title}`
          );
        } else if (!apply) {
          // dry-run 时打印意图（无法预知 issue number）
          run(
            `gh issue close --repo ${cfg.repo} <issue-number-for: ${JSON.stringify(title)}>`,
            `关闭已 passing 的 Issue: ${title}`
          );
        } else {
          log.warn(`找不到 Issue number for "${title}"，跳过关闭`);
        }
      }
    }
  }

  log.info(`\n— 同步计划（${apply ? "已执行" : "dry-run，加 --apply 执行"}）—`);
  for (const c of plan) log.info(c);
  log.info(`\n共 ${plan.length} 条 gh 操作；近期 sprint: ${nearTerm.join(", ") || "(无)"}`);
}
