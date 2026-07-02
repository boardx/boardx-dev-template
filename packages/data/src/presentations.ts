// packages/data/src/presentations.ts — CAP-AI 演示文稿制品仓储（presentation_artifacts / P12 F02）
// 生成异步推进：queued → processing → ready | error。与 studio.ts（P12 F01）同一模式，
// API 落库后入队，worker 回写终态。独立表见 019_presentation_artifacts.sql 注释里的理由。
import { query } from "./index";

export type PresentationSource = "current_chat" | "room_files" | "instructions";
export type PresentationStatus = "queued" | "processing" | "ready" | "error";
export type PresentationStyle = "minimal" | "vibrant" | "calm";

export interface PresentationSlide {
  n: number;
  title: string;
  bullets: string[];
}

export interface PresentationArtifact {
  id: string;
  room_id: number;
  chat_id: number;
  creator_user_id: number;
  topic: string;
  source: PresentationSource;
  instructions: string;
  pages: number;
  style: string;
  status: PresentationStatus;
  title: string | null;
  slides: PresentationSlide[] | null;
  pptx_object_key: string | null;
  pdf_object_key: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePresentationArtifactInput {
  id: string;
  roomId: number;
  chatId: number;
  creatorUserId: number;
  topic: string;
  source: PresentationSource;
  instructions: string;
  pages: number;
  style: string;
}

const PRESENTATION_ARTIFACT_COLUMNS =
  "id, room_id, chat_id, creator_user_id, topic, source, instructions, pages, style, status, title, slides, pptx_object_key, pdf_object_key, error_message, created_at, updated_at";

export async function createPresentationArtifact(
  input: CreatePresentationArtifactInput
): Promise<PresentationArtifact> {
  const rows = await query<PresentationArtifact>(
    `INSERT INTO presentation_artifacts (id, room_id, chat_id, creator_user_id, topic, source, instructions, pages, style, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'queued')
     RETURNING ${PRESENTATION_ARTIFACT_COLUMNS}`,
    [
      input.id,
      input.roomId,
      input.chatId,
      input.creatorUserId,
      input.topic,
      input.source,
      input.instructions,
      input.pages,
      input.style,
    ]
  );
  return rows[0]!;
}

export async function getPresentationArtifact(id: string): Promise<PresentationArtifact | undefined> {
  const rows = await query<PresentationArtifact>(
    `SELECT ${PRESENTATION_ARTIFACT_COLUMNS} FROM presentation_artifacts WHERE id = $1`,
    [id]
  );
  return rows[0];
}

/** 线程内制品，按创建时间升序（与消息列表同序，便于在聊天流中按时间穿插渲染）。 */
export async function listPresentationArtifactsByChat(chatId: number): Promise<PresentationArtifact[]> {
  return query<PresentationArtifact>(
    `SELECT ${PRESENTATION_ARTIFACT_COLUMNS} FROM presentation_artifacts WHERE chat_id = $1 ORDER BY id ASC`,
    [chatId]
  );
}

/** worker 回写处理中状态（幂等）。 */
export async function markPresentationArtifactProcessing(id: string): Promise<void> {
  await query(`UPDATE presentation_artifacts SET status = 'processing', updated_at = now() WHERE id = $1`, [id]);
}

/** worker 回写成功终态：写入幻灯片元数据 + PPTX/PDF 产物 key + 标题。 */
export async function markPresentationArtifactReady(
  id: string,
  input: { title: string; slides: PresentationSlide[]; pptxObjectKey: string; pdfObjectKey: string }
): Promise<void> {
  await query(
    `UPDATE presentation_artifacts
     SET status = 'ready', title = $2, slides = $3, pptx_object_key = $4, pdf_object_key = $5, updated_at = now()
     WHERE id = $1`,
    [id, input.title, JSON.stringify(input.slides), input.pptxObjectKey, input.pdfObjectKey]
  );
}

/** worker 回写失败终态：保留错误信息，供卡片展示 + 重试。 */
export async function markPresentationArtifactError(id: string, errorMessage: string): Promise<void> {
  await query(
    `UPDATE presentation_artifacts SET status = 'error', error_message = $2, updated_at = now() WHERE id = $1`,
    [id, errorMessage]
  );
}

/** 重试：把失败制品重置回 queued，清空错误信息，供重新入队。 */
export async function resetPresentationArtifactForRetry(
  id: string
): Promise<PresentationArtifact | undefined> {
  const rows = await query<PresentationArtifact>(
    `UPDATE presentation_artifacts SET status = 'queued', error_message = NULL, updated_at = now()
     WHERE id = $1 RETURNING ${PRESENTATION_ARTIFACT_COLUMNS}`,
    [id]
  );
  return rows[0];
}
