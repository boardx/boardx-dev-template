// phase-id:phase 编号分配的唯一权威逻辑(issue #660,4 次撞号后收口)。
// 权威载体 = roadmap.yaml:new-phase 取号即写回(占号即登记),后到的在飞分支
// 在 rebase/merge roadmap.yaml 时自然看见冲突,不再各自挑号静默相撞。
//
// 纯函数,不碰文件系统 —— 便于单测(取号 / 冲突检测)。

/**
 * 提取 phase id 的数字部分:"p30" → 30,"04" → 4,"01" → 1。
 * 不含数字的非法 id 返回 null(调用方决定忽略还是报错)。
 */
export function phaseIdNumber(id: string): number | null {
  const m = /^p?(\d+)$/.exec(id.trim());
  if (!m) return null;
  return Number.parseInt(m[1]!, 10);
}

/**
 * 自动取号:roadmap 现有 id 数字部分的 max + 1,统一 "pN" 前缀
 * (2026-06-30 编号约定:新 phase 一律 pN;"01"/"04" 是历史遗留)。
 */
export function nextPhaseId(existingIds: string[]): string {
  let max = 0;
  for (const id of existingIds) {
    const n = phaseIdNumber(id);
    if (n !== null && n > max) max = n;
  }
  return `p${max + 1}`;
}

/**
 * 显式 --id 的冲突检测。返回冲突描述列表(空 = 无冲突):
 * - roadmap.yaml 已有同 id 条目(占号已登记,含在飞分支合入的);
 * - phases/ 下已有 phase-<id>-* 目录(历史上未登记 roadmap 的目录也算占用)。
 */
export function findPhaseIdConflicts(
  id: string,
  roadmapIds: string[],
  phaseDirNames: string[]
): string[] {
  const conflicts: string[] = [];
  if (roadmapIds.includes(id)) {
    conflicts.push(`roadmap.yaml 已有 id "${id}" 的条目`);
  }
  const dirPrefix = `phase-${id}-`;
  for (const dir of phaseDirNames) {
    if (dir.startsWith(dirPrefix)) conflicts.push(`phases/${dir} 目录已存在`);
  }
  return conflicts;
}
