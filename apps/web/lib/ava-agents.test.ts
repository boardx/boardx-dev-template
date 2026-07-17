// apps/web/lib/ava-agents.test.ts — listAvaAgentOptions 订阅查询失败降级（issue #491）
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AVA_AGENT_OPTIONS } from "@repo/ai";
import { getAiStoreItems, listSubscribedAiStoreItemIds } from "@repo/data";
import { listAvaAgentOptions, STORE_AGENT_ID_PREFIX } from "./ava-agents";

vi.mock("@repo/data", () => ({
  getAiStoreItems: vi.fn(),
  listSubscribedAiStoreItemIds: vi.fn(),
}));

const mockListSubscribedAiStoreItemIds = vi.mocked(listSubscribedAiStoreItemIds);
const mockGetAiStoreItems = vi.mocked(getAiStoreItems);

describe("listAvaAgentOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("订阅查询抛错时降级返回内置默认 Agent，不抛异常", async () => {
    mockListSubscribedAiStoreItemIds.mockRejectedValue(new Error("db connection lost"));

    const result = await listAvaAgentOptions(1, 7);

    expect(result).toEqual(AVA_AGENT_OPTIONS);
    expect(mockGetAiStoreItems).not.toHaveBeenCalled();
    // 真实错误落服务端日志，但不能把原始错误文本泄漏给调用方（返回值里不含它）。
    expect(console.error).toHaveBeenCalled();
  });

  it("项目详情批量查询抛错时同样降级返回内置默认 Agent", async () => {
    mockListSubscribedAiStoreItemIds.mockResolvedValue([42]);
    mockGetAiStoreItems.mockRejectedValue(new Error("query timeout"));

    const result = await listAvaAgentOptions(1, 7);

    expect(result).toEqual(AVA_AGENT_OPTIONS);
    expect(console.error).toHaveBeenCalled();
  });

  it("happy path：订阅查询成功时仍返回内置 + 已订阅的 store agent", async () => {
    mockListSubscribedAiStoreItemIds.mockResolvedValue([7]);
    mockGetAiStoreItems.mockResolvedValue([
      {
        id: 7,
        type: "agent",
        scope: "platform",
        owner_user_id: null,
        origin_team_id: 7,
        team_id: 7,
        migration_quarantined_at: null,
        version: 1,
        status: "published",
        name: "Store Agent",
        description: "a subscribed agent",
        cover: null,
        author: "someone",
        tags: [],
        examples: [],
        config: {},
        likes: 0,
        views: 0,
        featured: false,
        allow_copy: false,
        copied_from_item_id: null,
        copied_from_version: null,
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      },
    ]);

    const result = await listAvaAgentOptions(1, 7);

    expect(result).toEqual([
      ...AVA_AGENT_OPTIONS,
      {
        id: `${STORE_AGENT_ID_PREFIX}7`,
        label: "Store Agent",
        description: "a subscribed agent",
        version: 1,
        config: {},
      },
    ]);
  });
});
