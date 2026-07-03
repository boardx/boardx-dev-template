// sweep-worktrees.ts — 巡检 .claude/worktrees/ 下有未提交改动的 worker worktree。
// 修的是这个漏洞：worker session 被打断（额度耗尽/被停止）后，工作留在本地没有
// commit/push/开 PR，且完成通知只显示 "stopped" 无 completion record —— 过去全靠人工
// 偶然去翻 worktree 才发现。coordinator 每次唤醒应先跑这个，而不是等人工发现。
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { WORKTREES_DIR } from "./lib/paths";
import { sh } from "./lib/sh";
import { log } from "./lib/log";
import type { Args } from "./lib/args";

interface WorktreeStatus {
  name: string;
  branch: string;
  changedFiles: number;
  lastEditMinutesAgo: number | null;
}

function maxMtimeMinutesAgo(dir: string, changedPaths: string[]): number | null {
  let latest = 0;
  for (const rel of changedPaths) {
    const p = join(dir, rel);
    try {
      const st = statSync(p);
      if (st.mtimeMs > latest) latest = st.mtimeMs;
    } catch {
      // 文件已删除等情况，跳过
    }
  }
  if (latest === 0) return null;
  return (Date.now() - latest) / 60000;
}

export function sweepWorktrees(args: Args): void {
  const thresholdMinutes = args.opts["threshold-minutes"] ? Number(args.opts["threshold-minutes"]) : 60;

  if (!existsSync(WORKTREES_DIR)) {
    log.info("没有 .claude/worktrees/ 目录，无需巡检。");
    return;
  }

  const entries = readdirSync(WORKTREES_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  if (entries.length === 0) {
    log.info("没有活跃的 worktree。");
    return;
  }

  const dirty: WorktreeStatus[] = [];

  for (const entry of entries) {
    const dir = join(WORKTREES_DIR, entry.name);
    const statusR = sh("git status --porcelain", dir);
    if (statusR.code !== 0) continue; // 不是有效 git worktree，跳过
    const lines = statusR.stdout.split("\n").filter(Boolean);
    if (lines.length === 0) continue; // 干净，跳过

    const changedPaths = lines.map((l) => l.slice(3).trim().replace(/^"|"$/g, ""));
    const branchR = sh("git branch --show-current", dir);
    const branch = branchR.stdout.trim() || "(detached)";
    const ageMin = maxMtimeMinutesAgo(dir, changedPaths);

    dirty.push({ name: entry.name, branch, changedFiles: lines.length, lastEditMinutesAgo: ageMin });
  }

  if (dirty.length === 0) {
    log.info(`巡检了 ${entries.length} 个 worktree，全部干净（无未提交改动）。`);
    return;
  }

  log.info(`发现 ${dirty.length} 个 worktree 有未提交改动：`);
  for (const d of dirty) {
    const ageStr = d.lastEditMinutesAgo == null ? "未知" : `${d.lastEditMinutesAgo.toFixed(0)} 分钟前`;
    const stale = d.lastEditMinutesAgo != null && d.lastEditMinutesAgo > thresholdMinutes;
    const flag = stale ? " ⚠ STALE — 建议 resume 该 agent 或人工检查" : "";
    log.info(`  - ${d.name}（branch=${d.branch}, ${d.changedFiles} 个文件改动, 最后编辑 ${ageStr}）${flag}`);
  }
  const staleCount = dirty.filter(
    (d) => d.lastEditMinutesAgo != null && d.lastEditMinutesAgo > thresholdMinutes
  ).length;
  if (staleCount > 0) {
    log.warn(`${staleCount} 个 worktree 超过 ${thresholdMinutes} 分钟无新编辑仍有未提交改动，建议逐个 resume 对应 agent 确认状态。`);
  }
}
