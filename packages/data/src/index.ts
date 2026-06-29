// packages/data/src/index.ts — CAP-DATA Postgres 访问层
// 原则：schema 只经 migrations 改；app 不散写 SQL，统一走本层的仓储函数。
// 显式 pg + SQL（不用 ORM），保持透明，便于后续接 pgvector / Apache AGE。

import pg from "pg";

const { Pool } = pg;

// ─── 连接配置（纯函数，可单测）──────────────────────────────────────────────

export interface DbConfig {
  connectionString: string;
}

/** 从环境变量解析连接串。优先 DATABASE_URL，否则用 PG* 拼。 */
export function resolveDbConfig(env: NodeJS.ProcessEnv = process.env): DbConfig {
  if (env.DATABASE_URL) return { connectionString: env.DATABASE_URL };
  const host = env.PGHOST ?? "localhost";
  const port = env.PGPORT ?? "5432";
  const user = env.PGUSER ?? "boardx";
  const password = env.PGPASSWORD ?? "boardx";
  const database = env.PGDATABASE ?? "boardx";
  return {
    connectionString: `postgresql://${user}:${password}@${host}:${port}/${database}`,
  };
}

// ─── 连接池（单例）──────────────────────────────────────────────────────────

let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (!pool) pool = new Pool(resolveDbConfig());
  return pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await getPool().query<T>(sql, params as never[]);
  return res.rows;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

// ─── 仓储：notes（F02 / CAP-DATA）──────────────────────────────────────────

export interface Note {
  id: number;
  text: string;
  created_at: string;
}

export async function createNote(text: string): Promise<Note> {
  const rows = await query<Note>(
    "INSERT INTO notes (text) VALUES ($1) RETURNING id, text, created_at",
    [text]
  );
  return rows[0]!;
}

export async function listNotes(): Promise<Note[]> {
  return query<Note>("SELECT id, text, created_at FROM notes ORDER BY id DESC");
}

// ─── 仓储：jobs（F03 / CAP-WORKFLOW，状态由 worker 回写）──────────────────────

export type JobStatus = "queued" | "done" | "failed";

export interface Job {
  id: string;
  payload: string;
  status: JobStatus;
  updated_at: string;
}

export async function createJob(id: string, payload: string): Promise<Job> {
  const rows = await query<Job>(
    "INSERT INTO jobs (id, payload, status) VALUES ($1, $2, 'queued') RETURNING id, payload, status, updated_at",
    [id, payload]
  );
  return rows[0]!;
}

export async function getJob(id: string): Promise<Job | undefined> {
  const rows = await query<Job>(
    "SELECT id, payload, status, updated_at FROM jobs WHERE id = $1",
    [id]
  );
  return rows[0];
}

export async function setJobStatus(id: string, status: JobStatus): Promise<void> {
  await query("UPDATE jobs SET status = $2, updated_at = now() WHERE id = $1", [id, status]);
}
