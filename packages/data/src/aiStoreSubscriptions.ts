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

export interface AiStoreSubscriptionResult {
  subscription: AiStoreSubscription;
  created: boolean;
}

export interface AiStoreSubscriptionAvailability {
  personal: AiStoreSubscription | null;
  team: AiStoreSubscription | null;
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
}): Promise<AiStoreSubscriptionResult> {
  const conflictTarget = params.scope === "team"
    ? "(item_id, consumer_team_id) WHERE scope = 'team' AND migration_quarantined_at IS NULL"
    : "(item_id, subscriber_user_id, consumer_team_id) WHERE scope = 'personal' AND migration_quarantined_at IS NULL";
  const inserted = await query<AiStoreSubscription>(
    `INSERT INTO ai_store_subscriptions (item_id, subscriber_user_id, consumer_team_id, scope)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT ${conflictTarget}
     DO NOTHING
     RETURNING ${SUB_COLS}`,
    [params.itemId, params.subscriberUserId, params.consumerTeamId, params.scope]
  );
  if (inserted[0]) return { subscription: inserted[0], created: true };

  const existing = await query<AiStoreSubscription>(
    `SELECT ${SUB_COLS} FROM ai_store_subscriptions
     WHERE item_id = $1
       AND consumer_team_id = $3 AND scope = $4
       AND ($4 = 'team' OR subscriber_user_id = $2)
       AND migration_quarantined_at IS NULL`,
    [params.itemId, params.subscriberUserId, params.consumerTeamId, params.scope]
  );
  return { subscription: existing[0]!, created: false };
}

/**
 * 取消订阅：严格限定当前 consumer Team，避免切换 Team 后误删另一个 Team 的关系。
 */
export async function unsubscribeAiStoreItem(params: {
  itemId: number;
  subscriberUserId: number;
  consumerTeamId: number;
  scope: AiStoreSubscriptionScope;
}): Promise<boolean> {
  const rows = await query<{ id: number }>(
    `DELETE FROM ai_store_subscriptions
     WHERE item_id = $1 AND consumer_team_id = $3 AND scope = $4
       AND ($4 = 'team' OR subscriber_user_id = $2)
       AND migration_quarantined_at IS NULL
     RETURNING id`,
    [params.itemId, params.subscriberUserId, params.consumerTeamId, params.scope]
  );
  return rows.length > 0;
}

/** Return both scopes available to this user in the current consumer Team. */
export async function getAiStoreSubscriptionAvailability(params: {
  itemId: number;
  subscriberUserId: number;
  consumerTeamId: number;
}): Promise<AiStoreSubscriptionAvailability> {
  const rows = await query<AiStoreSubscription>(
    `SELECT ${SUB_COLS} FROM ai_store_subscriptions
     WHERE item_id = $1 AND consumer_team_id = $3
       AND ((scope = 'personal' AND subscriber_user_id = $2) OR scope = 'team')
       AND migration_quarantined_at IS NULL
     ORDER BY (scope = 'team') DESC`,
    [params.itemId, params.subscriberUserId, params.consumerTeamId]
  );
  return {
    personal: rows.find((row) => row.scope === "personal") ?? null,
    team: rows.find((row) => row.scope === "team") ?? null,
  };
}

/** 当前用户在当前团队上下文下，对某项目是否已订阅（个人订阅或该团队的团队订阅）。 */
export async function getAiStoreSubscription(params: {
  itemId: number;
  subscriberUserId: number;
  consumerTeamId: number;
}): Promise<AiStoreSubscription | undefined> {
  const availability = await getAiStoreSubscriptionAvailability(params);
  return availability.team ?? availability.personal ?? undefined;
}

/** Rows that make resources available to a user in the current consumer Team. */
export async function listAiStoreSubscriptions(params: {
  subscriberUserId: number;
  consumerTeamId: number;
}): Promise<AiStoreSubscription[]> {
  return query<AiStoreSubscription>(
    `SELECT ${SUB_COLS} FROM ai_store_subscriptions
     WHERE consumer_team_id = $2
       AND ((scope = 'personal' AND subscriber_user_id = $1) OR scope = 'team')
       AND migration_quarantined_at IS NULL
     ORDER BY created_at DESC`,
    [params.subscriberUserId, params.consumerTeamId]
  );
}

/** 「已订阅」列表：当前用户的个人订阅 + 当前团队的团队订阅所命中的项目 id 集合。 */
export async function listSubscribedAiStoreItemIds(params: {
  subscriberUserId: number;
  consumerTeamId: number;
}): Promise<number[]> {
  const rows = await listAiStoreSubscriptions(params);
  return [...new Set(rows.map((row) => Number(row.item_id)))];
}

/** 判断某 scope 的订阅是否被允许：只有已发布（published）项目才可订阅（草稿/待审/下架不可）。 */
export function canSubscribeAiStoreItem(item: {
  status: string;
  scope: AiStoreItemScope;
}): boolean {
  return item.status === "published" || (item.scope === "platform" && item.status === "approved");
}
