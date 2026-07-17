// apps/web/lib/ava-agents.ts — AVA agent 选项的真实数据源（p18-F09）
//
// agent-select 的选项 = 内置默认 Agent（AVA_AGENT_OPTIONS，无订阅时仍可用）
// + 当前用户/团队在 AI Store 的真实订阅中 type="agent" 的项目。
// 订阅口径完全复用 p11-F03 的数据层（listSubscribedAiStoreItemIds：个人订阅 +
// 当前团队的团队订阅），与 AI Store「已订阅」列表（GET /api/ai-store/items?subscribed=me）
// 保持同一套判定，不在这里重复实现订阅逻辑。
import { AVA_AGENT_OPTIONS, type AvaAgentOption } from "@repo/ai";
import { getAiStoreItems, listSubscribedAiStoreItemIds } from "@repo/data";

// 订阅 Agent 的选项 id 前缀：与内置 id（"default"/"research"）天然隔离，避免碰撞；
// 前端 <select> 的 value / 消息路由的 agentId 校验都用这个带前缀的 id。
export const STORE_AGENT_ID_PREFIX = "store-";

/**
 * 内置默认 Agent + 当前用户/团队已订阅的 AI Store Agent（去重后按 id 升序稳定排序）。
 *
 * 订阅查询（或后续的项目详情批量查询）失败时（DB 抖动等）降级为仅返回内置默认 Agent，
 * 不让异常冒泡——agent 选择器至少要能用内置项，不能因为订阅查询挂了整个 capabilities
 * 端点跟着 500（issue #491）。错误详情只落服务端日志，不透出给客户端。
 */
export async function listAvaAgentOptions(
  userId: number,
  teamId: number | null
): Promise<AvaAgentOption[]> {
  try {
    if (teamId == null) return [...AVA_AGENT_OPTIONS];
    const subscribedIds = await listSubscribedAiStoreItemIds({
      subscriberUserId: userId,
      consumerTeamId: teamId,
    });
    // 批量取详情（WHERE id = ANY($1)），避免逐条 SELECT 的 N+1。
    const items = await getAiStoreItems(subscribedIds);
    const storeAgents = items
      .filter((it) => it.type === "agent")
      // pg 的 bigint 列运行时按字符串返回（同 ai-store items 路由的已知口径），Number() 归一化。
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map((it) => ({
        id: `${STORE_AGENT_ID_PREFIX}${it.id}`,
        label: it.name,
        description: it.description,
        version: it.version,
        config: it.config,
      }));
    return [...AVA_AGENT_OPTIONS, ...storeAgents];
  } catch (err) {
    console.error(
      "[ava-agents] listAvaAgentOptions: AI Store 订阅查询失败，降级为内置默认 Agent",
      err
    );
    return [...AVA_AGENT_OPTIONS];
  }
}
