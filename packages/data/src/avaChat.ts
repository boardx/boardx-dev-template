// packages/data/src/avaChat.ts — CAP-DATA AVA 聊天仓储（ava_threads / ava_messages，P9 F01）
import { randomBytes } from "node:crypto";
import { getPool, query } from "./index";

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

// ─── 附件（p9-F08，CAP-FILE）──────────────────────────────────────────────
// message_id 为空 = 已上传但还未随消息发出的"暂存"附件（预览条里可移除/继续添加）；
// 发送消息时把选中的暂存附件 message_id 回填为新插入消息的 id，才算真正进入聊天历史。

export type AvaAttachmentKind = "image" | "audio" | "file";

export interface AvaAttachment {
  id: string;
  thread_id: number;
  message_id: number | null;
  owner_user_id: number;
  kind: AvaAttachmentKind;
  name: string;
  mime_type: string;
  size_bytes: number;
  object_key: string;
  created_at: string;
}

const AVA_ATTACHMENT_COLUMNS =
  "id, thread_id, message_id, owner_user_id, kind, name, mime_type, size_bytes, object_key, created_at";

export const DEFAULT_AVA_THREAD_TITLE = "New chat";

export interface ListAvaThreadsOptions {
  limit?: number;
  offset?: number;
}

function clampListLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return 20;
  return Math.min(Math.max(Math.trunc(limit as number), 1), 50);
}

