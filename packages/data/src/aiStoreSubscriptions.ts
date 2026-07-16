// packages/data/src/aiStoreSubscriptions.ts — CAP-DATA AI Store 订阅仓储（P11 F03）
// ai_store_subscriptions：所有订阅都属于 consumer_team_id 指定的当前 Team。
// 独立文件（不改 aiStore.ts 既有代码），降低与同模块并行改动（收藏功能 F04）的冲突面。
import { query } from "./index";
import type { AiStoreItemScope } from "./aiStore";

export type AiStoreSubscriptionScope = "personal" | "team";

export interface AiStoreSubscription {
  id: number;
  item_id: number;
  subscriber_user_id: number;
  consumer_team_id: number;
  /** @deprecated Compatibility alias for existing Web consumers. */
  team_id: number;
  scope: AiStoreSubscriptionScope;
  migration_quarantined_at: string | null;
  created_at: string;
}

const SUB_COLS =
  "id, item_id, subscriber_user_id, consumer_team_id, consumer_team_id AS team_id, scope, migration_quarantined_at, created_at";

/**
 * 订阅一个项目：personal/team 都必须绑定当前 consumer Team。
 * 同一 (item, user, consumer Team, scope) 组合幂等。
 */
export async function subscribeAiStoreItem(params: {
  itemId: number;
  subscriberUserId: number;
  scope: AiStoreSubscriptionScope;
  consumerTeamId: number;
}): Promise<AiStoreSubscription> {
  const inserted = await query<AiStoreSubscription>(
    `INSERT INTO ai_store_subscriptions (item_id, subscriber_user_id, consumer_team_id, scope)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (item_id, subscriber_user_id, consumer_team_id, scope)
       WHERE migration_quarantined_at IS NULL
     DO NOTHING
     RETURNING ${SUB_COLS}`,
    [params.itemId, params.subscriberUserId, params.consumerTeamId, params.scope]
  );
  if (inserted[0]) return inserted[0];

  const existing = await query<AiStoreSubscription>(
    `SELECT ${SUB_COLS} FROM ai_store_subscriptions
     WHERE item_id = $1 AND subscriber_user_id = $2
       AND consumer_team_id = $3 AND scope = $4
       AND migration_quarantined_at IS NULL`,
    [params.itemId, params.subscriberUserId, params.consumerTeamId, params.scope]
  );
  return existing[0]!;
}

/**
 * 取消订阅：严格限定当前 consumer Team，避免切换 Team 后误删另一个 Team 的关系。
 */
export async function unsubscribeAiStoreItem(params: {
  itemId: number;
  subscriberUserId: number;
  consumerTeamId: number;
}): Promise<boolean> {
  const existing = await getAiStoreSubscription({
    itemId: params.itemId,
    subscriberUserId: params.subscriberUserId,
    consumerTeamId: params.consumerTeamId,
  });
  if (!existing) return false;

  const rows = await query<{ id: number }>(
    `DELETE FROM ai_store_subscriptions WHERE id = $1 RETURNING id`,
    [existing.id]
  );
  return rows.length > 0;
}

/** 当前用户在当前团队上下文下，对某项目是否已订阅（个人订阅或该团队的团队订阅）。 */
export async function getAiStoreSubscription(params: {
  itemId: number;
  subscriberUserId: number;
  consumerTeamId: number;
}): Promise<AiStoreSubscription | undefined> {
  const rows = await query<AiStoreSubscription>(
    `SELECT ${SUB_COLS} FROM ai_store_subscriptions
     WHERE item_id = $1 AND subscriber_user_id = $2
       AND consumer_team_id = $3
       AND migration_quarantined_at IS NULL
     ORDER BY (scope = 'team') DESC
     LIMIT 1`,
    [params.itemId, params.subscriberUserId, params.consumerTeamId]
  );
  return rows[0];
}

/** 「已订阅」列表：当前用户的个人订阅 + 当前团队的团队订阅所命中的项目 id 集合。 */
export async function listSubscribedAiStoreItemIds(params: {
  subscriberUserId: number;
  consumerTeamId: number;
}): Promise<number[]> {
  const rows = await query<{ item_id: number }>(
    `SELECT DISTINCT item_id FROM ai_store_subscriptions
     WHERE subscriber_user_id = $1
       AND consumer_team_id = $2
       AND migration_quarantined_at IS NULL`,
    [params.subscriberUserId, params.consumerTeamId]
  );
  return rows.map((r) => r.item_id);
}

/** 判断某 scope 的订阅是否被允许：只有已发布（published）项目才可订阅（草稿/待审/下架不可）。 */
export function canSubscribeAiStoreItem(item: {
  status: string;
  scope: AiStoreItemScope;
}): boolean {
  return item.status === "published";
}
