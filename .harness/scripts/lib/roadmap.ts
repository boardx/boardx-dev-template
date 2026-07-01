import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "yaml";
import { ROADMAP_PATH } from "./paths";
import type { Roadmap, RoadmapPhase } from "./types";

export function loadRoadmap(): Roadmap {
  const data = parse(readFileSync(ROADMAP_PATH, "utf8")) as Roadmap;
  if (!data || !Array.isArray(data.phases)) throw new Error("roadmap.yaml 结构非法");
  for (const p of data.phases) if (!Array.isArray(p.depends_on)) p.depends_on = [];
  return data;
}

function dumpPhase(p: RoadmapPhase): string {
  const dep = p.depends_on.length ? `[${p.depends_on.map((d) => `"${d}"`).join(", ")}]` : "[]";
  const lines = [
    `  - id: "${p.id}"`,
    `    slug: ${p.slug}`,
    `    name: ${p.name}`,
    `    goal: "${p.goal.replace(/"/g, '\\"')}"`,
    `    status: ${p.status}`,
    `    depends_on: ${dep}`,
  ];
  // has_ui 仅在 true 时落盘（默认 false 的后端/逻辑阶段保持干净）。
  if (p.has_ui) lines.push(`    has_ui: true`);
  return lines.join("\n");
}

export function saveRoadmap(r: Roadmap): void {
  const head = [
    "# roadmap.yaml — 所有阶段(phase=项目)的单一来源",
    "# new-phase 脚本读写本文件;每个阶段会在 phases/ 下 scaffold 一个目录。",
    `project: ${r.project}`,
    "phases:",
  ].join("\n");
  const body = r.phases.map(dumpPhase).join("\n");
  writeFileSync(ROADMAP_PATH, head + "\n" + body + "\n", "utf8");
}
