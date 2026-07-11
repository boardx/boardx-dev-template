import { describe, it, expect } from "vitest";
import { isNoTransaction, splitStatements } from "./migrateHelpers";

// #530 非事务迁移路径的纯函数守卫。真实迁移执行由 CD 的 migrate 步骤端到端验证。
describe("isNoTransaction", () => {
  it("首行指令命中", () => {
    expect(isNoTransaction("-- migrate:no-transaction\nCREATE INDEX ...;")).toBe(true);
  });
  it("前 5 行内命中（指令可跟在文件头注释后）", () => {
    expect(isNoTransaction("-- 说明\n-- migrate:no-transaction\nSELECT 1;")).toBe(true);
  });
  it("超出前 5 行不命中（防正文里的字面量误触发）", () => {
    expect(isNoTransaction("--1\n--2\n--3\n--4\n--5\n-- migrate:no-transaction")).toBe(false);
  });
  it("普通迁移不命中", () => {
    expect(isNoTransaction("-- 034_xxx\nALTER TABLE t ADD COLUMN c text;")).toBe(false);
  });
});

describe("splitStatements", () => {
  it("按行尾分号切分并剔除纯注释段", () => {
    const sql = [
      "-- migrate:no-transaction",
      "-- 注释",
      "CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS a ON t(x);",
      "",
      "CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS b ON t(y);",
    ].join("\n");
    const stmts = splitStatements(sql);
    expect(stmts).toHaveLength(1 + 1); // 两条语句（首段含指令注释+第一条语句）
    expect(stmts[0]).toContain("INDEX CONCURRENTLY IF NOT EXISTS a");
    expect(stmts[1]).toContain("INDEX CONCURRENTLY IF NOT EXISTS b");
  });
  it("034 真实文件切出两条语句", async () => {
    const { readFileSync } = await import("node:fs");
    const { join, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const sql = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "migrations", "034_public_id_concurrent_index.sql"),
      "utf8"
    );
    expect(isNoTransaction(sql)).toBe(true);
    const stmts = splitStatements(sql);
    expect(stmts).toHaveLength(2);
    for (const s of stmts) expect(s).toContain("CONCURRENTLY IF NOT EXISTS");
  });
});
