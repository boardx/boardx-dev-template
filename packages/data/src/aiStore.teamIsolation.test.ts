import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAiStoreItem,
  getAiStoreItem,
  listOwnedAiStoreItems,
  updateAiStoreItem,
} from "./aiStore";
import { subscribeAiStoreItem } from "./aiStoreSubscriptions";
import { query } from "./index";

vi.mock("./index", () => ({ query: vi.fn() }));
const mockQuery = vi.mocked(query);

const draft = {
  type: "agent" as const,
  scope: "personal" as const,
  status: "draft" as const,
  ownerUserId: 11,
  originTeamId: 101,
  name: "Research Agent",
  description: "Researches a topic.",
  author: "Owner",
};

describe("AI Store Team isolation", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("creates every resource with a required origin Team", async () => {
    mockQuery.mockResolvedValueOnce([{ id: 1 }]);

    await createAiStoreItem(draft);

    const [sql, params] = mockQuery.mock.calls[0]!;
    expect(sql).toContain("origin_team_id");
    expect(params).toContain(101);
    expect(sql).not.toContain("migration_quarantined_at)");
  });

  it("lists owned resources only inside the current origin Team", async () => {
    mockQuery.mockResolvedValueOnce([]);

    await listOwnedAiStoreItems(11, 101);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("owner_user_id = $1 AND origin_team_id = $2"),
      [11, 101],
    );
    expect(mockQuery.mock.calls[0]![0]).toContain("migration_quarantined_at IS NULL");
  });

  it("updates content for the owner or a grant without rewriting the source Team", async () => {
    mockQuery.mockResolvedValueOnce([{ id: 1 }]);

    await updateAiStoreItem(1, 11, 101, 1, draft);

    const [sql, params] = mockQuery.mock.calls[0]!;
    expect(sql).toContain("owner_user_id = $2 OR EXISTS");
    expect(sql).toContain("g.item_id = ai_store_items.id");
    expect(sql).toContain("g.user_id = $2");
    expect(sql).toContain("g.consumer_team_id = $3");
    const updateClause = sql.slice(sql.indexOf("SET"), sql.indexOf("WHERE"));
    expect(updateClause).not.toContain("origin_team_id");
    expect(params?.slice(0, 3)).toEqual([1, 11, 101]);
  });

  it("does not return quarantined resources by id", async () => {
    mockQuery.mockResolvedValueOnce([]);

    await getAiStoreItem(1);

    expect(mockQuery.mock.calls[0]![0]).toContain("migration_quarantined_at IS NULL");
    expect(mockQuery.mock.calls[0]![0]).toContain("archived_at IS NULL");
  });

  it("stores personal subscriptions inside a non-null consumer Team", async () => {
    mockQuery.mockResolvedValueOnce([{ id: 9 }]);

    await subscribeAiStoreItem({
      itemId: 1,
      subscriberUserId: 11,
      scope: "personal",
      consumerTeamId: 101,
    });

    const [sql, params] = mockQuery.mock.calls[0]!;
    expect(sql).toContain("consumer_team_id");
    expect(params).toEqual([1, 11, 101, "personal"]);
  });
});
