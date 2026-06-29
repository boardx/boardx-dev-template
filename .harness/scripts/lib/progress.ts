import { writeFileSync, existsSync } from "node:fs";
import { PROGRESS_PATH } from "./paths";
import { loadRoadmap } from "./roadmap";
import { loadFeatureList, countByStatus } from "./features";

export function refreshProgress(): void {
  const rm = loadRoadmap();
  const rows: string[] = [];
  for (const p of rm.phases) {
    let c = { not_started: 0, in_progress: 0, blocked: 0, passing: 0 };
    try {
      const fl = loadFeatureList(p.id);
      c = countByStatus(fl.features);
    } catch {
      /* 阶段目录或清单尚未生成,留空 */
    }
    rows.push(
      `| ${p.id} | ${p.name} | ${p.status} | ${c.not_started} | ${c.in_progress} | ${c.blocked} | ${c.passing} |`
    );
  }
  const md = [
    "# 项目总进度(自动聚合)",
    "",
    "> 本文件由 harness 脚本在变更后聚合刷新。手改会被覆盖。",
    "",
    "| Phase | 名称 | 状态 | not_started | in_progress | blocked | passing |",
    "|-------|------|------|-------------|-------------|---------|---------|",
    ...rows,
    "",
    `_最近聚合:${new Date().toISOString()}_`,
    "",
  ].join("\n");
  writeFileSync(PROGRESS_PATH, md, "utf8");
}
