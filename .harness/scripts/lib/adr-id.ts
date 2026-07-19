// adr-id.ts — ADR 编号分配的唯一权威逻辑（同 #660 phase-id 撞号收口的模式复用）。
// 根因与 phase-id 一致：docs/adr/README.md 里"新 ADR 编号从 ADR-NNN 起"这句话本身
// 只存在于已合入 main 的文本里，在飞分支彼此不可见——两个人各自读到同一句提示、
// 各自挑了同一个号，直到合并才发现撞车（ADR-018 真实撞过：#778 与 #730）。
//
// 权威载体 = docs/adr/README.md 的索引表：new-adr 取号即写回（占号即登记），
// 后到的在飞分支在 rebase/merge README.md 时自然看见冲突，不再各自挑号静默相撞。
//
// 纯函数，不碰文件系统 —— 便于单测（取号 / 冲突检测）。

/** 提取 ADR id 的数字部分："ADR-018" → 18。旧序列 "0001"/"0002" 不参与本编号
 *  空间（保留原名，历史遗留），本函数对它们返回 null。 */
export function adrIdNumber(id: string): number | null {
  const m = /^ADR-(\d+)$/.exec(id.trim());
  if (!m) return null;
  return Number.parseInt(m[1]!, 10);
}

/** 从文件名解析出 ADR id："ADR-020-atomic-adr-numbering.md" → "ADR-020"。
 *  不匹配（含旧序列 "0001-xxx.md"）返回 null。 */
export function adrIdFromFileName(fileName: string): string | null {
  const m = /^(ADR-\d+)-/.exec(fileName);
  return m ? m[1]! : null;
}

/**
 * 自动取号：现有 id 数字部分的 max + 1，3 位零填充（ADR-001 起的既有格式）。
 *
 * **必须同时传入索引表 id 和文件名解析出的 id**（README.md 索引表可能落后于
 * docs/adr/ 目录本身——"文件建了但索引表没登记"的孤儿文件，正是本模块要防的
 * 那类占用；只查索引表求 max 会在这种场景下把号取重，把自己变成新的孤儿文件）。
 * 调用方通常这样合并：
 *   nextAdrId([...indexedIds, ...adrFileNames.map(adrIdFromFileName).filter(Boolean)])
 */
export function nextAdrId(existingIds: string[]): string {
  let max = 0;
  for (const id of existingIds) {
    const n = adrIdNumber(id);
    if (n !== null && n > max) max = n;
  }
  return `ADR-${String(max + 1).padStart(3, "0")}`;
}

/**
 * 显式 --id 的冲突检测。返回冲突描述列表（空 = 无冲突）：
 * - README.md 索引表已有同 id 行（占号已登记，含在飞分支合入的）；
 * - docs/adr/ 下已有 <id>-*.md 文件（历史上未登记进索引表的文件也算占用）。
 */
export function findAdrIdConflicts(id: string, indexedIds: string[], adrFileNames: string[]): string[] {
  const conflicts: string[] = [];
  if (indexedIds.includes(id)) {
    conflicts.push(`docs/adr/README.md 索引表已有 "${id}" 的条目`);
  }
  const filePrefix = `${id}-`;
  for (const f of adrFileNames) {
    if (f.startsWith(filePrefix)) conflicts.push(`docs/adr/${f} 文件已存在`);
  }
  return conflicts;
}
