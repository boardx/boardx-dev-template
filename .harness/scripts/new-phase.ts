// new-phase:从 roadmap scaffold 一个阶段目录(phase.md / AGENTS.md / feature_list.json / progress.md)
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PHASES_DIR, phaseDirName } from "./lib/paths";
import { loadRoadmap, saveRoadmap } from "./lib/roadmap";
import { renderTemplateFile, render, nowISO } from "./lib/render";
import { refreshProgress } from "./lib/progress";
import { parseArgs, req } from "./lib/args";
import { log, die } from "./lib/log";
import type { Args } from "./lib/args";
import type { RoadmapPhase } from "./lib/types";

export function newPhase(args: Args): void {
  const id = req(args, "id");
  const rm = loadRoadmap();
  let phase = rm.phases.find((p) => p.id === id);

  if (!phase) {
    const name = req(args, "name");
    phase = {
      id,
      slug: args.opts["slug"] ?? name.toLowerCase().replace(/\s+/g, "-"),
      name,
      goal: args.opts["goal"] ?? "",
      status: "not_started",
      depends_on: [],
    } as RoadmapPhase;
    rm.phases.push(phase);
    saveRoadmap(rm);
    log.ok(`已把 Phase ${id} 写入 roadmap.yaml`);
  } else {
    log.info(`Phase ${id} 已在 roadmap 中,沿用其定义`);
  }

  const dir = join(PHASES_DIR, phaseDirName(phase.id, phase.slug));
  if (existsSync(dir)) die(`阶段目录已存在: ${dir}`);
  mkdirSync(join(dir, "sprints"), { recursive: true });

  const vars: Record<string, string> = {
    PHASE_ID: phase.id,
    PHASE_NAME: phase.name,
    PHASE_SLUG: phase.slug,
    PHASE_GOAL: phase.goal,
    PHASE_STATUS: phase.status,
    CREATED_AT: nowISO(),
    SCOPE_LABEL: `Phase ${phase.id} ${phase.name}`,
  };

  writeFileSync(join(dir, "phase.md"), renderTemplateFile("phase.template.md", vars));
  writeFileSync(join(dir, "requirements.md"), renderTemplateFile("requirements.template.md", vars));
  writeFileSync(join(dir, "feature_list.json"), renderTemplateFile("feature_list.template.json", vars));
  writeFileSync(join(dir, "progress.md"), renderTemplateFile("progress.template.md", vars));
  writeFileSync(
    join(dir, "AGENTS.md"),
    render(
      [
        `# AGENTS.md — Phase {{PHASE_ID}} ({{PHASE_NAME}}) 局部指令`,
        ``,
        `> 阶段级 scoped 指令,补充根 AGENTS.md。只写本阶段特有的约束。`,
        ``,
        `## 本阶段焦点`,
        `{{PHASE_GOAL}}`,
        ``,
        `## 权威来源`,
        `- 功能清单:本目录 \`feature_list.json\`(本阶段唯一权威)。`,
        `- 进度:本目录 \`progress.md\`。`,
        ``,
        `## 规则继承`,
        `根 \`AGENTS.md\` 的所有硬约束在此继续生效(尤其"完成定义"与"干净收尾")。`,
        ``,
      ].join("\n"),
      vars
    )
  );

  refreshProgress();
  log.ok(`已 scaffold 阶段: ${dir}`);
  log.info(`下一步（推荐流水线）：`);
  log.info(`  1. 把原始需求写进 ${join(dir, "requirements.md")}`);
  log.info(`  2. 调 requirement-author 智能体：读 requirements.md → 生成 feature_list.json`);
  log.info(`  3. pnpm harness new-sprint --phase ${id} --id 01 --features F01,F02 ...`);
}
