// packages/data/src/aiStore.ts — CAP-DATA AI Store 商品仓储（P11）
// ai_store_items：Agent / AI 工具 / 图片工具 / 模板，scope=personal/team/platform。
import { query } from "./index";

export type AiStoreItemType = "agent" | "ai-tool" | "image-tool" | "template";
export type AiStoreItemScope = "personal" | "team" | "platform";
export type AiStoreItemStatus = "draft" | "published" | "pending" | "approved" | "rejected";
export type AiStoreSubmitAction = "draft" | "publish" | "submit_review";

export interface AiStoreItem {
  id: number;
  type: AiStoreItemType;
  scope: AiStoreItemScope;
  owner_user_id: number | null;
  team_id: number | null;
  status: AiStoreItemStatus;
  name: string;
  description: string;
  cover: string | null;
  author: string;
  tags: string[];
  examples: string[];
  config: Record<string, unknown>;
  likes: number;
  views: number;
  featured: boolean;
  created_at: string;
  updated_at: string;
}

const ITEM_COLS =
  "id, type, scope, owner_user_id, team_id, status, name, description, cover, author, tags, examples, config, likes, views, featured, created_at, updated_at";

export interface ListAiStoreItemsOptions {
  /** 类型筛选；空/undefined = 不筛选。 */
  type?: AiStoreItemType | "";
  /** 关键词，按 name/description 大小写不敏感包含匹配。 */
  q?: string;
  /** 单个标签筛选（数组包含）。 */
  tag?: string;
  /** 当前用户 id，用于把其 personal 未发布外的可见项目并入结果（可选，浏览态一般只看 published）。 */
  userId?: number;
  /** 当前团队 id，可见范围含该团队的 team-scope 项目。 */
  teamId?: number | null;
  /** 分页：从 1 开始。 */
  page?: number;
  pageSize?: number;
}

