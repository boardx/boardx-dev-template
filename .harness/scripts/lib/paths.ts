import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { readdirSync, existsSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url)); // .harness/scripts/lib
export const REPO_ROOT = resolve(here, "..", "..", "..");

export const HARNESS_DIR = join(REPO_ROOT, ".harness");
export const PHASES_DIR = join(REPO_ROOT, "phases");
export const TEMPLATES_DIR = join(HARNESS_DIR, "templates");
export const STATE_DIR = join(HARNESS_DIR, "state");
export const ROADMAP_PATH = join(STATE_DIR, "roadmap.yaml");
export const PROGRESS_PATH = join(STATE_DIR, "PROGRESS.md");
export const COORDINATOR_LOCK_PATH = join(STATE_DIR, "coordinator-lock.json");
export const DEP_GRAPH_PATH = join(STATE_DIR, "dep-graph.md");
export const WORKTREES_DIR = join(REPO_ROOT, ".claude", "worktrees");

export function phaseDirName(id: string, slug: string): string {
  return `phase-${id}-${slug}`;
}

export function findPhaseDir(id: string): string {
  if (!existsSync(PHASES_DIR)) throw new Error(`找不到 phases 目录: ${PHASES_DIR}`);
  const match = readdirSync(PHASES_DIR).find((d) => d.startsWith(`phase-${id}-`));
  if (!match) throw new Error(`找不到 Phase ${id} 的目录(phases/phase-${id}-*)`);
  return join(PHASES_DIR, match);
}

export function phaseFeatureListPath(id: string): string {
  return join(findPhaseDir(id), "feature_list.json");
}

export function sprintDir(phaseId: string, sprintId: string): string {
  return join(findPhaseDir(phaseId), "sprints", `sprint-${sprintId}`);
}
