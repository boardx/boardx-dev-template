// packages/data/src/index.ts — CAP-DATA Postgres 访问层
// 原则：schema 只经 migrations 改；app 不散写 SQL，统一走本层的仓储函数。
// 显式 pg + SQL（不用 ORM），保持透明，便于后续接 pgvector / Apache AGE。

import pg from "pg";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const { Pool } = pg;

// CAP-AUTH 仓储（users/sessions/email_tokens）
export * from "./auth";
// CAP-AUTH 团队仓储（teams/team_members/team_invites）
export * from "./teams";
// CAP-COLLAB 房间仓储（rooms/room_members）
export * from "./rooms";
// CAP-CANVAS 板 item 仓储（board_items）
export * from "./items";
// CAP-DATA 白板容器仓储（boards / P5）
export * from "./board";
// CAP-DATA 房间聊天线程仓储（room_chats / P4）
export * from "./roomChat";
// CAP-AUTH 账号资料与偏好（profile / user_settings）
export * from "./profile";
// CAP-WEB 用户反馈提交记录
export * from "./feedback";
// CAP-DATA 问卷仓储（surveys / survey_questions / survey_responses / P13 F01）
export * from "./survey";
// CAP-AI AVA 聊天线程与消息仓储（ava_threads/ava_messages / P9 F01）
export * from "./avaChat";
// CAP-DATA AI Store 商品仓储（ai_store_items / P11）
export * from "./aiStore";
// CAP-DATA 积分钱包仓储（credit_wallets/credit_transactions / P14 uc-credits-001）
export * from "./credits";
// CAP-FILE 知识库文件仓储（kb_files / P10）
export * from "./kbFiles";
// CAP-PAYMENT 支付订单仓储（payment_orders / F05）
export * from "./payment";
// P15 Admin 后台：平台统计聚合（用户/团队计数；仅已建表的真实维度）
export * from "./admin";

// ─── 连接配置（纯函数，可单测）──────────────────────────────────────────────

export interface DbConfig {
  connectionString: string;
}

function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function findWorkspaceRoot(start: string): string {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
}

function loadDbEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const root = findWorkspaceRoot(process.cwd());
  const fileEnv = {
    ...parseEnvFile(join(root, ".env")),
    ...parseEnvFile(join(root, "apps/web/.env.local")),
  };
  return { ...fileEnv, ...env };
}

/** 从环境变量解析连接串。优先 DATABASE_URL，否则用 PG* 拼。 */
export function resolveDbConfig(env: NodeJS.ProcessEnv = process.env): DbConfig {
  const mergedEnv = env === process.env ? loadDbEnv(env) : env;
  if (mergedEnv.DATABASE_URL) return { connectionString: mergedEnv.DATABASE_URL };
  const host = mergedEnv.PGHOST ?? "localhost";
  const port = mergedEnv.PGPORT ?? mergedEnv.PG_PORT ?? "5432";
  const user = mergedEnv.PGUSER ?? "boardx";
  const password = mergedEnv.PGPASSWORD ?? "boardx";
  const database = mergedEnv.PGDATABASE ?? "boardx";
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
