// packages/data/src/studio.ts — CAP-AI Studio 制品仓储（studio_artifacts / P12 F01）
// 生成异步推进：queued → processing → ready | error。API 落库后入队，worker 回写终态。
import { query } from "./index";

export type StudioArtifactType = "audio" | "infographic" | "presentation";
export type StudioArtifactSource = "room_files" | "current_chat";
export type StudioArtifactStatus = "queued" | "processing" | "ready" | "error";

export interface StudioArtifact {
  id: string;
  room_id: number;
  chat_id: number;
  creator_user_id: number;
  type: StudioArtifactType;
  source: StudioArtifactSource;
  prompt: string;
  status: StudioArtifactStatus;
  object_key: string | null;
  title: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateStudioArtifactInput {
  id: string;
  roomId: number;
  chatId: number;
  creatorUserId: number;
  type: StudioArtifactType;
  source: StudioArtifactSource;
  prompt: string;
}

const STUDIO_ARTIFACT_COLUMNS =
  "id, room_id, chat_id, creator_user_id, type, source, prompt, status, object_key, title, error_message, created_at, updated_at";

export async function createStudioArtifact(input: CreateStudioArtifactInput): Promise<StudioArtifact> {
  const rows = await query<StudioArtifact>(
    `INSERT INTO studio_artifacts (id, room_id, chat_id, creator_user_id, type, source, prompt, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'queued')
     RETURNING ${STUDIO_ARTIFACT_COLUMNS}`,
    [input.id, input.roomId, input.chatId, input.creatorUserId, input.type, input.source, input.prompt]
  );
  return rows[0]!;
}

export async function getStudioArtifact(id: string): Promise<StudioArtifact | undefined> {
  const rows = await query<StudioArtifact>(
    `SELECT ${STUDIO_ARTIFACT_COLUMNS} FROM studio_artifacts WHERE id = $1`,
    [id]
  );
  return rows[0];
}

/** 线程内制品，按创建时间升序（与消息列表同序，便于在聊天流中按时间穿插渲染）。 */
export async function listStudioArtifactsByChat(chatId: number): Promise<StudioArtifact[]> {
  return query<StudioArtifact>(
    `SELECT ${STUDIO_ARTIFACT_COLUMNS} FROM studio_artifacts WHERE chat_id = $1 ORDER BY id ASC`,
    [chatId]
  );
}

/** worker 回写处理中状态（幂等）。 */
export async function markStudioArtifactProcessing(id: string): Promise<void> {
  await query(`UPDATE studio_artifacts SET status = 'processing', updated_at = now() WHERE id = $1`, [id]);
}

/** worker 回写成功终态：写入产物 key + 标题。 */
export async function markStudioArtifactReady(
  id: string,
  objectKey: string,
  title: string
): Promise<void> {
  await query(
    `UPDATE studio_artifacts SET status = 'ready', object_key = $2, title = $3, updated_at = now() WHERE id = $1`,
    [id, objectKey, title]
  );
}

/** worker 回写失败终态：保留错误信息，供面板展示 + 重试。 */
export async function markStudioArtifactError(id: string, errorMessage: string): Promise<void> {
  await query(
    `UPDATE studio_artifacts SET status = 'error', error_message = $2, updated_at = now() WHERE id = $1`,
    [id, errorMessage]
  );
}

/** 重试：把失败制品重置回 queued，清空错误信息，供重新入队。 */
export async function resetStudioArtifactForRetry(id: string): Promise<StudioArtifact | undefined> {
  const rows = await query<StudioArtifact>(
    `UPDATE studio_artifacts SET status = 'queued', error_message = NULL, updated_at = now()
     WHERE id = $1 RETURNING ${STUDIO_ARTIFACT_COLUMNS}`,
    [id]
  );
  return rows[0];
}
