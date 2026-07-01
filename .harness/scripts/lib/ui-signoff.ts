// UI 先行确认关卡（ADR-003）：UI 相关阶段（roadmap has_ui:true）必须先由人类确认
// ui-signoff.md（status: confirmed），才能开 sprint 进入代码开发。此模块提供门控读取与断言。
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { findPhaseDir } from "./paths";
import { loadRoadmap } from "./roadmap";

export const UI_SIGNOFF_FILE = "ui-signoff.md";

export type UiSignoffStatus = "pending" | "confirmed" | "missing";

/** 读 ui-signoff.md 顶部 frontmatter 的 status。文件不存在 → "missing"。 */
export function readUiSignoffStatus(phaseId: string): UiSignoffStatus {
  const path = join(findPhaseDir(phaseId), UI_SIGNOFF_FILE);
  if (!existsSync(path)) return "missing";
  const raw = readFileSync(path, "utf8");
  // 只在首个 --- ... --- frontmatter 块内找 status，避免正文里的 "status:" 误命中。
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const block = fm ? fm[1]! : "";
  const m = block.match(/^\s*status:\s*(\S+)/m);
  return m && m[1] === "confirmed" ? "confirmed" : "pending";
}

/** 本阶段是否被标记为有 UI（roadmap has_ui）。 */
export function phaseHasUi(phaseId: string): boolean {
  const rm = loadRoadmap();
  return Boolean(rm.phases.find((p) => p.id === phaseId)?.has_ui);
}

/**
 * 门控断言：若本阶段 has_ui 且 UI 未经人类确认，抛错阻断（由调用方 die 兜底）。
 * 非 UI 阶段（has_ui 缺省/false）直接放行。
 */
export function assertUiSignedOff(phaseId: string): void {
  if (!phaseHasUi(phaseId)) return; // 后端/逻辑阶段不受此关卡约束
  const status = readUiSignoffStatus(phaseId);
  if (status === "confirmed") return;
  const hint =
    status === "missing"
      ? `缺少 ${UI_SIGNOFF_FILE}（用 pnpm harness new-phase --ui 会自动 scaffold）`
      : `${UI_SIGNOFF_FILE} 的 status 仍是 pending`;
  throw new Error(
    `Phase ${phaseId} 是 UI 相关阶段，UI 未经人类确认，不能开 sprint 进入代码开发。\n` +
      `  原因：${hint}\n` +
      `  流程：先做真实 UI（apps/web + mock）→ 人类核对 → 把 phases/phase-${phaseId}-*/${UI_SIGNOFF_FILE} 的 status 改为 confirmed。见 ADR-003。`
  );
}
