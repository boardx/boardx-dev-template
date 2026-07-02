// packages/data/src/admin.ts — P15 Admin 后台：平台统计聚合（F01 骨架）
// 范围：只聚合本仓库已有、真实建表的实体（users / teams）。
// AI Store 相关计数依赖 p11（ai_store_items 表尚未落地/仍在并行开发中），
// 因此这里不提供 countAiStoreItems 之类的函数 —— 调用方（apps/web）应使用占位值，
// 并在 UI 上明确标注为"占位"，避免假装已聚合未建成的数据源。

import { query } from "./index";

export interface PlatformStats {
  userCount: number;
  teamCount: number;
}

/** 平台用户总数（真实聚合，来自 users 表）。 */
export async function countUsers(): Promise<number> {
  const rows = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM users");
  return Number(rows[0]?.count ?? 0);
}

/** 平台团队总数（真实聚合，来自 teams 表）。 */
export async function countTeams(): Promise<number> {
  const rows = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM teams");
  return Number(rows[0]?.count ?? 0);
}

/** 后台首页统计摘要：仅包含当前已建表可真实聚合的维度。 */
export async function getPlatformStats(): Promise<PlatformStats> {
  const [userCount, teamCount] = await Promise.all([countUsers(), countTeams()]);
  return { userCount, teamCount };
}
