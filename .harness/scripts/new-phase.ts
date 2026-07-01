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
  const hasUi = args.flags["ui"] === true; // --ui：本阶段有界面，走 UI 先行确认关卡（ADR-003）
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
      ...(hasUi ? { has_ui: true } : {}),
    } as RoadmapPhase;
    rm.phases.push(phase);
    saveRoadmap(rm);
    log.ok(`已把 Phase ${id} 写入 roadmap.yaml${hasUi ? "（has_ui:true）" : ""}`);
  } else {
    if (hasUi && !phase.has_ui) {
      phase.has_ui = true;
      saveRoadmap(rm);
      log.ok(`已把 Phase ${id} 标记为 has_ui:true`);
    } else {
      log.info(`Phase ${id} 已在 roadmap 中,沿用其定义`);
    }
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

  // 原始需求入口是一个【文件夹】：可按领域放多份（auth.md / teams.md / rooms.md…），
  // requirement-author 智能体读取其中全部 *.md → 生成 feature_list.json。
  const reqDir = join(dir, "requirements");
  mkdirSync(reqDir, { recursive: true });
  writeFileSync(
    join(reqDir, "README.md"),
    render(
      [
        `# 原始需求 — {{PHASE_NAME}}（Phase {{PHASE_ID}}）`,
        ``,
        `> 这个**文件夹**是本阶段原始需求的家。按领域放多份 \`*.md\`（如 \`auth.md\`、\`teams.md\`、\`rooms.md\`），`,
        `> 每份用大白话/用户故事写即可。\`00-overview.md\` 是起始模板，可改名/拆分。`,
        ``,
        `## 流水线`,
        `1. 往本文件夹写一份或多份原始需求 \`*.md\`。`,
        `2. 调 **requirement-author** 智能体：读取本文件夹**全部** \`*.md\` → 生成/更新 \`../feature_list.json\`。`,
        `3. 本文件夹是**输入/上下文，不是权威**；权威永远是 \`../feature_list.json\`（带可执行 \`verification\`）。`,
        ``,
      ].join("\n"),
      vars
    )
  );
  writeFileSync(join(reqDir, "00-overview.md"), renderTemplateFile("requirements.template.md", vars));

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

  // UI 相关阶段（--ui）：scaffold UI 先行确认关卡产物（ADR-003）。
  if (hasUi) {
    mkdirSync(join(dir, "ui-preview"), { recursive: true });
    writeFileSync(join(dir, "ui-preview", ".gitkeep"), "");
    writeFileSync(join(dir, "ui-signoff.md"), renderTemplateFile("ui-signoff.template.md", vars));
  }

  refreshProgress();
  log.ok(`已 scaffold 阶段: ${dir}`);
  log.info(`下一步（推荐流水线）：`);
  log.info(`  1. 把原始需求写进 ${join(dir, "requirements")}/（可按领域放多份 *.md）`);
  if (hasUi) {
    log.info(`  2. 【UI 先行】做真实 UI（apps/web + mock，套用 uiux-standards），截图存 ${join(dir, "ui-preview")}/`);
    log.info(`  3. 填 ${join(dir, "ui-signoff.md")} → 人类工程师核对 → 把 status 改为 confirmed`);
    log.info(`  4. 调 requirement-author 智能体：读需求 + 已确认 UI → 生成 feature_list.json`);
    log.info(`  5. pnpm harness new-sprint --phase ${id} --id 01 ...（UI 未 confirmed 会被门控拒绝）`);
  } else {
    log.info(`  2. 调 requirement-author 智能体：读该文件夹全部 *.md → 生成 feature_list.json`);
    log.info(`  3. pnpm harness new-sprint --phase ${id} --id 01 --features F01,F02 ...`);
  }
}
