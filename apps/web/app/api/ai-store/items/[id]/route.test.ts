import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { currentUser } from "@/lib/session";
import {
  canAccessAiStoreItem,
  getAiStoreItem,
  getMembership,
  incrementAiStoreItemViews,
  isAiStoreItemFavorited,
} from "@repo/data";

vi.mock("@/lib/session", () => ({
  currentUser: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({ get: vi.fn(() => ({ value: "7" })) })),
}));

vi.mock("@repo/data", () => ({
  canAccessAiStoreItem: vi.fn(),
  getAiStoreItem: vi.fn(),
  getMembership: vi.fn(),
  incrementAiStoreItemViews: vi.fn(),
  isAiStoreItemFavorited: vi.fn(),
  updateAiStoreItem: vi.fn(),
}));

const mockCurrentUser = vi.mocked(currentUser);
const mockCanAccessAiStoreItem = vi.mocked(canAccessAiStoreItem);
const mockGetAiStoreItem = vi.mocked(getAiStoreItem);
const mockGetMembership = vi.mocked(getMembership);
const mockIncrementAiStoreItemViews = vi.mocked(incrementAiStoreItemViews);
const mockIsAiStoreItemFavorited = vi.mocked(isAiStoreItemFavorited);

const params = { params: { id: "42" } };
const grantee = { id: 6 };
const personalItem = {
  id: 42,
  type: "agent" as const,
  scope: "personal" as const,
  owner_user_id: 5,
  origin_team_id: 7,
  team_id: 7,
  migration_quarantined_at: null,
  version: 1,
  status: "published" as const,
  name: "Owner's item",
  description: "",
  cover: null,
  author: "owner",
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
};

// P11 F05 回归：项目分享授权（ai_store_item_grants）应让 grantee 能直接打开详情路由，
// 而不是仅在「已授权」列表卡片上展示——避免可见性判定和 listAuthorizedAiStoreItems 语义不一致。
describe("GET /api/ai-store/items/[id] — grantee access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser.mockResolvedValue(grantee as Awaited<ReturnType<typeof currentUser>>);
    mockGetAiStoreItem.mockResolvedValue(personalItem);
    mockGetMembership.mockResolvedValue("member");
    mockIncrementAiStoreItemViews.mockResolvedValue({ ...personalItem, views: 1 });
    mockIsAiStoreItemFavorited.mockResolvedValue(false);
  });

  it("已授权的 grantee 能打开非本人拥有的 personal 项目详情", async () => {
    mockCanAccessAiStoreItem.mockResolvedValue(true);

    const res = await GET(new Request("http://test.local/api/ai-store/items/42"), params);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ item: { id: 42, liked: false, views: 1 } });
    expect(mockIncrementAiStoreItemViews).toHaveBeenCalledWith(42);
    expect(mockIsAiStoreItemFavorited).toHaveBeenCalledWith(42, 6, 7);
  });

  it("被移除授权后（grant 已撤销）再次访问返回 404", async () => {
    mockCanAccessAiStoreItem.mockResolvedValue(false);

    const res = await GET(new Request("http://test.local/api/ai-store/items/42"), params);

    expect(res.status).toBe(404);
    expect(mockIncrementAiStoreItemViews).not.toHaveBeenCalled();
    expect(mockIsAiStoreItemFavorited).not.toHaveBeenCalled();
  });
});
