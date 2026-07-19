// claim.ts — agent 原子认领 feature
// pnpm harness claim --phase NN --feature F01 --owner claude
// 认领规则：feature 必须 not_started 且 owner=null，否则拒绝
// 认领后：owner=<agent-id>，status=in_progress（每个 owner 只能有一个 in_progress）

import { loadFeatureList, saveFeatureList, findFeature, writeActiveFeatures } from "./lib/features";
import { refreshProgress } from "./lib/progress";
import { loadHarnessConfig } from "./lib/config";
import { resolveSpecRef } from "./lib/spec-ref";
import { req } from "./lib/args";
import { log, die } from "./lib/log";
import type { Args } from "./lib/args";

export function claim(args: Args): void {
  const phaseId = req(args, "phase");
  const featureId = req(args, "feature");
  const owner = req(args, "owner");

  const fl = loadFeatureList(phaseId);
  const f = findFeature(fl, featureId);
  const cfg = loadHarnessConfig();

  // 保护 0：没有可追溯的 story（requirements/ 下的章节）不能开工（人类拍板 2026-07-19）。
  // 认领是"开始工作"的第一个机械动作，是堵住"无 story 就动手"最早也最便宜的地方。
  if (cfg.gates.spec_ref_required) {
    const r = resolveSpecRef(phaseId, f.spec_ref);
    if (!r.ok) {
      die(
        `${featureId} 不能认领：${r.reason}\n` +
          `  先在 phases/phase-${phaseId}-*/requirements/ 下补一份 story（用 .harness/templates/requirements.template.md），` +
          `再把 feature_list.json 里 ${featureId} 的 spec_ref 填成 "<文件名>.md#R<n>"。`
      );
    }
  }

  // 保护 1：不能认领已被他人持有的 feature
  if (f.owner !== null && f.owner !== owner) {
    die(`${featureId} 已被 ${f.owner} 认领，${owner} 无法抢占`);
  }

  // 保护 2：不能认领已 passing 的 feature
  if (f.status === "passing") {
    die(`${featureId} 已是 passing，不能重新认领`);
  }

  // 保护 3：同一 owner 同时只能有一个 in_progress
  const ownerInProgress = fl.features.filter(
    (x) => x.owner === owner && x.status === "in_progress" && x.id !== featureId
  );
  if (ownerInProgress.length > 0) {
    die(
      `${owner} 已有 in_progress 的 feature：${ownerInProgress.map((x) => x.id).join(", ")}。` +
        `同一 owner 同时只能认领一个 feature。`
    );
  }

  // 执行认领
  f.owner = owner;
  f.status = "in_progress";

  saveFeatureList(phaseId, fl);

  // 如果 feature 在某个 sprint，刷新 active-features 视图
  if (f.sprint) {
    writeActiveFeatures(phaseId, f.sprint, fl);
  }

  refreshProgress();
  log.ok(`${owner} 已认领 ${featureId}（${f.title}）`);
  log.info(`状态：in_progress | owner：${owner}`);
  log.info(`开始工作前请先读：pnpm harness verify --sprint ${phaseId}/${f.sprint ?? "?"} --feature ${featureId}`);
}
