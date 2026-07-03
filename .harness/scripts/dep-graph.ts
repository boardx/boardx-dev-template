// dep-graph.ts — 从 feature_list.json 的 depends_on/wave/status 生成依赖图快照，写到
// .harness/state/dep-graph.md。取代 coordinator-loop-brief.md 里手写维护、反复过期的
// "依赖图备份"小节——那份文档多次被发现记的是几天前的状态（见教训记录），
// 而这里跟 PROGRESS.md 一样是脚本生成、每次跑都反映当下真实状态。
import { writeFileSync } from "node:fs";
import { loadRoadmap } from "./lib/roadmap";
import { loadFeatureList } from "./lib/features";
import { DEP_GRAPH_PATH } from "./lib/paths";
import { log } from "./lib/log";
import type { Args } from "./lib/args";
import type { Feature } from "./lib/types";

function resolveKey(currentPhaseId: string, dep: string): string {
  return dep.includes(":") ? dep : `${currentPhaseId}:${dep}`;
}

function fmtDeps(phaseId: string, f: Feature, statusMap: Map<string, string>): string {
  const deps = f.depends_on ?? [];
  if (deps.length === 0) return "[]";
  const parts = deps.map((d) => {
    const key = resolveKey(phaseId, d);
    const st = statusMap.get(key) ?? "?";
    return `${d}(${st})`;
  });
  return `[${parts.join(", ")}]`;
}

export function depGraph(_args: Args): void {
  const rm = loadRoadmap();
  const loaded: { phaseId: string; name: string; fl: { features: Feature[] } }[] = [];
  const statusMap = new Map<string, string>();

  for (const p of rm.phases) {
    let fl;
    try {
      fl = loadFeatureList(p.id);
    } catch {
      continue;
    }
    loaded.push({ phaseId: p.id, name: p.name, fl });
    for (const f of fl.features) statusMap.set(`${p.id}:${f.id}`, f.status);
  }

  const lines: string[] = [
    "# 依赖图快照(自动生成)",
    "",
    "> 本文件由 `pnpm harness dep-graph` 生成。手改会被覆盖。",
    "> 取代 coordinator-loop-brief.md 里手写的「依赖图备份」小节——每次唤醒先跑一遍本命令刷新，" +
      "别再手改那段 prose。",
    "",
  ];

  for (const { phaseId, name, fl } of loaded) {
    if (fl.features.length === 0) continue;
    lines.push(`## ${phaseId} (${name})`, "");
    lines.push("| Feature | 标题 | 状态 | owner | depends_on | wave |");
    lines.push("|---|---|---|---|---|---|");
    for (const f of fl.features.sort((a, b) => a.priority - b.priority)) {
      lines.push(
        `| ${f.id} | ${f.title} | ${f.status} | ${f.owner ?? "-"} | ${fmtDeps(phaseId, f, statusMap)} | ${f.wave ?? "-"} |`
      );
    }
    lines.push("");
  }

  lines.push(`_最近生成:${new Date().toISOString()}_`, "");

  writeFileSync(DEP_GRAPH_PATH, lines.join("\n"), "utf8");
  log.ok(`已写入 ${DEP_GRAPH_PATH}`);
}
