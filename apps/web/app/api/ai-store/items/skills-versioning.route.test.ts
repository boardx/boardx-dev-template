import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { PATCH } from "./[id]/route";
import { currentUser } from "@/lib/session";
import {
  createAiStoreItem,
  getAiStoreItem,
  getMembership,
  updateAiStoreItem,
} from "@repo/data";

vi.mock("@/lib/session", () => ({
  currentUser: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({ get: vi.fn(() => ({ value: "7" })) })),
}));

vi.mock("@repo/data", () => ({
  canAccessAiStoreItem: vi.fn(),
  createAiStoreItem: vi.fn(),
  getAiStoreItem: vi.fn(),
  getMembership: vi.fn(),
  isAiStoreItemFavorited: vi.fn(),
  listAiStoreItems: vi.fn(),
  listAuthorizedAiStoreItems: vi.fn(),
  listFavoritedAiStoreItemIds: vi.fn(),
  listOwnedAiStoreItems: vi.fn(),
  listSubscribedAiStoreItemIds: vi.fn(),
  normalizeAiStoreItemType: vi.fn((value: string) => {
    if (value === "image-tool") return { type: "skill", skillKind: "image" };
    if (value === "ai-tool") return { type: "skill", skillKind: "text" };
    if (value === "agent" || value === "skill" || value === "template") {
      return { type: value };
    }
    return undefined;
  }),
  updateAiStoreItem: vi.fn(),
}));

const mockCurrentUser = vi.mocked(currentUser);
const mockCreateAiStoreItem = vi.mocked(createAiStoreItem);
const mockGetAiStoreItem = vi.mocked(getAiStoreItem);
const mockGetMembership = vi.mocked(getMembership);
const mockUpdateAiStoreItem = vi.mocked(updateAiStoreItem);

const user = {
  id: 11,
  email: "owner@example.com",
  display_name: "Owner",
  first_name: "",
  last_name: "",
};

const existing = {
  id: 42,
  type: "skill" as const,
  scope: "platform" as const,
  owner_user_id: 11,
  origin_team_id: 7,
  team_id: 7,
  migration_quarantined_at: null,
  version: 4,
  status: "approved" as const,
  name: "Image Skill",
  description: "Creates images.",
  cover: null,
  author: "Owner",
  tags: [],
  examples: [],
  config: { instructions: "Create an image", skillKind: "image" },
  likes: 0,
  views: 0,
  featured: false,
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
};

function payload(type: string, expectedVersion?: number) {
  return {
    type,
    skillKind: "image",
    scope: "personal",
    action: "draft",
    name: "Image Skill",
    description: "Creates images.",
    config: "Create an image",
    expectedVersion,
  };
}

describe("AI Store Skills/version routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser.mockResolvedValue(user as Awaited<ReturnType<typeof currentUser>>);
    mockGetMembership.mockResolvedValue("owner");
  });

  it("accepts a legacy image-tool input but writes a canonical image Skill", async () => {
    mockCreateAiStoreItem.mockResolvedValue(existing);

    const res = await POST(new Request("http://test.local/api/ai-store/items", {
      method: "POST",
      body: JSON.stringify(payload("image-tool")),
    }));

    expect(res.status).toBe(201);
    expect(mockCreateAiStoreItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "skill",
        originTeamId: 7,
        config: expect.objectContaining({ skillKind: "image" }),
      }),
    );
  });

  it("returns 409 before writing when expectedVersion is stale", async () => {
    mockGetAiStoreItem.mockResolvedValue(existing);

    const res = await PATCH(
      new Request("http://test.local/api/ai-store/items/42", {
        method: "PATCH",
        body: JSON.stringify(payload("skill", 3)),
      }),
      { params: { id: "42" } },
    );

    expect(res.status).toBe(409);
    expect(mockUpdateAiStoreItem).not.toHaveBeenCalled();
  });
});
