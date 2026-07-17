// packages/data/src/aiStore.ts — CAP-DATA AI Store 商品仓储（P11）
// ai_store_items：Agent / AI 工具 / 图片工具 / 模板，scope=personal/team/platform。
import { randomBytes } from "node:crypto";
import { query } from "./index";

export type AiStoreItemType = "agent" | "skill" | "template";
export type AiStoreLegacyItemType = "ai-tool" | "image-tool" | "AI_TOOL" | "AI_IMAGE_TOOL";
export type AiStoreSkillKind = "text" | "image";
export type AiStoreItemScope = "personal" | "team" | "platform";
export type AiStoreItemStatus = "draft" | "published" | "pending" | "approved" | "rejected";
export type AiStoreSubmitAction = "draft" | "publish" | "submit_review";

export interface AiStoreItem {
  id: number;
  type: AiStoreItemType;
  scope: AiStoreItemScope;
  owner_user_id: number | null;
  origin_team_id: number;
  /** @deprecated Compatibility alias for existing Web consumers. */
  team_id: number | null;
  migration_quarantined_at: string | null;
  archived_at?: string | null;
  version: number;
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
  "id, type, scope, owner_user_id, origin_team_id, origin_team_id AS team_id, migration_quarantined_at, archived_at, version, status, name, description, cover, author, tags, examples, config, likes, views, featured, created_at, updated_at";

export function normalizeAiStoreItemType(
  value: string,
): { type: AiStoreItemType; skillKind?: AiStoreSkillKind } | undefined {
  if (value === "agent" || value === "template" || value === "skill") {
    return { type: value };
  }
  if (value === "ai-tool" || value === "AI_TOOL") {
    return { type: "skill", skillKind: "text" };
  }
  if (value === "image-tool" || value === "AI_IMAGE_TOOL") {
    return { type: "skill", skillKind: "image" };
  }
  return undefined;
}

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
  originTeamId: number;
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
 * 浏览可见的 AI Store 项目：scope=platform 且 status 为 published 或 approved
 * （F04 平台审核批准 = "APPROVED/发布到平台"，approved 与 published 对 Explore 同等可见，
 * 见 phase-p15-admin F04 的 user_visible_behavior 措辞），
 * 或 scope=team 且 team_id 命中当前团队，或 scope=personal 且 owner 为当前用户。
 * 按 featured 优先、再按更新时间倒序；支持 type/关键词/标签筛选与分页。
 */
export async function listAiStoreItems(opts: ListAiStoreItemsOptions = {}): Promise<ListAiStoreItemsResult> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, opts.pageSize ?? DEFAULT_PAGE_SIZE));

  const conds: string[] = [];
  const params: unknown[] = [];

  // 可见性：published 或 approved 的 platform 项目 + 命中团队的 team 项目 + 属于当前用户的 personal 项目。
  const visClauses: string[] = ["(status IN ('published', 'approved') AND scope = 'platform')"];
  let teamParamIndex: number | undefined;
  if (opts.teamId != null) {
    params.push(opts.teamId);
    teamParamIndex = params.length;
    visClauses.push(`(status = 'published' AND scope = 'team' AND origin_team_id = $${teamParamIndex})`);
  }
  if (opts.userId != null && teamParamIndex != null) {
    params.push(opts.userId);
    visClauses.push(
      `(scope = 'personal' AND owner_user_id = $${params.length} AND origin_team_id = $${teamParamIndex})`,
    );
  }
  conds.push("migration_quarantined_at IS NULL");
  conds.push("archived_at IS NULL");
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
  const rows = await query<AiStoreItem>(
    `SELECT ${ITEM_COLS} FROM ai_store_items
     WHERE id = $1
       AND migration_quarantined_at IS NULL
       AND archived_at IS NULL`,
    [id]
  );
  return rows[0];
}

/** 批量取项目详情（单条 WHERE id = ANY($1)，避免调用方逐条 SELECT 的 N+1）。不做可见性过滤。 */
export async function getAiStoreItems(ids: number[]): Promise<AiStoreItem[]> {
  if (ids.length === 0) return [];
  return query<AiStoreItem>(
    `SELECT ${ITEM_COLS} FROM ai_store_items
     WHERE id = ANY($1)
       AND migration_quarantined_at IS NULL
       AND archived_at IS NULL`,
    [ids]
  );
}

