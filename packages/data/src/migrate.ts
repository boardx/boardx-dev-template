// packages/data/src/migrate.ts — 极简 SQL migrations runner
// 用法：pnpm --filter @repo/data run migrate
// 逐个执行 migrations/*.sql（按文件名排序），已执行的记录在 _migrations 表，幂等。

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getPool, closePool } from "./index";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

function isStartupError(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return (
    e.code === "57P03" ||
    e.code === "ECONNREFUSED" ||
    e.code === "ECONNRESET" ||
    e.message?.includes("Connection terminated unexpectedly") === true
  );
}

async function waitForDatabase(pool: ReturnType<typeof getPool>): Promise<void> {
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (err) {
      if (!isStartupError(err) || attempt === 20) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

function loadRootEnv(): void {
  let dir = process.cwd();
  while (dir !== dirname(dir)) {
    const workspace = join(dir, "pnpm-workspace.yaml");
    const envFile = join(dir, ".env");
    if (existsSync(workspace) && existsSync(envFile)) {
      const values = new Map<string, string>();
      for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const idx = trimmed.indexOf("=");
        if (idx <= 0) continue;
        const key = trimmed.slice(0, idx);
        const value = trimmed.slice(idx + 1);
        values.set(key, value);
      }
      for (const [key, value] of values) {
        if (process.env[key] === undefined) process.env[key] = value;
      }
      return;
    }
    dir = dirname(dir);
  }
}

async function run(): Promise<void> {
  loadRootEnv();
  const pool = getPool();
  await waitForDatabase(pool);
  await pool.query(
    "CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())"
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const applied = await pool.query("SELECT 1 FROM _migrations WHERE name = $1", [file]);
    if (applied.rowCount && applied.rowCount > 0) {
      console.log(`✓ 已应用，跳过：${file}`);
      continue;
    }
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    console.log(`→ 应用：${file}`);
    await pool.query("BEGIN");
    try {
      await pool.query(sql);
      await pool.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      await pool.query("COMMIT");
      console.log(`✓ 完成：${file}`);
    } catch (err) {
      await pool.query("ROLLBACK");
      throw err;
    }
  }
  console.log("迁移完成。");
}

run()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error("迁移失败：", err);
    await closePool();
    process.exit(1);
  });