export interface ListAiStoreItemsResult {
  items: AiStoreItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AiStoreItemDraftInput {
  type: AiStoreItemType;
  scope: AiStoreItemScope;
  status: AiStoreItemStatus;
  ownerUserId: number;
  teamId?: number | null;
  name: string;
  description: string;
  cover?: string | null;
  author: string;
  tags?: string[];
  examples?: string[];
  config?: Record<string, unknown>;
}

const DEFAULT_PAGE_SIZE = 9;

/**
 * 浏览可见的 AI Store 项目：已发布（published）且 scope=platform，
 * 或 scope=team 且 team_id 命中当前团队，或 scope=personal 且 owner 为当前用户。
 * 按 featured 优先、再按更新时间倒序；支持 type/关键词/标签筛选与分页。
 */
export async function listAiStoreItems(opts: ListAiStoreItemsOptions = {}): Promise<ListAiStoreItemsResult> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, opts.pageSize ?? DEFAULT_PAGE_SIZE));

  const conds: string[] = [];
  const params: unknown[] = [];

  // 可见性：published 的 platform 项目 + 命中团队的 team 项目 + 属于当前用户的 personal 项目。
  const visClauses: string[] = ["(status = 'published' AND scope = 'platform')"];
  if (opts.teamId != null) {
    params.push(opts.teamId);
    visClauses.push(`(status = 'published' AND scope = 'team' AND team_id = $${params.length})`);
  }
  if (opts.userId != null) {
    params.push(opts.userId);
    visClauses.push(`(scope = 'personal' AND owner_user_id = $${params.length})`);
  }
  conds.push(`(${visClauses.join(" OR ")})`);

  if (opts.type) {
    params.push(opts.type);
    conds.push(`type = $${params.length}`);
  }
  if (opts.tag && opts.tag.trim()) {
    params.push(opts.tag.trim());
    conds.push(`$${params.length} = ANY(tags)`);
  }
  if (opts.q && opts.q.trim()) {
    params.push(`%${opts.q.trim()}%`);
    conds.push(`(name ILIKE $${params.length} OR description ILIKE $${params.length})`);
  }

  const whereSql = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

  const countRows = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM ai_store_items ${whereSql}`,
    params
  );
  const total = Number(countRows[0]?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const limitParams = [...params, pageSize, (page - 1) * pageSize];
  const items = await query<AiStoreItem>(
    `SELECT ${ITEM_COLS} FROM ai_store_items ${whereSql}
     ORDER BY featured DESC, updated_at DESC, id DESC
     LIMIT $${limitParams.length - 1} OFFSET $${limitParams.length}`,
    limitParams
  );

  return { items, total, page, pageSize, totalPages };
}

/** 取单个项目详情（供详情弹窗）。不做可见性过滤，调用方按需自行校验。 */
export async function getAiStoreItem(id: number): Promise<AiStoreItem | undefined> {
  const rows = await query<AiStoreItem>(`SELECT ${ITEM_COLS} FROM ai_store_items WHERE id = $1`, [id]);
  return rows[0];
}

/** 拥有者管理列表：用于 Create/Authorized 视图展示自己的草稿、已发布和审核中项目。 */
export async function listOwnedAiStoreItems(ownerUserId: number): Promise<AiStoreItem[]> {
  return query<AiStoreItem>(
    `SELECT ${ITEM_COLS} FROM ai_store_items
     WHERE owner_user_id = $1
     ORDER BY updated_at DESC, id DESC`,
    [ownerUserId]
  );
}

/** 创建 AI Store 项目：F02 的草稿/发布/提交审核都落同一张表。 */
export async function createAiStoreItem(input: AiStoreItemDraftInput): Promise<AiStoreItem> {
  const rows = await query<AiStoreItem>(
    `INSERT INTO ai_store_items
       (type, scope, owner_user_id, team_id, status, name, description, cover, author, tags, examples, config)
     VALUES
       ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
     RETURNING ${ITEM_COLS}`,
    [
      input.type,
      input.scope,
      input.ownerUserId,
      input.teamId ?? null,
      input.status,
      input.name,
      input.description,
      input.cover ?? null,
      input.author,
      input.tags ?? [],
      input.examples ?? [],
      JSON.stringify(input.config ?? {}),
    ]
  );
  return rows[0]!;
}

/** 仅 owner 可更新自己的 AI Store 项目。调用方负责决定状态动作是否合法。 */
export async function updateAiStoreItem(
  id: number,
  ownerUserId: number,
  input: AiStoreItemDraftInput
): Promise<AiStoreItem | undefined> {
  const rows = await query<AiStoreItem>(
    `UPDATE ai_store_items
     SET type = $3,
         scope = $4,
         team_id = $5,
         status = $6,
         name = $7,
         description = $8,
         cover = $9,
         author = $10,
         tags = $11,
         examples = $12,
         config = $13::jsonb,
         updated_at = now()
     WHERE id = $1 AND owner_user_id = $2
     RETURNING ${ITEM_COLS}`,
    [
      id,
      ownerUserId,
      input.type,
      input.scope,
      input.teamId ?? null,
      input.status,
      input.name,
      input.description,
      input.cover ?? null,
      input.author,
      input.tags ?? [],
      input.examples ?? [],
      JSON.stringify(input.config ?? {}),
    ]
  );
  return rows[0];
}

/**
 * 判断某项目对某用户/团队是否可浏览（纯函数，可单测）：
 * published+platform 恒可见；published+team 需 team_id 命中当前团队；
 * personal 需 owner 为当前用户（不要求 published，草稿仅属主可见）。
 */
export function isAiStoreItemVisible(
  item: Pick<AiStoreItem, "status" | "scope" | "owner_user_id" | "team_id">,
  userId: number | undefined,
  teamId: number | null | undefined
): boolean {
  if (item.scope === "platform") return item.status === "published";
  if (item.scope === "team") return item.status === "published" && teamId != null && item.team_id === teamId;
  if (item.scope === "personal") return userId != null && item.owner_user_id === userId;
  return false;
}

// ---------------------------------------------------------------------------
// P15 F04 — 平台审核（Admin Panel）：仅 scope=platform 的 BoardX Resource 走这里。
// 状态机：pending →(approve) approved；approved →(revoke) pending；pending →(reject) rejected。
// ---------------------------------------------------------------------------

export type AiStoreReviewAction = "approve" | "reject" | "revoke";

export interface ListPlatformReviewItemsOptions {
  /** 空/undefined = pending+approved 都要（审核页默认视图）；传具体值则只看该状态。 */
  status?: "pending" | "approved" | "";
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface ListPlatformReviewItemsResult {
  items: AiStoreItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** 平台审核页列表：只看 scope=platform 且状态在 pending/approved 之列（rejected/draft/published 不进审核队列）。 */
export async function listPlatformReviewItems(
  opts: ListPlatformReviewItemsOptions = {}
): Promise<ListPlatformReviewItemsResult> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 20));

  const conds: string[] = ["scope = 'platform'"];
  const params: unknown[] = [];

  if (opts.status === "pending" || opts.status === "approved") {
    params.push(opts.status);
    conds.push(`status = $${params.length}`);
  } else {
    conds.push(`status IN ('pending', 'approved')`);
  }

  if (opts.q && opts.q.trim()) {
    params.push(`%${opts.q.trim()}%`);
    conds.push(`(name ILIKE $${params.length} OR description ILIKE $${params.length})`);
  }

  const whereSql = `WHERE ${conds.join(" AND ")}`;

  const countRows = await query<{ count: string }>(`SELECT count(*)::text AS count FROM ai_store_items ${whereSql}`, params);
  const total = Number(countRows[0]?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const limitParams = [...params, pageSize, (page - 1) * pageSize];
  const items = await query<AiStoreItem>(
    `SELECT ${ITEM_COLS} FROM ai_store_items ${whereSql}
     ORDER BY (status = 'pending') DESC, updated_at DESC, id DESC
     LIMIT $${limitParams.length - 1} OFFSET $${limitParams.length}`,
    limitParams
  );

  return { items, total, page, pageSize, totalPages };
}

/**
 * 平台审核状态转移：pending→approved（approve）、approved→pending（revoke）、pending→rejected（reject）。
 * 用 `WHERE status = <expected>` 做原子的乐观锁校验：转移只在 DB 里的当前状态确实是期望的前置状态时才生效
 * （UPDATE ... WHERE ... RETURNING 一步完成读+写，杜绝 TOCTOU）。
 * 重复提交同一个已经生效的操作（比如已经是 approved 又点一次 approve）视为幂等：不报错，直接返回当前行。
 * 若请求的前置状态与当前 DB 状态不符（比如另一个管理员已经处理过、或对象不是平台资源），返回 undefined，
 * 调用方据此返回 409，避免误报"成功"掩盖并发覆盖。
 */
export async function setAiStoreItemReviewStatus(
  id: number,
  action: AiStoreReviewAction
): Promise<{ item: AiStoreItem; idempotent: boolean } | undefined> {
  const fromStatus = action === "revoke" ? "approved" : "pending";
  const toStatus: AiStoreItemStatus = action === "approve" ? "approved" : action === "revoke" ? "pending" : "rejected";

  const updated = await query<AiStoreItem>(
    `UPDATE ai_store_items
     SET status = $3, updated_at = now()
     WHERE id = $1 AND scope = 'platform' AND status = $2
     RETURNING ${ITEM_COLS}`,
    [id, fromStatus, toStatus]
  );
  if (updated[0]) return { item: updated[0], idempotent: false };

  // 没更新到任何行：可能已经是目标状态（幂等重放/双击）——原样返回，不报错；
  // 也可能是别的状态/不存在/非 platform，调用方按 undefined 处理为 409/404。
  const current = await getAiStoreItem(id);
  if (current && current.scope === "platform" && current.status === toStatus) {
    return { item: current, idempotent: true };
  }
  return undefined;
}
