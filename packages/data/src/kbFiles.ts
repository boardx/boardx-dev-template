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

export interface ListKbFilesResult {
  files: KbFile[];
  total: number;
}

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

function buildKbFileListFilter(params: {
  ownerUserId: number;
  scope?: KbScope;
  teamId?: number | null;
  q?: string;
}): { where: string; values: unknown[] } {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (params.scope === "team") {
    if (params.teamId == null) return { where: "WHERE false", values };
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

  const q = params.q?.trim();
  if (q) {
    values.push(`%${q}%`);
    conditions.push(`name ILIKE $${values.length}`);
  }

  return { where: `WHERE ${conditions.join(" AND ")}`, values };
}

/** 列出某用户在给定 scope 下有权访问的文件（personal/agent/tool: 仅自己；team: 同 team_id）。
 *  按名称模糊搜索可选，返回分页结果和总数。 */
export async function listKbFiles(params: {
  ownerUserId: number;
  scope?: KbScope;
  teamId?: number | null;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<ListKbFilesResult> {
  const { where, values } = buildKbFileListFilter(params);
  const limit = Math.max(1, Math.min(params.limit ?? 20, 100));
  const offset = Math.max(0, params.offset ?? 0);

  const totalRows = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM kb_files ${where}`,
    values
  );

  const pageValues = [...values, limit, offset];
  const files = await query<KbFile>(
    `SELECT ${KB_FILE_COLUMNS}
     FROM kb_files ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT $${pageValues.length - 1} OFFSET $${pageValues.length}`,
    pageValues
  );

  return { files, total: Number(totalRows[0]?.count ?? 0) };
}

/** 取当前用户有权访问的单个文件，用于下载/删除等行级操作。 */
export async function getAccessibleKbFile(id: string, userId: number): Promise<KbFile | undefined> {
  const rows = await query<KbFile>(
    `SELECT ${KB_FILE_COLUMNS}
     FROM kb_files f
     WHERE f.id = $1
       AND (
         (f.scope = 'team' AND f.team_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM team_members m WHERE m.team_id = f.team_id AND m.user_id = $2
         ))
         OR (f.scope <> 'team' AND f.owner_user_id = $2)
       )`,
    [id, userId]
  );
  return rows[0];
}

// ─── RAG 检索（p10-F04）────────────────────────────────────────────────────
// F04 未实现向量索引/embedding（见 F01/F03 notes：真实解析/切分/向量化留给后续，
// kb_files 目前只存文件元数据，没有抽取出的正文内容可供向量化）。本阶段的检索是
// 按文件名的关键词匹配（对 kb_files.name 做 ILIKE），只是「有没有相关文件」的
// 确定性占位判据，不虚构不存在的文件内容——回复引用的是真实存在、真实可访问、
// 真实 ready 的文件记录，不是编造的向量相似度。
//
// 作用域隔离与 getAccessibleKbFile 同口径，但額外收窄：
//   - personal/agent/tool：仅 owner_user_id = 当前用户。
//   - team：仅当前团队上下文（teamId 参数，而非用户所属的任意团队）的成员可见，
//     且必须是该 team_id 下的文件——同一用户属于多个团队时，不在当前团队上下文的
//     团队文件不得混入检索结果（避免切换团队前的上下文泄露）。
//   - status 必须为 'ready'：processing/error 的文件不参与检索（未处理完成不可用）。
export interface KbRetrievalHit {
  id: string;
  name: string;
  scope: KbScope;
}

/** 从用户当前可见的知识库文件中，按关键词（从用户消息文本切出的词）检索命中的文件名。
 *  作用域隔离：personal/agent/tool 限 owner；team 限当前团队上下文的成员；
 *  仅检索 status='ready' 的文件。无关键词或无命中返回空数组（调用方不应虚构引用）。 */
export async function retrieveKbFilesForQuery(params: {
  ownerUserId: number;
  teamId: number | null;
  queryText: string;
  limit?: number;
}): Promise<KbRetrievalHit[]> {
  const keywords = extractKeywords(params.queryText);
  if (keywords.length === 0) return [];

  const limit = Math.max(1, Math.min(params.limit ?? 3, 10));

  const values: unknown[] = [params.ownerUserId];
  let scopeClause = `(f.scope <> 'team' AND f.owner_user_id = $1)`;
  if (params.teamId != null) {
    values.push(params.teamId);
    scopeClause = `(
      ${scopeClause}
      OR (f.scope = 'team' AND f.team_id = $2 AND EXISTS (
        SELECT 1 FROM team_members m WHERE m.team_id = f.team_id AND m.user_id = $1
      ))
    )`;
  }

  const keywordConditions: string[] = [];
  for (const kw of keywords) {
    values.push(`%${kw}%`);
    keywordConditions.push(`f.name ILIKE $${values.length}`);
  }

  values.push(limit);

  const rows = await query<KbRetrievalHit>(
    `SELECT f.id, f.name, f.scope
     FROM kb_files f
     WHERE f.status = 'ready'
       AND ${scopeClause}
       AND (${keywordConditions.join(" OR ")})
     ORDER BY f.created_at DESC
     LIMIT $${values.length}`,
    values
  );
  return rows;
}

/** 从自由文本切出用于 ILIKE 匹配的关键词：按非字母数字分词，过滤过短的词。 */
function extractKeywords(text: string): string[] {
  const tokens = text
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  // 去重，避免同词重复拼多次 ILIKE 条件
  return Array.from(new Set(tokens));
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
