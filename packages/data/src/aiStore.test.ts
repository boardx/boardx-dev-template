import { describe, it, expect, vi, beforeEach } from "vitest";
import { isAiStoreItemVisible, canAccessAiStoreItem } from "./aiStore";
import { query } from "./index";

vi.mock("./index", () => ({ query: vi.fn() }));
const mockQuery = vi.mocked(query);

// 纯函数单测：可见性判定（真实 DB 交互/分页由 harness verify + docker e2e 覆盖）。
describe("isAiStoreItemVisible", () => {
  it("platform + published 对任何人可见", () => {
    expect(
      isAiStoreItemVisible({ status: "published", scope: "platform", owner_user_id: null, team_id: null }, undefined, undefined)
    ).toBe(true);
  });

  it("platform + draft 不可见", () => {
    expect(
      isAiStoreItemVisible({ status: "draft", scope: "platform", owner_user_id: null, team_id: null }, 1, null)
    ).toBe(false);
  });

  it("team + published 且 team_id 命中当前团队 → 可见", () => {
    expect(
      isAiStoreItemVisible({ status: "published", scope: "team", owner_user_id: null, team_id: 7 }, 1, 7)
    ).toBe(true);
  });

  it("team + published 但 team_id 不命中 → 不可见", () => {
    expect(
      isAiStoreItemVisible({ status: "published", scope: "team", owner_user_id: null, team_id: 7 }, 1, 8)
    ).toBe(false);
  });

  it("team scope 但用户未选团队（teamId 为 null）→ 不可见", () => {
    expect(
      isAiStoreItemVisible({ status: "published", scope: "team", owner_user_id: null, team_id: 7 }, 1, null)
    ).toBe(false);
  });

  it("personal 且 owner 为当前用户 → 可见（草稿也可见）", () => {
    expect(
      isAiStoreItemVisible({ status: "draft", scope: "personal", owner_user_id:5, team_id: null }, 5, null)
    ).toBe(true);
  });

  it("personal 且 owner 非当前用户 → 不可见", () => {
    expect(
      isAiStoreItemVisible({ status: "published", scope: "personal", owner_user_id: 5, team_id: null }, 6, null)
    ).toBe(false);
  });

  it("personal 且未登录（userId undefined）→ 不可见", () => {
    expect(
      isAiStoreItemVisible({ status: "published", scope: "personal", owner_user_id: 5, team_id: null }, undefined, null)
    ).toBe(false);
  });
});

// canAccessAiStoreItem：isAiStoreItemVisible 之外，personal-scope 的已授权 grantee
// （ai_store_item_grants 有效记录）也应能访问详情类路由（P11 F05 分享授权后的可见性一致性）。
describe("canAccessAiStoreItem", () => {
  const personalItem = { id: 42, status: "published" as const, scope: "personal" as const, owner_user_id: 5, team_id: null };

  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("owner 本人始终可访问，不查 grants 表", async () => {
    const ok = await canAccessAiStoreItem(personalItem, 5, null);
    expect(ok).toBe(true);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("已授权的 grantee（ai_store_item_grants 命中）可访问", async () => {
    mockQuery.mockResolvedValueOnce([{ one: 1 }]);
    const ok = await canAccessAiStoreItem(personalItem, 6, null);
    expect(ok).toBe(true);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("ai_store_item_grants"), [42, 6]);
  });

  it("被移除授权的用户（grants 表无记录）不可访问", async () => {
    mockQuery.mockResolvedValueOnce([]);
    const ok = await canAccessAiStoreItem(personalItem, 6, null);
    expect(ok).toBe(false);
  });

  it("非 personal scope 不查 grants 表（授权模型仅适用于 personal 分享）", async () => {
    const teamItem = { id: 43, status: "published" as const, scope: "team" as const, owner_user_id: null, team_id: 7 };
    const ok = await canAccessAiStoreItem(teamItem, 6, 8);
    expect(ok).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
