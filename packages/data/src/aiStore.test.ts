import { describe, it, expect } from "vitest";
import { isAiStoreItemVisible } from "./aiStore";

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
