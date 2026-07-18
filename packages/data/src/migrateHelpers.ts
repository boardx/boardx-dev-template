// migrateHelpers.ts — migrate.ts 的纯函数（独立成模块以便单测：migrate.ts 顶层
// 会直接执行迁移，测试不能 import 它）。语义与约束见 migrate.ts 头注释（#530）。

const NO_TX_DIRECTIVE = "-- migrate:no-transaction";

/** 文件头部（前 5 行内）声明 no-transaction 指令即走非事务路径。 */
export function isNoTransaction(sql: string): boolean {
  return sql.split(/\r?\n/, 5).some((line) => line.trim() === NO_TX_DIRECTIVE);
}

/** 按"行尾分号"切分简单语句；剔除纯注释/空白段。
 *  约束：不支持 DO $$…$$ 等含内嵌分号的块——非事务迁移只允许简单幂等语句。 */
export function splitStatements(sql: string): string[] {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.split(/\r?\n/).every((l) => l.trim() === "" || l.trim().startsWith("--")));
}
