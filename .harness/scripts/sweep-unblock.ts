// sweep-unblock.ts — 扫描所有 phase 的 blocked feature，depends_on 全部 passing 就自动回填 not_started。
// 修的是这个漏洞：coordinator 的"新解锁"扫描要求 status != blocked，但从没有一步专门
// 把"依赖已解除的 blocked feature"转回 not_started —— 过去只能靠人工发现（见
// .harness/state/coordinator-loop-brief.md 教训记录）。这个脚本让这一步可重复、可自动跑。
import { loadRoadmap } from "./lib/roadmap";
import { loadFeatureList, saveFeatureList } from "./lib/features";
import { refreshProgress } from "./lib/progress";
import { log } from "./lib/log";
import type { Args } from "./lib/args";
import type { Feature, FeatureStatus } from "./lib/types";

interface Loaded {
  phaseId: string;
  fl: { phase: string; features: Feature[] };
}

function resolveKey(currentPhaseId: string, dep: string): string {
  return dep.includes(":") ? dep : `${currentPhaseId}:${dep}`;
}

export function sweepUnblock(args: Args): void {
  const dryRun = !!args.flags["dry-run"];
  const rm = loadRoadmap();

  const loaded: Loaded[] = [];
  const statusMap = new Map<string, FeatureStatus>();

  for (const p of rm.phases) {
    let fl;
    try {
      fl = loadFeatureList(p.id);
    } catch {
      continue; // 该 phase 还没 scaffold feature_list，跳过
    }
    loaded.push({ phaseId: p.id, fl });
    for (const f of fl.features) {
      statusMap.set(`${p.id}:${f.id}`, f.status);
    }
  }

  let unblocked = 0;
  const changes: string[] = [];

  for (const { phaseId, fl } of loaded) {
    let touched = false;
    for (const f of fl.features) {
      if (f.status !== "blocked") continue;
      const deps = f.depends_on ?? [];
      if (deps.length === 0) continue; // 无显式依赖的 blocked（比如 blocked-on 外部能力）不动，靠人工判断
      const allPassing = deps.every((d) => statusMap.get(resolveKey(phaseId, d)) === "passing");
      if (!allPassing) continue;

      changes.push(`${phaseId}:${f.id}（${f.title}）depends_on=[${deps.join(",")}] 全部 passing → blocked→not_started`);
      if (!dryRun) {
        f.status = "not_started";
        touched = true;
      }
      unblocked++;
    }
    if (touched) saveFeatureList(phaseId, fl);
  }

  if (changes.length === 0) {
    log.info("没有可解锁的 blocked feature。");
    return;
  }

  for (const c of changes) log.ok(c);

  if (dryRun) {
    log.info(`[dry-run] ${unblocked} 个 feature 符合解锁条件，未写入（去掉 --dry-run 才会真正写入）`);
    return;
  }

  refreshProgress();
  log.info(`完成：${unblocked} 个 feature 从 blocked 回填为 not_started。`);
}
