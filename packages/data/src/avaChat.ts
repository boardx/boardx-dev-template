// packages/data/src/avaChat.ts — CAP-DATA AVA 聊天仓储（ava_threads / ava_messages，P9 F01）
import { randomBytes } from "node:crypto";
import { query } from "./index";

export interface AvaThread {
  id: number;
  team_id: number | null;
  user_id: number;
  title: string;
  share_token?: string | null;
  share_enabled?: boolean;
  share_updated_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type AvaMessageRole = "user" | "assistant";
export type AvaMessageStatus = "complete" | "failed";

export interface AvaMessage {
  id: number;
  thread_id: number;
  role: AvaMessageRole;
  content: string;
  status: AvaMessageStatus;
  created_at: string;
}

export const DEFAULT_AVA_THREAD_TITLE = "New chat";

/** 由首条用户消息派生线程标题（纯函数，可单测）。空/纯空白回退默认标题。 */
export function titleFromMessage(text: string): string {
  const t = (text ?? "").trim().replace(/\s+/g, " ");
  if (!t) return DEFAULT_AVA_THREAD_TITLE;
  return t.length > 60 ? `${t.slice(0, 60)}…` : t;
}

export async function createAvaThread(
  userId: number,
  teamId: number | null,
  title: string
): Promise<AvaThread> {
  const rows = await query<AvaThread>(
    `INSERT INTO ava_threads (team_id, user_id, title)
     VALUES ($1, $2, $3)
     RETURNING id, team_id, user_id, title, created_at, updated_at`,
    [teamId, userId, title]
  );
  return rows[0]!;
}

export async function getAvaThread(threadId: number): Promise<AvaThread | undefined> {
  const rows = await query<AvaThread>(
    `SELECT id, team_id, user_id, title, created_at, updated_at FROM ava_threads WHERE id = $1`,
    [threadId]
  );
  return rows[0];
}

/** 当前用户在当前团队上下文下可访问的线程，最近更新在前。
 *  teamId 为 null 时列出该用户 team_id 为 null 的个人线程。 */
export async function listAvaThreads(userId: number, teamId: number | null): Promise<AvaThread[]> {
  if (teamId == null) {
    return query<AvaThread>(
      `SELECT id, team_id, user_id, title, created_at, updated_at
       FROM ava_threads WHERE user_id = $1 AND team_id IS NULL
       ORDER BY updated_at DESC, id DESC`,
      [userId]
    );
  }
  return query<AvaThread>(
    `SELECT id, team_id, user_id, title, created_at, updated_at
     FROM ava_threads WHERE user_id = $1 AND team_id = $2
     ORDER BY updated_at DESC, id DESC`,
    [userId, teamId]
  );
}

export async function touchAvaThread(threadId: number): Promise<void> {
  await query(`UPDATE ava_threads SET updated_at = now() WHERE id = $1`, [threadId]);
}

export async function renameAvaThreadIfDefault(threadId: number, title: string): Promise<void> {
  await query(
    `UPDATE ava_threads SET title = $2 WHERE id = $1 AND title = $3`,
    [threadId, title, DEFAULT_AVA_THREAD_TITLE]
  );
}

export async function listAvaMessages(threadId: number): Promise<AvaMessage[]> {
  return query<AvaMessage>(
    `SELECT id, thread_id, role, content, status, created_at
     FROM ava_messages WHERE thread_id = $1 ORDER BY id ASC`,
    [threadId]
  );
}

export async function insertAvaMessage(
  threadId: number,
  role: AvaMessageRole,
  content: string,
  status: AvaMessageStatus = "complete"
): Promise<AvaMessage> {
  const rows = await query<AvaMessage>(
    `INSERT INTO ava_messages (thread_id, role, content, status)
     VALUES ($1, $2, $3, $4)
     RETURNING id, thread_id, role, content, status, created_at`,
    [threadId, role, content, status]
  );
  return rows[0]!;
}

export async function updateAvaMessage(
  messageId: number,
  content: string,
  status: AvaMessageStatus
): Promise<void> {
  await query(`UPDATE ava_messages SET content = $2, status = $3 WHERE id = $1`, [
    messageId,
    content,
    status,
  ]);
}

export interface AvaThreadShare {
  thread_id: number;
  share_token: string;
  share_enabled: boolean;
  share_updated_at: string;
}

export interface SharedAvaThread {
  id: number;
  title: string;
  messages: AvaMessage[];
}

export function newAvaShareToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function getAvaThreadShare(threadId: number): Promise<AvaThreadShare | undefined> {
  const rows = await query<AvaThreadShare>(
    `SELECT id AS thread_id, share_token, share_enabled, share_updated_at
     FROM ava_threads
     WHERE id = $1 AND share_token IS NOT NULL`,
    [threadId]
  );
  return rows[0];
}

export async function enableAvaThreadShare(threadId: number): Promise<AvaThreadShare> {
  const existing = await getAvaThreadShare(threadId);
  const token = existing?.share_enabled && existing.share_token ? existing.share_token : newAvaShareToken();
  const rows = await query<AvaThreadShare>(
    `UPDATE ava_threads
     SET share_token = $2, share_enabled = true, share_updated_at = now()
     WHERE id = $1
     RETURNING id AS thread_id, share_token, share_enabled, share_updated_at`,
    [threadId, token]
  );
  return rows[0]!;
}

export async function disableAvaThreadShare(threadId: number): Promise<AvaThreadShare | undefined> {
  const rows = await query<AvaThreadShare>(
    `UPDATE ava_threads
     SET share_enabled = false, share_updated_at = now()
     WHERE id = $1 AND share_token IS NOT NULL
     RETURNING id AS thread_id, share_token, share_enabled, share_updated_at`,
    [threadId]
  );
  return rows[0];
}

export async function getSharedAvaThread(
  threadId: number,
  shareToken: string
): Promise<SharedAvaThread | undefined> {
  const threadRows = await query<{ id: number; title: string }>(
    `SELECT id, title
     FROM ava_threads
     WHERE id = $1 AND share_token = $2 AND share_enabled = true`,
    [threadId, shareToken]
  );
  const thread = threadRows[0];
  if (!thread) return undefined;
  const messages = await listAvaMessages(threadId);
  return { ...thread, messages };
}
