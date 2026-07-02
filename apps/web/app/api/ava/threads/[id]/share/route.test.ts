import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST, DELETE } from "./route";
import { currentTeamId, currentUser } from "@/lib/session";
import { getAvaThread, getAvaThreadShare, enableAvaThreadShare, disableAvaThreadShare } from "@repo/data";

vi.mock("@/lib/session", () => ({
  currentUser: vi.fn(),
  currentTeamId: vi.fn(),
}));

vi.mock("@repo/data", () => ({
  getAvaThread: vi.fn(),
  getAvaThreadShare: vi.fn(),
  enableAvaThreadShare: vi.fn(),
  disableAvaThreadShare: vi.fn(),
}));

const mockCurrentUser = vi.mocked(currentUser);
const mockCurrentTeamId = vi.mocked(currentTeamId);
const mockGetAvaThread = vi.mocked(getAvaThread);
const mockGetAvaThreadShare = vi.mocked(getAvaThreadShare);
const mockEnableAvaThreadShare = vi.mocked(enableAvaThreadShare);
const mockDisableAvaThreadShare = vi.mocked(disableAvaThreadShare);

const params = { params: { id: "42" } };
const user = { id: 7 };
const teamThread = {
  id: 42,
  team_id: 100,
  user_id: 7,
  title: "Team A thread",
  created_at: "2026-07-02T00:00:00.000Z",
  updated_at: "2026-07-02T00:00:00.000Z",
};

describe("AVA thread share team context access checks (#153)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser.mockResolvedValue(user as Awaited<ReturnType<typeof currentUser>>);
    mockCurrentTeamId.mockReturnValue(100);
    mockGetAvaThread.mockResolvedValue(teamThread);
    mockGetAvaThreadShare.mockResolvedValue(undefined);
  });

  it("rejects reading share status for a same-user team thread from another team context", async () => {
    mockCurrentTeamId.mockReturnValue(200);

    const res = await GET(new Request("http://test.local/api/ava/threads/42/share"), params);

    expect(res.status).toBe(404);
    expect(mockGetAvaThreadShare).not.toHaveBeenCalled();
  });

  it("rejects reading share status for a same-user team thread from personal context", async () => {
    mockCurrentTeamId.mockReturnValue(null);

    const res = await GET(new Request("http://test.local/api/ava/threads/42/share"), params);

    expect(res.status).toBe(404);
    expect(mockGetAvaThreadShare).not.toHaveBeenCalled();
  });

  it("rejects enabling share for a same-user thread from another team context", async () => {
    mockCurrentTeamId.mockReturnValue(200);

    const res = await POST(new Request("http://test.local/api/ava/threads/42/share", { method: "POST" }), params);

    expect(res.status).toBe(404);
    expect(mockEnableAvaThreadShare).not.toHaveBeenCalled();
  });

  it("rejects disabling share for a same-user thread from another team context", async () => {
    mockCurrentTeamId.mockReturnValue(200);

    const res = await DELETE(new Request("http://test.local/api/ava/threads/42/share", { method: "DELETE" }), params);

    expect(res.status).toBe(404);
    expect(mockDisableAvaThreadShare).not.toHaveBeenCalled();
  });

  it("allows reading share status for a same-user thread in the matching team context", async () => {
    const res = await GET(new Request("http://test.local/api/ava/threads/42/share"), params);

    expect(res.status).toBe(200);
    expect(mockGetAvaThreadShare).toHaveBeenCalledWith(42);
  });
});
