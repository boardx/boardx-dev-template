import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { POST } from "./messages/route";
import { currentTeamId, currentUser } from "@/lib/session";
import {
  getAvaThread,
  insertAvaMessage,
  listAvaAttachmentsByMessageIds,
  listAvaMessageFeedbackByMessageIds,
  listAvaMessages,
} from "@repo/data";

vi.mock("@/lib/session", () => ({
  currentUser: vi.fn(),
  currentTeamId: vi.fn(),
}));

vi.mock("@repo/data", () => ({
  deleteAvaThread: vi.fn(),
  getAvaThread: vi.fn(),
  insertAvaMessage: vi.fn(),
  listAvaAttachmentsByMessageIds: vi.fn(),
  listAvaMessageFeedbackByMessageIds: vi.fn(),
  listAvaMessages: vi.fn(),
  renameAvaThread: vi.fn(),
  renameAvaThreadIfDefault: vi.fn(),
  titleFromMessage: vi.fn((text: string) => text.trim()),
  touchAvaThread: vi.fn(),
  updateAvaMessage: vi.fn(),
  attachAvaAttachmentsToMessage: vi.fn(),
}));

vi.mock("@repo/ai", () => ({
  defaultGateway: { streamChat: vi.fn() },
  DEFAULT_MODEL_ID: "test-model",
  makeGenerateNode: vi.fn(),
  runChatGraph: vi.fn(),
}));

const mockCurrentUser = vi.mocked(currentUser);
const mockCurrentTeamId = vi.mocked(currentTeamId);
const mockGetAvaThread = vi.mocked(getAvaThread);
const mockInsertAvaMessage = vi.mocked(insertAvaMessage);
const mockListAvaMessages = vi.mocked(listAvaMessages);
const mockListAvaAttachmentsByMessageIds = vi.mocked(listAvaAttachmentsByMessageIds);
const mockListAvaMessageFeedbackByMessageIds = vi.mocked(listAvaMessageFeedbackByMessageIds);

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

describe("AVA thread team context access checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser.mockResolvedValue(user as Awaited<ReturnType<typeof currentUser>>);
    mockCurrentTeamId.mockReturnValue(100);
    mockGetAvaThread.mockResolvedValue(teamThread);
    mockListAvaMessages.mockResolvedValue([]);
    mockListAvaAttachmentsByMessageIds.mockResolvedValue(new Map());
    mockListAvaMessageFeedbackByMessageIds.mockResolvedValue(new Map());
  });

  it("rejects reading a same-user team thread from another team context", async () => {
    mockCurrentTeamId.mockReturnValue(200);

    const res = await GET(new Request("http://test.local/api/ava/threads/42"), params);

    expect(res.status).toBe(404);
    expect(mockListAvaMessages).not.toHaveBeenCalled();
  });

  it("rejects reading a same-user team thread from personal context", async () => {
    mockCurrentTeamId.mockReturnValue(null);

    const res = await GET(new Request("http://test.local/api/ava/threads/42"), params);

    expect(res.status).toBe(404);
    expect(mockListAvaMessages).not.toHaveBeenCalled();
  });

  it("allows reading a same-user personal thread from personal context", async () => {
    mockCurrentTeamId.mockReturnValue(null);
    mockGetAvaThread.mockResolvedValue({ ...teamThread, team_id: null });

    const res = await GET(new Request("http://test.local/api/ava/threads/42"), params);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ thread: { id: 42, team_id: null }, messages: [] });
  });

  it("rejects appending to a same-user team thread from another team context", async () => {
    mockCurrentTeamId.mockReturnValue(200);

    const res = await POST(
      new Request("http://test.local/api/ava/threads/42/messages", {
        method: "POST",
        body: JSON.stringify({ text: "hello from wrong team" }),
      }),
      params
    );

    expect(res.status).toBe(404);
    expect(mockInsertAvaMessage).not.toHaveBeenCalled();
  });
});
