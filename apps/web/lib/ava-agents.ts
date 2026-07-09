// apps/web/lib/ava-agents.ts — AVA agent 选项的真实数据源（p18-F09）
//
// agent-select 的选项 = 内置默认 Agent（AVA_AGENT_OPTIONS，无订阅时仍可用）
// + 当前用户/团队在 AI Store 的真实订阅中 type="agent" 的项目。
// 订阅口径完全复用 p11-F03 的数据层（listSubscribedAiStoreItemIds：个人订阅 +
// 当前团队的团队订阅），与 AI Store「已订阅」列表（GET /api/ai-store/items?subscribed=me）
// 保持同一套判定，不在这里重复实现订阅逻辑。
import { AVA_AGENT_OPTIONS, type AvaAgentOption } from "@repo/ai";
import { getAiStoreItem, listSubscribedAiStoreItemIds } from "@repo/data";

// 订阅 Agent 的选项 id 前缀：与内置 id（"default"/"research"）天然隔离，避免碰撞；
// 前端 <select> 的 value / 消息路由的 agentId 校验都用这个带前缀的 id。
export const STORE_AGENT_ID_PREFIX = "store-";

/** 内置默认 Agent + 当前用户/团队已订阅的 AI Store Agent（去重后按 id 升序稳定排序）。 */
export async function listAvaAgentOptions(
  userId: number,
  teamId: number | null
): Promise<AvaAgentOption[]> {
  const subscribedIds = await listSubscribedAiStoreItemIds({
    subscriberUserId: userId,
    teamId,
  });
  const items = (await Promise.all(subscribedIds.map((id) => getAiStoreItem(id)))).filter(
    (it): it is NonNullable<typeof it> => Boolean(it)
  );
  const storeAgents = items
    .filter((it) => it.type === "agent")
    // pg 的 bigint 列运行时按字符串返回（同 ai-store items 路由的已知口径），Number() 归一化。
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((it) => ({
      id: `${STORE_AGENT_ID_PREFIX}${it.id}`,
      label: it.name,
      description: it.description,
    }));
  return [...AVA_AGENT_OPTIONS, ...storeAgents];
}
