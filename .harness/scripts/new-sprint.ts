// new-sprint:在阶段下切一个 sprint;可用 --features 把若干 feature 分配进来,并派生 active-features.json
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { sprintDir, findPhaseDir } from "./lib/paths";
import { loadFeatureList, saveFeatureList, featuresForSprint, writeActiveFeatures, findFeature } from "./lib/features";
import { renderTemplateFile, nowISO } from "./lib/render";
import { parseArgs, req } from "./lib/args";
import { log, die } from "./lib/log";
import { assertUiSignedOff } from "./lib/ui-signoff";
import type { Args } from "./lib/args";

export function newSprint(args: Args): void {
  const phaseId = req(args, "phase");
  const sprintId = req(args, "id");
  const goal = args.opts["goal"] ?? "";

  findPhaseDir(phaseId); // 不存在则抛错

  // UI 先行确认关卡（ADR-003）：UI 相关阶段未经人类确认 UI，不得开 sprint 进入代码开发。
  try {
    assertUiSignedOff(phaseId);
  } catch (e) {
    die((e as Error).message);
  }
  const fl = loadFeatureList(phaseId);

  // 分配 feature 到本 sprint（改阶段权威清单的 sprint 字段）
  const assign = (args.opts["features"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  for (const fid of assign) {
    const f = findFeature(fl, fid);
    // 保护"passing 不可逆"语义：passing 的 feature 不能重新分配 sprint
    if (f.status === "passing") {
      log.warn(`${fid} 已是 passing，跳过 sprint 重新分配（passing 归属不可变）`);
      continue;
    }
    f.sprint = sprintId;
  }
  if (assign.length) saveFeatureList(phaseId, fl);

  const dir = sprintDir(phaseId, sprintId);
  if (existsSync(dir)) die(`sprint 目录已存在: ${dir}`);
  mkdirSync(join(dir, "evidence"), { recursive: true });

  const refs = featuresForSprint(fl, sprintId);
  const featureRefs = refs.length
    ? refs.map((f) => `- ${f.id} (P${f.priority}, ${f.area}) — ${f.title}`).join("\n")
    : "- (尚未分配 feature;用 --features F01,F02 分配,或改 feature_list.json 的 sprint 字段)";

  const vars: Record<string, string> = {
    PHASE_ID: phaseId,
    SPRINT_ID: sprintId,
    SPRINT_GOAL: goal,
    PHASE_SLUG: findPhaseDir(phaseId).split("/").pop()!.replace(`phase-${phaseId}-`, ""),
    CREATED_AT: nowISO(),
    FEATURE_REFS: featureRefs,
    SCOPE_LABEL: `Sprint ${phaseId}/${sprintId}`,
  };

  writeFileSync(join(dir, "sprint.md"), renderTemplateFile("sprint.template.md", vars));
  writeFileSync(join(dir, "progress.md"), renderTemplateFile("progress.template.md", vars));
  writeFileSync(join(dir, "session-handoff.md"), renderTemplateFile("session-handoff.template.md", vars));
  writeFileSync(join(dir, "evidence", ".gitkeep"), "");

  const view = writeActiveFeatures(phaseId, sprintId, fl);
  log.ok(`已 scaffold sprint: ${dir}`);
  log.ok(`已派生只读工作集: ${view}(${refs.length} 个 feature)`);
}