/** 拥有者管理列表：用于 Create/Authorized 视图展示自己的草稿、已发布和审核中项目。 */
export async function listOwnedAiStoreItems(ownerUserId: number, originTeamId: number): Promise<AiStoreItem[]> {
  return query<AiStoreItem>(
    `SELECT ${ITEM_COLS} FROM ai_store_items
     WHERE owner_user_id = $1 AND origin_team_id = $2
       AND migration_quarantined_at IS NULL
       AND archived_at IS NULL
     ORDER BY updated_at DESC, id DESC`,
    [ownerUserId, originTeamId]
  );
}

/** 创建 AI Store 项目：F02 的草稿/发布/提交审核都落同一张表。 */
export async function createAiStoreItem(input: AiStoreItemDraftInput): Promise<AiStoreItem> {
  const rows = await query<AiStoreItem>(
    `INSERT INTO ai_store_items
       (type, scope, owner_user_id, origin_team_id, status, name, description, cover, author, tags, examples, config)
     VALUES
       ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
     RETURNING ${ITEM_COLS}`,
    [
      input.type,
      input.scope,
      input.ownerUserId,
      input.originTeamId,
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

/**
 * Owner 或有效授权编辑者可更新内容。来源 Team 永不从输入更新；操作者 Team 只写审计。
 * 授权编辑者不能改变 type/scope/status，避免通过内容编辑扩大资源可见范围。
 */
export async function updateAiStoreItem(
  id: number,
  actorUserId: number,
  actorTeamId: number,
  expectedVersion: number,
  input: AiStoreItemDraftInput
): Promise<AiStoreItem | undefined> {
  const rows = await query<AiStoreItem>(
    `WITH updated AS (
       UPDATE ai_store_items
       SET type = CASE WHEN owner_user_id = $2 THEN $5 ELSE type END,
           scope = CASE WHEN owner_user_id = $2 THEN $6 ELSE scope END,
           status = CASE
             WHEN status IN ('approved', 'published') THEN status
             WHEN owner_user_id = $2 THEN $7
             ELSE status
           END,
           name = $8,
           description = $9,
           cover = $10,
           author = CASE WHEN owner_user_id = $2 THEN $11 ELSE author END,
           tags = $12,
           examples = $13,
           config = $14::jsonb,
           version = version + 1,
           updated_at = now()
       WHERE id = $1 AND version = $4
         AND migration_quarantined_at IS NULL
         AND archived_at IS NULL
         AND (
           owner_user_id = $2 OR EXISTS (
             SELECT 1 FROM ai_store_item_grants g
             WHERE g.item_id = ai_store_items.id AND g.user_id = $2
           )
         )
       RETURNING *
     ),
     audited AS (
       INSERT INTO ai_store_revision_audit
         (item_id, version, action, actor_user_id, actor_team_id, changed_fields)
       SELECT
         id,
         version,
         'content_updated',
         $2,
         $3,
         ARRAY['type', 'scope', 'status', 'name', 'description', 'cover', 'author', 'tags', 'examples', 'config']
       FROM updated
     )
     SELECT ${ITEM_COLS} FROM updated`,
    [
      id,
      actorUserId,
      actorTeamId,
      expectedVersion,
      input.type,
      input.scope,
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

/** 订阅列表专用：保留已归档资源的最小元数据，以便显示“不可用”而不是静默消失。 */
export async function getAiStoreItemForSubscription(id: number): Promise<AiStoreItem | undefined> {
  const rows = await query<AiStoreItem>(
    `SELECT ${ITEM_COLS} FROM ai_store_items
     WHERE id = $1 AND migration_quarantined_at IS NULL`,
    [id]
  );
  return rows[0];
}

/** 仅来源 Team 中的 owner 可软归档；订阅和审计记录保留。 */
export async function archiveAiStoreItem(
  id: number,
  ownerUserId: number,
  originTeamId: number
): Promise<AiStoreItem | undefined> {
  const rows = await query<AiStoreItem>(
    `WITH archived AS (
       UPDATE ai_store_items
       SET archived_at = now(),
           share_enabled = false,
           version = version + 1,
           updated_at = now()
       WHERE id = $1
         AND owner_user_id = $2
         AND origin_team_id = $3
         AND migration_quarantined_at IS NULL
         AND archived_at IS NULL
       RETURNING *
     ),
     audited AS (
       INSERT INTO ai_store_revision_audit
         (item_id, version, action, actor_user_id, actor_team_id, changed_fields)
       SELECT id, version, 'archived', $2, $3, ARRAY['archived_at', 'share_enabled']
       FROM archived
     )
     SELECT ${ITEM_COLS} FROM archived`,
    [id, ownerUserId, originTeamId]
  );
  return rows[0];
}

/**
 * 判断某项目对某用户/团队是否可浏览（纯函数，可单测）：
 * published 或 approved 的 platform 项目恒可见（F04 批准 = 发布到平台，approved 与
 * published 对 Explore 同等可见）；published+team 需 team_id 命中当前团队；
 * personal 需 owner 为当前用户（不要求 published，草稿仅属主可见）。
 */
export function isAiStoreItemVisible(
  item: Pick<AiStoreItem, "status" | "scope" | "owner_user_id" | "team_id">,
  userId: number | undefined,
  teamId: number | null | undefined
): boolean {
  if (item.scope === "platform") return item.status === "published" || item.status === "approved";
  if (item.scope === "team") {
    return (
      item.status === "published" &&
      teamId != null &&
      item.team_id != null &&
      String(item.team_id) === String(teamId)
    );
  }
  if (item.scope === "personal") {
    return (
      userId != null &&
      teamId != null &&
      item.owner_user_id === userId &&
      item.team_id != null &&
      String(item.team_id) === String(teamId)
    );
  }
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

  const conds: string[] = [
    "scope = 'platform'",
    "migration_quarantined_at IS NULL",
    "archived_at IS NULL",
  ];
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
       AND migration_quarantined_at IS NULL
       AND archived_at IS NULL
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

// ---------------------------------------------------------------------------
// P15 F05 — 官方精选（Admin Panel）：仅 scope=platform 且已 APPROVED 的项目可参与精选。
// isFeatured 复用 F04 状态机产出的 APPROVED 集合，与 ai_store_items.featured 字段一一对应
// （该字段由 P11 建表迁移 016_ai_store.sql 引入，供 Explore 侧 `ORDER BY featured DESC` 排序/角标）。
// ---------------------------------------------------------------------------

export interface ListFeaturedCandidateItemsOptions {
  /** 空/undefined = 不筛选 featured；true/false 按精选状态筛选。 */
  featured?: boolean;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface ListFeaturedCandidateItemsResult {
  items: AiStoreItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** 精选页候选列表：只看 scope=platform 且 status=approved（F04 审核通过的集合）。 */
export async function listFeaturedCandidateItems(
  opts: ListFeaturedCandidateItemsOptions = {}
): Promise<ListFeaturedCandidateItemsResult> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 20));

  const conds: string[] = [
    "scope = 'platform'",
    "status = 'approved'",
    "migration_quarantined_at IS NULL",
    "archived_at IS NULL",
  ];
  const params: unknown[] = [];

  if (typeof opts.featured === "boolean") {
    params.push(opts.featured);
    conds.push(`featured = $${params.length}`);
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
     ORDER BY featured DESC, updated_at DESC, id DESC
     LIMIT $${limitParams.length - 1} OFFSET $${limitParams.length}`,
    limitParams
  );

  return { items, total, page, pageSize, totalPages };
}

/**
 * 切换某平台已批准项目的官方精选状态：只允许对 scope=platform 且 status=approved 的
 * 项目生效（未通过审核/已被撤回的项目不该出现在精选候选池，遑论被设为精选）。
 * 用 `WHERE scope='platform' AND status='approved'` 做原子校验+写入一步完成，
 * 不做"先 SELECT 校验再 UPDATE"两步（避免批准状态在此期间被并发撤回/拒绝产生的 TOCTOU）。
 * 目标值与当前值相同时也走同一条 UPDATE（幂等，返回 idempotent=true，不报错）。
 * 未命中（不存在 / 非 platform / 非 approved）返回 undefined，调用方转 409。
 */
export async function setAiStoreItemFeatured(
  id: number,
  featured: boolean
): Promise<{ item: AiStoreItem; idempotent: boolean } | undefined> {
  const before = await getAiStoreItem(id);
  if (!before || before.scope !== "platform" || before.status !== "approved") return undefined;

  const rows = await query<AiStoreItem>(
    `UPDATE ai_store_items
     SET featured = $2, updated_at = now()
     WHERE id = $1 AND scope = 'platform' AND status = 'approved'
       AND migration_quarantined_at IS NULL
       AND archived_at IS NULL
     RETURNING ${ITEM_COLS}`,
    [id, featured]
  );
  const item = rows[0];
  if (!item) return undefined;
  return { item, idempotent: before.featured === featured };
}

// ---------------------------------------------------------------------------
// 喜欢/收藏（P11 F04，uc-ai-store-004）：ai_store_favorites 记录
// (user_id, consumer_team_id, item_id)，
// ai_store_items.likes 是聚合计数缓存；toggle 时同步更新计数，避免和明细表漂移。
// ---------------------------------------------------------------------------

/** 某用户是否已喜欢/收藏该项目。 */
export async function isAiStoreItemFavorited(
  itemId: number,
  userId: number,
  consumerTeamId: number,
): Promise<boolean> {
  const rows = await query<{ one: number }>(
    `SELECT 1 AS one
     FROM ai_store_favorites
     WHERE item_id = $1 AND user_id = $2 AND consumer_team_id = $3`,
    [itemId, userId, consumerTeamId]
  );
  return rows.length > 0;
}

/** 该用户在给定项目集合中已喜欢的 id 集合（供列表页批量标注 liked 状态）。 */
export async function listFavoritedAiStoreItemIds(
  itemIds: number[],
  userId: number,
  consumerTeamId: number,
): Promise<Set<number>> {
  if (itemIds.length === 0) return new Set();
  // item_id 是 bigint，pg 默认把 INT8 当字符串返回；显式 ::int 转换，保证 Set<number> 与类型注解一致。
  const rows = await query<{ item_id: number }>(
    `SELECT item_id::int AS item_id
     FROM ai_store_favorites
     WHERE user_id = $1 AND consumer_team_id = $2 AND item_id = ANY($3)`,
    [userId, consumerTeamId, itemIds]
  );
  return new Set(rows.map((r) => r.item_id));
}

export interface ToggleAiStoreFavoriteResult {
  favorited: boolean;
  likes: number;
}

/**
 * 切换某用户对某项目的喜欢/收藏状态，并同步更新 ai_store_items.likes 聚合计数。
 * 不存在的项目返回 undefined。
 *
 * 并发安全：计数增减用 CTE 与「明细行是否真的插入/删除」绑定——
 * `likes = likes ± (SELECT count(*) FROM ins/del)`。同一 (user,item) 并发两次同方向
 * toggle 时，只有真正命中 INSERT（未撞 ON CONFLICT）/ DELETE（真删到行）的那个请求
 * 才会改计数，另一个请求 count(*)=0，计数 +0，杜绝明细一行、计数 +2 的漂移。
 * 注意：喜欢/收藏不算“内容更新”，故不改 updated_at——否则会扰动 Explore 列表
 * “按 updated_at 倒序”的排序/分页，和内容编辑语义混淆。
 */
export async function toggleAiStoreFavorite(
  itemId: number,
  userId: number,
  consumerTeamId: number,
): Promise<ToggleAiStoreFavoriteResult | undefined> {
  const existing = await getAiStoreItem(itemId);
  if (!existing) return undefined;

  const already = await isAiStoreItemFavorited(itemId, userId, consumerTeamId);
  if (already) {
    const rows = await query<{ likes: number }>(
      `WITH del AS (
         DELETE FROM ai_store_favorites
         WHERE item_id = $1 AND user_id = $2 AND consumer_team_id = $3
         RETURNING 1
       )
       UPDATE ai_store_items
          SET likes = GREATEST(0, likes - (SELECT count(*) FROM del))
        WHERE id = $1
        RETURNING likes`,
      [itemId, userId, consumerTeamId]
    );
    return { favorited: false, likes: rows[0]?.likes ?? 0 };
  }

  const rows = await query<{ likes: number }>(
    `WITH ins AS (
       INSERT INTO ai_store_favorites (item_id, user_id, consumer_team_id) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING RETURNING 1
     )
     UPDATE ai_store_items
        SET likes = likes + (SELECT count(*) FROM ins)
      WHERE id = $1
      RETURNING likes`,
    [itemId, userId, consumerTeamId]
  );
  return { favorited: true, likes: rows[0]?.likes ?? 0 };
}

/** Record one successful, authorized detail view without affecting content ordering. */
export async function incrementAiStoreItemViews(id: number): Promise<AiStoreItem | undefined> {
  const rows = await query<AiStoreItem>(
    `UPDATE ai_store_items
     SET views = views + 1
     WHERE id = $1 AND migration_quarantined_at IS NULL AND archived_at IS NULL
     RETURNING ${ITEM_COLS}`,
    [id],
  );
  return rows[0];
}

// ---------------------------------------------------------------------------
// 分享管理（P11 F05，uc-ai-store-005）：拥有者为项目生成/关闭「管理授权链接」
// （share_token/share_enabled 落在 ai_store_items 上，同一项目同一时刻只有一条有效链接）；
// 被授权协作者打开链接后记录为 grantee（ai_store_item_grants），驱动 Authorized/Shared 视图。
// 关闭分享只让新访问者无法再通过旧链接加入——不清空已授权列表，拥有者需显式移除授权用户。
// ---------------------------------------------------------------------------

export interface AiStoreItemShare {
  item_id: number;
  share_token: string | null;
  share_enabled: boolean;
  share_updated_at: string | null;
}

export interface AiStoreShareGrantee {
  user_id: number;
  email: string;
  display_name: string;
  granted_at: string;
}

const SHARE_COLS = "id AS item_id, share_token, share_enabled, share_updated_at";

export function newAiStoreShareToken(): string {
  return randomBytes(24).toString("base64url");
}

/** 取某项目当前分享状态；不存在返回 undefined。不做鉴权，调用方负责校验属主。 */
export async function getAiStoreItemShare(itemId: number): Promise<AiStoreItemShare | undefined> {
  const rows = await query<AiStoreItemShare>(
    `SELECT ${SHARE_COLS} FROM ai_store_items
     WHERE id = $1
       AND migration_quarantined_at IS NULL
       AND archived_at IS NULL`,
    [itemId]
  );
  return rows[0];
}

/**
 * 开启/重新开启分享：已有有效链接（share_enabled=true）时复用同一 token（A1 分支——
 * 已开启分享时复制的是当前有效链接，不重新生成）；否则新生成一个 token 并开启
 * （A2 分支——关闭后重新复制会重新开启并生成新链接，旧 token 因此彻底失效）。
 */
export async function enableAiStoreItemShare(itemId: number): Promise<AiStoreItemShare | undefined> {
  const existing = await getAiStoreItemShare(itemId);
  if (!existing) return undefined;
  const token = existing.share_enabled && existing.share_token ? existing.share_token : newAiStoreShareToken();
  const rows = await query<AiStoreItemShare>(
    `UPDATE ai_store_items
     SET share_token = $2, share_enabled = true, share_updated_at = now()
     WHERE id = $1 AND archived_at IS NULL
     RETURNING ${SHARE_COLS}`,
    [itemId, token]
  );
  return rows[0];
}

/**
 * 关闭分享：旧链接立即失效（share_enabled=false，token 保留供审计但不再可用于访问校验，
 * 校验统一要求 share_enabled=true）。已授权用户列表不受影响。
 */
export async function disableAiStoreItemShare(itemId: number): Promise<AiStoreItemShare | undefined> {
  const rows = await query<AiStoreItemShare>(
    `UPDATE ai_store_items
     SET share_enabled = false, share_updated_at = now()
     WHERE id = $1 AND archived_at IS NULL
     RETURNING ${SHARE_COLS}`,
    [itemId]
  );
  return rows[0];
}

/**
 * 被授权协作者打开授权链接：token 必须匹配且分享当前处于开启状态，否则拒绝（E3——链接
 * 无效/已下架时访问者应看到不可访问提示）。校验通过后把该用户记录为该项目的 grantee
 * （幂等：重复访问同一有效链接不报错，不重复插入）。返回项目本体供前端跳转到详情/授权视图。
 */
export async function redeemAiStoreItemShare(
  itemId: number,
  shareToken: string,
  userId: number
): Promise<AiStoreItem | undefined> {
  if (!shareToken) return undefined;
  const rows = await query<AiStoreItem>(
    `SELECT ${ITEM_COLS} FROM ai_store_items
     WHERE id = $1 AND share_token = $2 AND share_enabled = true
       AND migration_quarantined_at IS NULL
       AND archived_at IS NULL`,
    [itemId, shareToken]
  );
  const item = rows[0];
  if (!item) return undefined;

  await query(
    `INSERT INTO ai_store_item_grants (item_id, user_id, granted_via_token)
     VALUES ($1, $2, $3)
     ON CONFLICT (item_id, user_id) DO NOTHING`,
    [itemId, userId, shareToken]
  );
  return item;
}

/** 某用户是否已被授权管理该项目（供路由做 grantee 权限判定 + 卡片“已授权”标识）。 */
export async function isAiStoreItemGrantee(itemId: number, userId: number): Promise<boolean> {
  const rows = await query<{ one: number }>(
    `SELECT 1 AS one FROM ai_store_item_grants WHERE item_id = $1 AND user_id = $2`,
    [itemId, userId]
  );
  return rows.length > 0;
}

/**
 * 详情类路由的可访问性判定：isAiStoreItemVisible 的属主规则之外，personal-scope 项目
 * 的已授权 grantee（ai_store_item_grants 有效记录）也应能直接打开详情/收藏等路由——
 * 否则「已授权」列表卡片指向的详情页会 404，和 listAuthorizedAiStoreItems 的可见性语义不一致。
 */
export async function canAccessAiStoreItem(
  item: Pick<AiStoreItem, "id" | "status" | "scope" | "owner_user_id" | "team_id">,
  userId: number | undefined,
  teamId: number | null | undefined
): Promise<boolean> {
  if (isAiStoreItemVisible(item, userId, teamId)) return true;
  if (item.scope !== "personal" || userId == null) return false;
  return isAiStoreItemGrantee(item.id, userId);
}

/** 已授权用户列表（供分享管理弹窗展示，按授权时间正序）。 */
export async function listAiStoreItemGrantees(itemId: number): Promise<AiStoreShareGrantee[]> {
  return query<AiStoreShareGrantee>(
    `SELECT u.id AS user_id, u.email,
            COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS display_name,
            g.created_at AS granted_at
     FROM ai_store_item_grants g
     JOIN users u ON u.id = g.user_id
     WHERE g.item_id = $1
     ORDER BY g.created_at ASC`,
    [itemId]
  );
}

/** 拥有者移除某个已授权用户；返回是否真的删除了一行（供路由判定 404 vs 200）。 */
export async function removeAiStoreItemGrantee(itemId: number, userId: number): Promise<boolean> {
  const rows = await query<{ one: number }>(
    `DELETE FROM ai_store_item_grants WHERE item_id = $1 AND user_id = $2 RETURNING 1`,
    [itemId, userId]
  );
  return rows.length > 0;
}

/** 授权协作者视角的“Authorized”列表：自己被授权管理、且非本人拥有的项目。 */
export async function listAuthorizedAiStoreItems(userId: number): Promise<AiStoreItem[]> {
  return query<AiStoreItem>(
    `SELECT ${ITEM_COLS.split(", ").map((c) => `it.${c}`).join(", ")}
     FROM ai_store_items it
     JOIN ai_store_item_grants g ON g.item_id = it.id
     WHERE g.user_id = $1 AND it.owner_user_id IS DISTINCT FROM $1
       AND it.migration_quarantined_at IS NULL
       AND it.archived_at IS NULL
     ORDER BY g.created_at DESC`,
    [userId]
  );
}

// ---------------------------------------------------------------------------
// 团队审核与精选（P11 F06，uc-ai-store-006）：team-scope 项目提交审核后落
// status=pending；团队管理角色（owner/admin，见 @repo/auth canManageTeam）批准
// （→published，团队内可浏览）、拒绝（→rejected）或撤回已批准项目（→pending）。
// featured 仅对当前已发布的团队项目生效，切换不改变 status。状态机与 p15-F04
// （平台范围审核）共用同一张表/同一组 status 值，作用域用 scope+team_id 区分：
// 本文件的函数一律以 teamId 做 WHERE 约束，避免跨团队越权改到别的团队的项目。
// ---------------------------------------------------------------------------

export type TeamAiStoreReviewAction = "approve" | "reject" | "withdraw";

/** 某团队当前处于 PENDING 审核队列的 team-scope 项目（供团队审核视图列表）。 */
export async function listTeamPendingAiStoreItems(teamId: number): Promise<AiStoreItem[]> {
  return query<AiStoreItem>(
    `SELECT ${ITEM_COLS} FROM ai_store_items
     WHERE scope = 'team' AND origin_team_id = $1 AND status = 'pending'
       AND migration_quarantined_at IS NULL
       AND archived_at IS NULL
     ORDER BY updated_at ASC, id ASC`,
    [teamId]
  );
}

/** 某团队已批准（published）的 team-scope 项目（供精选切换列表）。 */
export async function listTeamApprovedAiStoreItems(teamId: number): Promise<AiStoreItem[]> {
  return query<AiStoreItem>(
    `SELECT ${ITEM_COLS} FROM ai_store_items
     WHERE scope = 'team' AND origin_team_id = $1 AND status = 'published'
       AND migration_quarantined_at IS NULL
       AND archived_at IS NULL
     ORDER BY featured DESC, updated_at DESC, id DESC`,
    [teamId]
  );
}

const REVIEW_ACTION_TARGET: Record<TeamAiStoreReviewAction, AiStoreItemStatus> = {
  approve: "published",
  reject: "rejected",
  withdraw: "pending",
};

const REVIEW_ACTION_FROM: Record<TeamAiStoreReviewAction, AiStoreItemStatus[]> = {
  approve: ["pending"],
  reject: ["pending"],
  withdraw: ["published"],
};

/**
 * 团队管理角色对某 team-scope 项目执行审核动作：批准（pending→published）、
 * 拒绝（pending→rejected）、撤回（published→pending，重新进入待审队列）。
 * 用 WHERE status = ANY(...) 做状态机合法性校验 + 团队越权校验（team_id 绑定）
 * 一次性完成——不满足条件（项目不存在/不属于该团队/当前状态不允许该动作）时
 * UPDATE 影响 0 行，返回 undefined，路由据此判定 404 vs 409。
 */
export async function reviewTeamAiStoreItem(
  itemId: number,
  teamId: number,
  action: TeamAiStoreReviewAction
): Promise<AiStoreItem | undefined> {
  const fromStatuses = REVIEW_ACTION_FROM[action];
  const toStatus = REVIEW_ACTION_TARGET[action];
  const rows = await query<AiStoreItem>(
    `UPDATE ai_store_items
     SET status = $4, updated_at = now()
     WHERE id = $1 AND scope = 'team' AND origin_team_id = $2 AND status = ANY($3)
       AND migration_quarantined_at IS NULL
       AND archived_at IS NULL
     RETURNING ${ITEM_COLS}`,
    [itemId, teamId, fromStatuses, toStatus]
  );
  return rows[0];
}

/**
 * 团队管理角色切换某已批准（published）team-scope 项目的团队精选状态。
 * 只对 published 项目生效（草稿/待审/被拒项目不该出现在精选位）；team_id 绑定
 * 防止越权切别的团队的项目。不存在/不满足条件时返回 undefined（路由判 404）。
 */
export async function setTeamAiStoreItemFeatured(
  itemId: number,
  teamId: number,
  featured: boolean
): Promise<AiStoreItem | undefined> {
  const rows = await query<AiStoreItem>(
    `UPDATE ai_store_items
     SET featured = $3, updated_at = now()
     WHERE id = $1 AND scope = 'team' AND origin_team_id = $2 AND status = 'published'
       AND migration_quarantined_at IS NULL
       AND archived_at IS NULL
     RETURNING ${ITEM_COLS}`,
    [itemId, teamId, featured]
  );
  return rows[0];
}
