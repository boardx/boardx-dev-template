// packages/data/src/aiStoreSubscriptions.ts — CAP-DATA AI Store 订阅仓储（P11 F03）
// ai_store_subscriptions：个人订阅（team_id=null）或团队订阅（team_id=当前团队）。
// 独立文件（不改 aiStore.ts 既有代码），降低与同模块并行改动（收藏功能 F04）的冲突面。
import { query } from "./index";
import type { AiStoreItemScope } from "./aiStore";

export type AiStoreSubscriptionScope = "personal" | "team";

export interface AiStoreSubscription {
  id: number;
  item_id: number;
  subscriber_user_id: number;
  team_id: number | null;
  scope: AiStoreSubscriptionScope;
  created_at: string;
}

const SUB_COLS = "id, item_id, subscriber_user_id, team_id, scope, created_at";

/**
 * 订阅一个项目：scope=personal 时 team_id 记为 NULL；scope=team 时 team_id 必须非空
 * （调用方——路由层——负责校验团队订阅权限，如 Team Admin）。
 * 同一 (item, user, team) 组合幂等：已订阅时返回既有记录（ON CONFLICT DO NOTHING + 回查）。
 */
export async function subscribeAiStoreItem(params: {
  itemId: number;
  subscriberUserId: number;
  scope: AiStoreSubscriptionScope;
  teamId?: number | null;
}): Promise<AiStoreSubscription> {
  const teamId = params.scope === "team" ? params.teamId ?? null : null;
  const inserted = await query<AiStoreSubscription>(
    `INSERT INTO ai_store_subscriptions (item_id, subscriber_user_id, team_id, scope)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (item_id, subscriber_user_id, COALESCE(team_id, 0)) DO NOTHING
     RETURNING ${SUB_COLS}`,
    [params.itemId, params.subscriberUserId, teamId, params.scope]
  );
  if (inserted[0]) return inserted[0];

  const existing = await query<AiStoreSubscription>(
    `SELECT ${SUB_COLS} FROM ai_store_subscriptions
     WHERE item_id = $1 AND subscriber_user_id = $2 AND COALESCE(team_id, 0) = COALESCE($3, 0)`,
    [params.itemId, params.subscriberUserId, teamId]
  );
  return existing[0]!;
}

/** 取消订阅：个人或团队订阅都按 (item, user, team) 精确匹配删除。返回是否真的删了一行。 */
export async function unsubscribeAiStoreItem(params: {
  itemId: number;
  subscriberUserId: number;
  teamId?: number | null;
}): Promise<boolean> {
  const teamId = params.teamId ?? null;
  const rows = await query<{ id: number }>(
    `DELETE FROM ai_store_subscriptions
     WHERE item_id = $1 AND subscriber_user_id = $2 AND COALESCE(team_id, 0) = COALESCE($3, 0)
     RETURNING id`,
    [params.itemId, params.subscriberUserId, teamId]
  );
  return rows.length > 0;
}

/** 当前用户在当前团队上下文下，对某项目是否已订阅（个人订阅或该团队的团队订阅）。 */
export async function getAiStoreSubscription(params: {
  itemId: number;
  subscriberUserId: number;
  teamId?: number | null;
}): Promise<AiStoreSubscription | undefined> {
  const rows = await query<AiStoreSubscription>(
    `SELECT ${SUB_COLS} FROM ai_store_subscriptions
     WHERE item_id = $1 AND subscriber_user_id = $2
       AND (team_id IS NULL OR team_id = $3)
     ORDER BY (team_id IS NOT NULL) DESC
     LIMIT 1`,
    [params.itemId, params.subscriberUserId, params.teamId ?? null]
  );
  return rows[0];
}

/** 「已订阅」列表：当前用户的个人订阅 + 当前团队的团队订阅所命中的项目 id 集合。 */
export async function listSubscribedAiStoreItemIds(params: {
  subscriberUserId: number;
  teamId?: number | null;
}): Promise<number[]> {
  const rows = await query<{ item_id: number }>(
    `SELECT DISTINCT item_id FROM ai_store_subscriptions
     WHERE subscriber_user_id = $1
       AND (team_id IS NULL OR team_id = $2)`,
    [params.subscriberUserId, params.teamId ?? null]
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
