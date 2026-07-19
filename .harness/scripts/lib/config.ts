// config.ts — 加载并强类型化 harness.config.yaml
// 替代"配置是假文档"的问题：脚本运行时从此处取配置，改 yaml 立即生效。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { HARNESS_DIR } from "./paths";

export interface VerificationConfig {
  shell: string;
  fail_fast: boolean;
  require_base_pass: boolean;
  base_verify_cmd: string;
}

export interface GatesConfig {
  single_in_progress: boolean;
  passing_is_irreversible: boolean;
  evidence_required: boolean;
  /** claim/verify 门控 spec_ref（每个 feature 必须能追溯到 requirements/ 下的一个 story 章节）。 */
  spec_ref_required: boolean;
}

export interface QualityConfig {
  evaluator_rubric: string;
  quality_document: string;
}

export interface PathsConfig {
  phases_dir: string;
  roadmap: string;
  project_progress: string;
}

export interface HarnessConfig {
  version: number;
  paths: PathsConfig;
  feature_states: string[];
  verification: VerificationConfig;
  gates: GatesConfig;
  quality: QualityConfig;
}

let _cached: HarnessConfig | null = null;

export function loadHarnessConfig(): HarnessConfig {
  if (_cached) return _cached;
  const raw = readFileSync(join(HARNESS_DIR, "config", "harness.config.yaml"), "utf8");
  const cfg = parse(raw) as HarnessConfig;
  if (!cfg || typeof cfg.version !== "number") {
    throw new Error("harness.config.yaml 结构非法或缺失");
  }
  _cached = cfg;
  return cfg;
}
