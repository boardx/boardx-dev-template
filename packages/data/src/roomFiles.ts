// packages/data/src/roomFiles.ts — CAP-FILE 房间级文件库仓储（p20-F03，uc-rr-003）
// 核心模型修正：room_id 是唯一所有权边界（NOT NULL）；chat_thread_id 只是可选的
// 来源标注/过滤维度，不构成绑定关系——同一房间所有聊天线程共享同一份文件集合。
import { query } from "./index";

export type RoomFileStatus = "ready" | "deleted";

export interface RoomFile {
  id: string;
  room_id: number;
  chat_thread_id: number | null;
  uploader_id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  status: RoomFileStatus;
  deleted_at: string | null;
  created_by_migration: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoomFileWithUploader extends RoomFile {
  uploader_email: string;
}

const ROOM_FILE_COLUMNS =
  "f.id, f.room_id, f.chat_thread_id, f.uploader_id, f.file_name, f.file_type, f.file_size, " +
  "f.storage_path, f.status, f.deleted_at, f.created_by_migration, f.created_at, f.updated_at";

export interface CreateRoomFileInput {
  id: string;
  roomId: number;
  chatThreadId?: number | null;
  uploaderId: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
}

/** 落库一条房间文件记录（confirm 阶段调用；对象存储直传成功后才调用，避免半条记录）。 */
export async function createRoomFile(input: CreateRoomFileInput): Promise<RoomFile> {
  const rows = await query<RoomFile>(
    `INSERT INTO room_files (id, room_id, chat_thread_id, uploader_id, file_name, file_type, file_size, storage_path, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ready')
     RETURNING id, room_id, chat_thread_id, uploader_id, file_name, file_type, file_size, storage_path, status, deleted_at, created_by_migration, created_at, updated_at`,
    [
      input.id,
      input.roomId,
      input.chatThreadId ?? null,
      input.uploaderId,
      input.fileName,
      input.fileType,
      input.fileSize,
      input.storagePath,
    ]
  );
  return rows[0]!;
}

export async function getRoomFile(id: string): Promise<RoomFile | undefined> {
  const rows = await query<RoomFile>(
    `SELECT id, room_id, chat_thread_id, uploader_id, file_name, file_type, file_size, storage_path, status, deleted_at, created_by_migration, created_at, updated_at
     FROM room_files WHERE id = $1`,
    [id]
  );
  return rows[0];
}

/** 房间成员均可查看：列出某房间未软删的文件，可选按来源线程过滤 + 文件名模糊搜索。
 *  不要求 chatThreadId 参数——不打开任何聊天线程也能拿到完整列表（uc-rr-003 前置条件）。 */
export async function listRoomFiles(params: {
  roomId: number;
  chatThreadId?: number | null;
  q?: string;
}): Promise<RoomFileWithUploader[]> {
  const values: unknown[] = [params.roomId];
  const conditions = [`f.room_id = $1`, `f.status = 'ready'`];

  if (params.chatThreadId != null) {
    values.push(params.chatThreadId);
    conditions.push(`f.chat_thread_id = $${values.length}`);
  }

  const q = params.q?.trim();
  if (q) {
    values.push(`%${q}%`);
    conditions.push(`f.file_name ILIKE $${values.length}`);
  }

  const rows = await query<RoomFileWithUploader>(
    `SELECT ${ROOM_FILE_COLUMNS}, u.email AS uploader_email
     FROM room_files f
     JOIN users u ON u.id = f.uploader_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY f.created_at DESC, f.id DESC`,
    values
  );
  return rows;
}

/** 房间下未软删文件数量（p20/F06 删除房间确认弹窗的级联数量摘要）。 */
export async function countRoomFiles(roomId: number): Promise<number> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM room_files WHERE room_id = $1 AND status = 'ready'`,
    [roomId]
  );
  return Number(rows[0]?.count ?? 0);
}

/** 行级访问：取某房间下未软删的单个文件（预览/删除前置校验共用）。 */
export async function getReadyRoomFile(roomId: number, fileId: string): Promise<RoomFile | undefined> {
  const rows = await query<RoomFile>(
    `SELECT id, room_id, chat_thread_id, uploader_id, file_name, file_type, file_size, storage_path, status, deleted_at, created_by_migration, created_at, updated_at
     FROM room_files WHERE id = $1 AND room_id = $2 AND status = 'ready'`,
    [fileId, roomId]
  );
  return rows[0];
}

/** 软删：置 status='deleted' + deleted_at；不物理删对象存储（可扩展为异步清理，本期不做）。
 *  幂等：对已软删的文件重复调用不报错。 */
export async function softDeleteRoomFile(id: string): Promise<void> {
  await query(`UPDATE room_files SET status = 'deleted', deleted_at = now(), updated_at = now() WHERE id = $1`, [
    id,
  ]);
}
