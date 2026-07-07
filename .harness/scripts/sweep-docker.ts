// sweep-docker.ts — 巡检并（可选）清理孤儿 docker compose 栈。
//
// 修的是这个漏洞：每个 worktree 通过 scripts/init-worktree-env.sh 起一套独占的
// postgres+redis+minio（见 parallel-dev-workflow.md §5），但 feature/PR 收尾后经常
// 忘了 `docker compose down`——worktree 目录被删了，docker 栈却继续跑，长期累积
// 成真实的 host 级资源耗尽（本仓库已实测复现：某次巡检时 20 个并发栈里 7 个是这类
// 孤儿，同一晚另一次验证因此撞上 postgres 反复 crash-loop 进恢复模式）。见 ADR-007。
//
// 用 `docker compose ls --format json` 的 ConfigFiles 字段拿到每个栈的原始
// compose 文件路径——这条路径的上一级目录就是当初起这个栈的 worktree 根目录。
// 如果这个目录已经不存在于磁盘上，说明 worktree 早就被删了但 docker 没跟着清理，
// 这是唯一权威、零歧义的孤儿判定（不猜测 PR 状态、不看 git 分支——那些即使显示
// "已合并"，worktree 本身仍可能因为其它合法原因还留着）。
//
// 默认只报告，不清理；加 --apply 才会真的 down 掉判定为孤儿的栈（同 harness sync
// 的 dry-run 默认 + --apply 执行的约定）。
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { sh } from "./lib/sh";
import { log } from "./lib/log";
import type { Args } from "./lib/args";

interface ComposeProject {
  Name: string;
  Status: string;
  ConfigFiles: string;
}

interface OrphanCandidate {
  name: string;
  status: string;
  worktreeDir: string;
}

function listComposeProjects(): ComposeProject[] {
  const result = sh("docker compose ls --format json");
  if (result.code !== 0) {
    throw new Error(`docker compose ls 失败：${result.stderr || result.stdout}`);
  }
  const trimmed = result.stdout.trim();
  if (!trimmed) return [];
  return JSON.parse(trimmed) as ComposeProject[];
}

export function sweepDocker(args: Args): void {
  const apply = !!args.flags["apply"];

  let projects: ComposeProject[];
  try {
    projects = listComposeProjects();
  } catch (e) {
    log.err((e as Error).message);
    return;
  }

  if (projects.length === 0) {
    log.info("没有正在运行的 docker compose 栈。");
    return;
  }

  const orphans: OrphanCandidate[] = [];
  const alive: string[] = [];

  for (const p of projects) {
    // ConfigFiles 形如 <worktree>/infra/docker-compose.yml
    const worktreeDir = dirname(dirname(p.ConfigFiles));
    if (existsSync(worktreeDir)) {
      alive.push(p.Name);
      continue;
    }
    orphans.push({ name: p.Name, status: p.Status, worktreeDir });
  }

  log.info(`巡检了 ${projects.length} 个 docker compose 栈：${alive.length} 个对应的 worktree 仍存在，${orphans.length} 个是孤儿。`);

  if (orphans.length === 0) {
    log.info("没有发现孤儿栈。");
    return;
  }

  for (const o of orphans) {
    log.info(`  ⚠ 孤儿：${o.name}（${o.status}）——原 worktree 已不存在：${o.worktreeDir}`);
  }

  if (!apply) {
    log.info(`加 --apply 实际清理这 ${orphans.length} 个孤儿栈（docker compose -p <name> down -v）。`);
    return;
  }

  log.info(`--apply：开始清理 ${orphans.length} 个孤儿栈...`);
  for (const o of orphans) {
    const result = sh(`docker compose -p ${JSON.stringify(o.name)} down -v`);
    if (result.code === 0) {
      log.ok(`已清理：${o.name}`);
    } else {
      log.err(`清理失败：${o.name} — ${result.stderr || result.stdout}`);
    }
  }
}
