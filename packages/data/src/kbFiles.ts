// packages/data/src/kbFiles.ts — CAP-FILE 知识库文件仓储（p10-F01 地基）
// scope 隔离：personal/team/agent/tool + owner；status 只由上传/处理管线单向推进。
import { query } from "./index";

export type KbScope = "personal" | "team" | "agent" | "tool";
export type KbFileStatus = "processing" | "ready" | "error";

export interface KbFile {
  id: string;
  scope: KbScope;
  owner_user_id: number;
  team_id: number | null;
  name: string;
  ext: string;
  mime_type: string;
  size_bytes: number;
  object_key: string;
  status: KbFileStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateKbFileInput {
  id: string;
  scope: KbScope;
  ownerUserId: number;
  teamId?: number | null;
  name: string;
  ext: string;
  mimeType: string;
  sizeBytes: number;
  objectKey: string;
}

const KB_FILE_COLUMNS =
  "id, scope, owner_user_id, team_id, name, ext, mime_type, size_bytes, object_key, status, error_message, created_at, updated_at";

/** 插入一条 kb_files 记录（初始 status=processing）。上传管线里对象存储写成功后才调用，
 *  避免半条记录（对象存储失败则不落库，见 apps/web 路由）。 */
export async function createKbFile(input: CreateKbFileInput): Promise<KbFile> {
  const rows = await query<KbFile>(
    `INSERT INTO kb_files (id, scope, owner_user_id, team_id, name, ext, mime_type, size_bytes, object_key, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'processing')
     RETURNING ${KB_FILE_COLUMNS}`,
    [
      input.id,
      input.scope,
      input.ownerUserId,
      input.teamId ?? null,
      input.name,
      input.ext,
      input.mimeType,
      input.sizeBytes,
      input.objectKey,
    ]
  );
  return rows[0]!;
}

export async function getKbFile(id: string): Promise<KbFile | undefined> {
  const rows = await query<KbFile>(`SELECT ${KB_FILE_COLUMNS} FROM kb_files WHERE id = $1`, [id]);
  return rows[0];
}

/** 列出某用户在给定 scope 下有权访问的文件（personal: 仅自己；team: 同 team_id）。
 *  按名称模糊搜索可选。仅 F01 所需最小过滤；F02 会扩展分页。 */
export async function listKbFiles(params: {
  ownerUserId: number;
  scope?: KbScope;
  teamId?: number | null;
  q?: string;
}): Promise<KbFile[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (params.scope === "team" && params.teamId != null) {
    values.push(params.teamId);
    conditions.push(`team_id = $${values.length}`);
  } else {
    values.push(params.ownerUserId);
    conditions.push(`owner_user_id = $${values.length}`);
    if (params.scope) {
      values.push(params.scope);
      conditions.push(`scope = $${values.length}`);
    }
  }

  if (params.q) {
    values.push(`%${params.q}%`);
    conditions.push(`name ILIKE $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return query<KbFile>(
    `SELECT ${KB_FILE_COLUMNS} FROM kb_files ${where} ORDER BY created_at DESC, id DESC`,
    values
  );
}

/** worker 异步回写处理状态（幂等：相同输入多次调用结果一致）。 */
export async function setKbFileStatus(
  id: string,
  status: KbFileStatus,
  errorMessage?: string
): Promise<void> {
  await query(
    `UPDATE kb_files SET status = $2, error_message = $3, updated_at = now() WHERE id = $1`,
    [id, status, errorMessage ?? null]
  );
}

export async function deleteKbFile(id: string): Promise<void> {
  await query(`DELETE FROM kb_files WHERE id = $1`, [id]);
}