function normalizeOffset(offset: number | undefined): number {
  if (!Number.isFinite(offset)) return 0;
  return Math.max(Math.trunc(offset as number), 0);
}

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
export async function listAvaThreads(
  userId: number,
  teamId: number | null,
  options: ListAvaThreadsOptions = {}
): Promise<AvaThread[]> {
  const limit = clampListLimit(options.limit);
  const offset = normalizeOffset(options.offset);
  if (teamId == null) {
    return query<AvaThread>(
      `SELECT id, team_id, user_id, title, created_at, updated_at
       FROM ava_threads WHERE user_id = $1 AND team_id IS NULL
       ORDER BY updated_at DESC, id DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
  }
  return query<AvaThread>(
    `SELECT id, team_id, user_id, title, created_at, updated_at
     FROM ava_threads WHERE user_id = $1 AND team_id = $2
     ORDER BY updated_at DESC, id DESC
     LIMIT $3 OFFSET $4`,
    [userId, teamId, limit, offset]
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

export async function renameAvaThread(
  threadId: number,
  userId: number,
  teamId: number | null,
  title: string
): Promise<AvaThread | undefined> {
  if (teamId == null) {
    const rows = await query<AvaThread>(
      `UPDATE ava_threads SET title = $3, updated_at = now()
       WHERE id = $1 AND user_id = $2 AND team_id IS NULL
       RETURNING id, team_id, user_id, title, created_at, updated_at`,
      [threadId, userId, title]
    );
    return rows[0];
  }
  const rows = await query<AvaThread>(
    `UPDATE ava_threads SET title = $4, updated_at = now()
     WHERE id = $1 AND user_id = $2 AND team_id = $3
     RETURNING id, team_id, user_id, title, created_at, updated_at`,
    [threadId, userId, teamId, title]
  );
  return rows[0];
}

export async function deleteAvaThread(
  threadId: number,
  userId: number,
  teamId: number | null
): Promise<boolean> {
  if (teamId == null) {
    const rows = await query<{ id: number }>(
      `DELETE FROM ava_threads
       WHERE id = $1 AND user_id = $2 AND team_id IS NULL
       RETURNING id`,
      [threadId, userId]
    );
    return rows.length > 0;
  }
  const rows = await query<{ id: number }>(
    `DELETE FROM ava_threads
     WHERE id = $1 AND user_id = $2 AND team_id = $3
     RETURNING id`,
    [threadId, userId, teamId]
  );
  return rows.length > 0;
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

/** 重新生成：删除最后一条 assistant 消息（及其后任何消息，正常情况下没有），保留原问题
 *  （最后一条 user 消息）不动。仅允许对"最后一条 assistant 消息"重新生成，防止破坏顺序。
 *  返回 true 表示已删除，调用方随后应像发消息一样重新走一遍生成流程（history 已不含旧回复）。 */
export async function deleteLastAvaAssistantMessageForRegenerate(
  threadId: number,
  messageId: number
): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const lastMessage = await client.query<AvaMessage>(
      `SELECT id, thread_id, role, content, status, created_at
       FROM ava_messages
       WHERE thread_id = $1
       ORDER BY id DESC
       LIMIT 1
       FOR UPDATE`,
      [threadId]
    );
    const last = lastMessage.rows[0];
    if (!last || last.role !== "assistant" || Number(last.id) !== messageId) {
      await client.query("ROLLBACK");
      return false;
    }

    await client.query(`DELETE FROM ava_messages WHERE thread_id = $1 AND id >= $2`, [
      threadId,
      messageId,
    ]);
    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ─── 消息反馈（p9-F11，点赞/点踩）───────────────────────────────────────────

export type AvaMessageFeedbackRating = "up" | "down";

export interface AvaMessageFeedback {
  message_id: number;
  user_id: number;
  rating: AvaMessageFeedbackRating;
  created_at: string;
  updated_at: string;
}

/** 提交/更新反馈：同一用户对同一条消息只保留最新一条（upsert）。调用方需先确认该消息属于
 *  当前用户可访问的线程（isThreadInCurrentContext）且是 assistant 消息。 */
export async function upsertAvaMessageFeedback(
  messageId: number,
  userId: number,
  rating: AvaMessageFeedbackRating
): Promise<AvaMessageFeedback> {
  const rows = await query<AvaMessageFeedback>(
    `INSERT INTO ava_message_feedback (message_id, user_id, rating)
     VALUES ($1, $2, $3)
     ON CONFLICT (message_id, user_id)
     DO UPDATE SET rating = EXCLUDED.rating, updated_at = now()
     RETURNING message_id, user_id, rating, created_at, updated_at`,
    [messageId, userId, rating]
  );
  return rows[0]!;
}

/** 批量按 message_id 取当前用户已提交的反馈，减少 N+1（线程详情页渲染用）。 */
export async function listAvaMessageFeedbackByMessageIds(
  messageIds: number[],
  userId: number
): Promise<Map<number, AvaMessageFeedbackRating>> {
  const map = new Map<number, AvaMessageFeedbackRating>();
  if (messageIds.length === 0) return map;
  const rows = await query<{ message_id: number; rating: AvaMessageFeedbackRating }>(
    `SELECT message_id, rating FROM ava_message_feedback
     WHERE message_id = ANY($1::bigint[]) AND user_id = $2`,
    [messageIds, userId]
  );
  for (const row of rows) map.set(row.message_id, row.rating);
  return map;
}

// ─── 附件仓储 ──────────────────────────────────────────────────────────────

export interface CreateAvaAttachmentInput {
  id: string;
  threadId: number;
  ownerUserId: number;
  kind: AvaAttachmentKind;
  name: string;
  mimeType: string;
  sizeBytes: number;
  objectKey: string;
}

/** 上传成功后落库一条暂存附件记录（message_id 为空，尚未随消息发出）。 */
export async function createAvaAttachment(input: CreateAvaAttachmentInput): Promise<AvaAttachment> {
  const rows = await query<AvaAttachment>(
    `INSERT INTO ava_message_attachments
       (id, thread_id, message_id, owner_user_id, kind, name, mime_type, size_bytes, object_key)
     VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8)
     RETURNING ${AVA_ATTACHMENT_COLUMNS}`,
    [
      input.id,
      input.threadId,
      input.ownerUserId,
      input.kind,
      input.name,
      input.mimeType,
      input.sizeBytes,
      input.objectKey,
    ]
  );
  return rows[0]!;
}

export async function getAvaAttachment(id: string): Promise<AvaAttachment | undefined> {
  const rows = await query<AvaAttachment>(
    `SELECT ${AVA_ATTACHMENT_COLUMNS} FROM ava_message_attachments WHERE id = $1`,
    [id]
  );
  return rows[0];
}

/** 列出某条消息（发出后）关联的附件，按上传顺序。 */
export async function listAvaAttachmentsByMessage(messageId: number): Promise<AvaAttachment[]> {
  return query<AvaAttachment>(
    `SELECT ${AVA_ATTACHMENT_COLUMNS} FROM ava_message_attachments
     WHERE message_id = $1 ORDER BY created_at ASC, id ASC`,
    [messageId]
  );
}

/** 批量把暂存附件（message_id IS NULL）关联到刚插入的消息上；只认属于该线程/该用户的暂存附件，
 *  防止越权把别人的暂存附件"认领"到自己发的消息里。返回实际关联成功的附件（供响应/AI 上下文使用）。 */
export async function attachAvaAttachmentsToMessage(params: {
  attachmentIds: string[];
  messageId: number;
  threadId: number;
  ownerUserId: number;
}): Promise<AvaAttachment[]> {
  if (params.attachmentIds.length === 0) return [];
  const rows = await query<AvaAttachment>(
    `UPDATE ava_message_attachments
     SET message_id = $1
     WHERE id = ANY($2::text[])
       AND thread_id = $3
       AND owner_user_id = $4
       AND message_id IS NULL
     RETURNING ${AVA_ATTACHMENT_COLUMNS}`,
    [params.messageId, params.attachmentIds, params.threadId, params.ownerUserId]
  );
  return rows;
}

/** 移除一条暂存附件（预览条「移除」；仅限尚未随消息发出、且属于该用户的记录）。
 *  调用方负责先删对象存储再删记录，或接受偶发孤儿对象（本地开发场景可接受，
 *  真实生产可加定期 GC，不在本 feature 范围内）。 */
export async function deleteAvaAttachmentIfPending(
  id: string,
  ownerUserId: number
): Promise<AvaAttachment | undefined> {
  const rows = await query<AvaAttachment>(
    `DELETE FROM ava_message_attachments
     WHERE id = $1 AND owner_user_id = $2 AND message_id IS NULL
     RETURNING ${AVA_ATTACHMENT_COLUMNS}`,
    [id, ownerUserId]
  );
  return rows[0];
}

/** 批量按 message_id 列出多条消息的附件，减少 N+1 查询（列表页/线程详情用）。 */
export async function listAvaAttachmentsByMessageIds(
  messageIds: number[]
): Promise<Map<number, AvaAttachment[]>> {
  const map = new Map<number, AvaAttachment[]>();
  if (messageIds.length === 0) return map;
  const rows = await query<AvaAttachment>(
    `SELECT ${AVA_ATTACHMENT_COLUMNS} FROM ava_message_attachments
     WHERE message_id = ANY($1::bigint[]) ORDER BY created_at ASC, id ASC`,
    [messageIds]
  );
  for (const row of rows) {
    if (row.message_id == null) continue;
    const list = map.get(row.message_id) ?? [];
    list.push(row);
    map.set(row.message_id, list);
  }
  return map;
}
