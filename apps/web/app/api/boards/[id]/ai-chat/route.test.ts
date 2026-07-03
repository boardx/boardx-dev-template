import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { getBoard, getBoardAccessRole, listBoardItems } from "@repo/data";
import { currentUser } from "@/lib/session";
import { FORCE_FAIL_MARKER } from "@repo/ai";

// 有意不 mock "@repo/ai"：这里要用真实的 defaultGateway/stubProvider 跑一遍，
// 才能证明「画布便签文字里写 FORCE_FAIL_MARKER 不会再导致网关抛错 500」——
// 如果 mock 掉网关，测试就只是在验证 mock 而不是验证真实的过滤逻辑生效。
vi.mock("@repo/data", () => ({
  getBoard: vi.fn(),
  getBoardAccessRole: vi.fn(),
  listBoardItems: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  currentUser: vi.fn(),
}));

const mockCurrentUser = vi.mocked(currentUser);
const mockGetBoard = vi.mocked(getBoard);
const mockGetBoardAccessRole = vi.mocked(getBoardAccessRole);
const mockListBoardItems = vi.mocked(listBoardItems);

const params = { params: { id: "1" } };

function makeRequest(question: string) {
  return new Request("http://test.local/api/boards/1/ai-chat", {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}

describe("POST /api/boards/:id/ai-chat — 画布内容触发词过滤（code-reviewer 复审修复）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser.mockResolvedValue({ id: 7 } as Awaited<ReturnType<typeof currentUser>>);
    mockGetBoard.mockResolvedValue({ id: 1 } as Awaited<ReturnType<typeof getBoard>>);
    mockGetBoardAccessRole.mockResolvedValue("owner");
  });

  it("画布便签文字里写 FORCE_FAIL_MARKER 不会导致 500（用户内容不能操纵网关内部触发词）", async () => {
    mockListBoardItems.mockResolvedValue([
      { text: `恶意便签 ${FORCE_FAIL_MARKER}`, type: "note" },
    ] as Awaited<ReturnType<typeof listBoardItems>>);

    const res = await POST(makeRequest("总结一下这个画布"), params);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reply).toBeTruthy();
    // 回复里也不应该原样出现触发词（已被过滤掉，不再传给网关）。
    expect(json.reply).not.toContain(FORCE_FAIL_MARKER);
  });

  it("触发词出现在 question 本身（非画布内容）时，仍保留网关原有的确定性失败态", async () => {
    mockListBoardItems.mockResolvedValue([]);

    const res = await POST(makeRequest(`触发失败 ${FORCE_FAIL_MARKER}`), params);

    // 用户在提问框里直接输入触发词属于既有的 e2e 失败态验证路径（F01 notes），
    // 本次修复只过滤「画布 item 文本」这一由协作者写入、非当前提问者控制的内容来源，
    // 不改变直接提问触发失败态的既有行为。
    expect(res.status).toBe(500);
  });

  it("普通画布内容（无触发词）仍然正常拼接进上下文并被网关引用", async () => {
    mockListBoardItems.mockResolvedValue([
      { text: "预算方案-Q3-123456", type: "note" },
    ] as Awaited<ReturnType<typeof listBoardItems>>);

    const res = await POST(makeRequest("总结一下这个画布"), params);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reply).toContain("预算方案-Q3-123456");
  });
});
