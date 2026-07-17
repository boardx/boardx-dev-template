import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parse } from "yaml";
import { ROADMAP_PATH } from "./paths";
import type { Roadmap, RoadmapPhase } from "./types";

const DEFAULT_HEADER = [
  "# roadmap.yaml — 所有阶段(phase=项目)的单一来源",
  "# new-phase 脚本读写本文件;每个阶段会在 phases/ 下 scaffold 一个目录。",
].join("\n");

export function loadRoadmap(): Roadmap {
  const data = parse(readFileSync(ROADMAP_PATH, "utf8")) as Roadmap;
  if (!data || !Array.isArray(data.phases)) throw new Error("roadmap.yaml 结构非法");
  for (const p of data.phases) if (!Array.isArray(p.depends_on)) p.depends_on = [];
  return data;
}

/**
 * 读现有文件里 "project:" 行之前的全部注释块，原样保留。
 * 这段可能是人工写的重要上下文（编号约定/依赖映射说明等），不能被 saveRoadmap
 * 每次调用都用固定两行覆盖掉——这是一个真实发生过的数据丢失 bug（见 commit 历史）。
 */
function readExistingHeader(): string {
  if (!existsSync(ROADMAP_PATH)) return DEFAULT_HEADER;
  const raw = readFileSync(ROADMAP_PATH, "utf8");
  const idx = raw.indexOf("\nproject:");
  if (idx === -1) return DEFAULT_HEADER;
  const header = raw.slice(0, idx).trimEnd();
  return header.length > 0 ? header : DEFAULT_HEADER;
}

export function renderRoadmapPhase(p: RoadmapPhase): string {
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
  if (p.tracking_issue != null) {
    lines.push(`    tracking_issue: ${p.tracking_issue}`);
  }
  return lines.join("\n");
}

export function saveRoadmap(r: Roadmap): void {
  const header = readExistingHeader();
  const head = [header, `project: ${r.project}`, "phases:"].join("\n");
  const body = r.phases.map(renderRoadmapPhase).join("\n");
  writeFileSync(ROADMAP_PATH, head + "\n" + body + "\n", "utf8");
}
