import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { phaseFeatureListPath, sprintDir } from "./paths";
import type { Feature, FeatureList, FeatureStatus } from "./types";

export function loadFeatureList(phaseId: string): FeatureList {
  const p = phaseFeatureListPath(phaseId);
  const fl = JSON.parse(readFileSync(p, "utf8")) as FeatureList;
  if (!Array.isArray(fl.features)) throw new Error(`feature_list 结构非法: ${p}`);
  return fl;
}

export function saveFeatureList(phaseId: string, fl: FeatureList): void {
  writeFileSync(phaseFeatureListPath(phaseId), JSON.stringify(fl, null, 2) + "\n", "utf8");
}

export function featuresForSprint(fl: FeatureList, sprintId: string): Feature[] {
  return fl.features
    .filter((f) => f.sprint === sprintId)
    .sort((a, b) => a.priority - b.priority);
}

/** 单一来源原则：同一 owner 同时最多一个 in_progress
 *  - 无 owner（null）：全局只能有一个 in_progress（单 agent 模式，兼容旧行为）
 *  - 有 owner：每个 owner 各自最多一个 in_progress（多 agent 并行模式）
 */
export function assertSingleInProgress(fl: FeatureList): void {
  const active = fl.features.filter((f) => f.status === "in_progress");
  // 分两类：有 owner 的（多 agent 模式）和无 owner 的（单 agent 模式）
  const unowned = active.filter((f) => !f.owner);
  const owned = active.filter((f) => !!f.owner);

  // 无 owner 的最多只能有 1 个（兼容单 agent 旧行为）
  if (unowned.length > 1) {
    throw new Error(
      `违反单一 in_progress 不变量，当前有 ${unowned.length} 个无 owner 的 in_progress：` +
        unowned.map((f) => f.id).join(", ")
    );
  }

  // 有 owner 的：按 owner 分组，每组最多 1 个
  const byOwner = new Map<string, string[]>();
  for (const f of owned) {
    const list = byOwner.get(f.owner!) ?? [];
    list.push(f.id);
    byOwner.set(f.owner!, list);
  }
  for (const [owner, ids] of byOwner) {
    if (ids.length > 1) {
      throw new Error(
        `违反单一 in_progress 不变量：owner "${owner}" 有 ${ids.length} 个 in_progress：${ids.join(", ")}`
      );
    }
  }
}

/** 把 sprint 的工作集派生成只读视图(绝不手改) */
export function writeActiveFeatures(phaseId: string, sprintId: string, fl: FeatureList): string {
  const features = featuresForSprint(fl, sprintId);
  const view = {
    phase: phaseId,
    sprint: sprintId,
    generated_at: new Date().toISOString(),
    source: `phases/phase-${phaseId}-*/feature_list.json`,
    note: "派生视图,只读。修改归属请改阶段 feature_list.json 的 sprint 字段后重新生成。",
    features,
  };
  const out = join(sprintDir(phaseId, sprintId), "active-features.json");
  writeFileSync(out, JSON.stringify(view, null, 2) + "\n", "utf8");
  return out;
}

export type Counts = Record<FeatureStatus, number>;

export function countByStatus(features: Feature[]): Counts {
  const c: Counts = { not_started: 0, in_progress: 0, blocked: 0, passing: 0 };
  for (const f of features) c[f.status]++;
  return c;
}

/** 是否所有引用的 feature 都已 passing */
export function allPassing(features: Feature[]): boolean {
  return features.length > 0 && features.every((f) => f.status === "passing");
}

export function findFeature(fl: FeatureList, id: string): Feature {
  const f = fl.features.find((x) => x.id === id);
  if (!f) throw new Error(`找不到 feature ${id}`);
  return f;
}
