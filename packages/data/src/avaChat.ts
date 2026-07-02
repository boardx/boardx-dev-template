// packages/data/src/avaChat.ts — CAP-DATA AVA 聊天仓储（ava_threads / ava_messages，P9 F01）
import { getPool, query } from "./index";

export interface AvaThread {
  id: number;
  team_id: number | null;
  user_id: number;
  title: string;
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

export async function replaceLastAvaUserMessageAndDeleteFollowing(
  threadId: number,
  messageId: number,
  content: string
): Promise<AvaMessage | undefined> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const lastUser = await client.query<AvaMessage>(
      `SELECT id, thread_id, role, content, status, created_at
       FROM ava_messages
       WHERE thread_id = $1 AND role = 'user'
       ORDER BY id DESC
       LIMIT 1
       FOR UPDATE`,
      [threadId]
    );
    if (Number(lastUser.rows[0]?.id) !== messageId) {
      await client.query("ROLLBACK");
      return undefined;
    }

    const updated = await client.query<AvaMessage>(
      `UPDATE ava_messages
       SET content = $3, status = 'complete'
       WHERE thread_id = $1 AND id = $2 AND role = 'user'
       RETURNING id, thread_id, role, content, status, created_at`,
      [threadId, messageId, content]
    );
    await client.query(`DELETE FROM ava_messages WHERE thread_id = $1 AND id > $2`, [
      threadId,
      messageId,
    ]);
    await client.query(`UPDATE ava_threads SET updated_at = now() WHERE id = $1`, [threadId]);
    await client.query("COMMIT");
    return updated.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteLastAvaUserMessageAndFollowing(
  threadId: number,
  messageId: number
): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const lastUser = await client.query<AvaMessage>(
      `SELECT id, thread_id, role, content, status, created_at
       FROM ava_messages
       WHERE thread_id = $1 AND role = 'user'
       ORDER BY id DESC
       LIMIT 1
       FOR UPDATE`,
      [threadId]
    );
    if (Number(lastUser.rows[0]?.id) !== messageId) {
      await client.query("ROLLBACK");
      return false;
    }

    await client.query(`DELETE FROM ava_messages WHERE thread_id = $1 AND id >= $2`, [
      threadId,
      messageId,
    ]);
    await client.query(`UPDATE ava_threads SET updated_at = now() WHERE id = $1`, [threadId]);
    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
