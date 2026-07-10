import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { currentUser } from "@/lib/session";

vi.mock("@/lib/session", () => ({ currentUser: vi.fn() }));
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(async () => "agents:\n  - id: coord-architecture\n  - id: coord-main\n"),
}));

const mockCurrentUser = vi.mocked(currentUser);

const COMMENTS = [
  { user: { login: "usamshen" }, created_at: "2026-07-09T10:00:00Z", html_url: "https://gh/1",
    body: "【coord-architecture 巡检】双租约新鲜，无新风险。" },
  { user: { login: "usamshen" }, created_at: "2026-07-09T09:00:00Z", html_url: "https://gh/2",
    body: "staging 即生产；27 个 worker token 授权轮换。" },
  { user: { login: "usamshen" }, created_at: "2026-07-09T08:00:00Z", html_url: "https://gh/3",
    body: "是否引入并发 worktree 上限——需要人类拍板。" },
];

describe("GET /api/portal/discussions", () => {
  beforeEach(() => {
    mockCurrentUser.mockResolvedValue({ id: 1 } as Awaited<ReturnType<typeof currentUser>>);
    delete process.env["GITHUB_TOKEN"];
    delete process.env["GITHUB_REPO"];
    process.env["PORTAL_NARRATIVE_ISSUES"] = "323";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("未登录 401", async () => {
    mockCurrentUser.mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof currentUser>>);
    expect((await GET()).status).toBe(401);
  });

  it("未配置 GITHUB_TOKEN → configured:false（200，合法中间态）", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ configured: false });
  });

  it("聚合评论：正文标记识别 agent（🤖）、GitHub 账号名回退人类（👤）、needs_human 计数", async () => {
    process.env["GITHUB_TOKEN"] = "t";
    process.env["GITHUB_REPO"] = "boardx/boardx-dev-template";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(COMMENTS), { status: 200 })));
    const body = await (await GET()).json();
    expect(body.configured).toBe(true);
    const byWho = Object.fromEntries(body.items.map((i: { who: string; isAgent: boolean }) => [i.who, i.isAgent]));
    expect(byWho["coord-architecture"]).toBe(true);  // 正文【coord-architecture】→ agent
    expect(byWho["usamshen"]).toBe(false);           // 无标记 → 人类
    expect(body.needs_human_count).toBe(1);          // "需要人类拍板" 命中一条
  });

  it("GitHub 不可达 → 空聚合而非 5xx（单源失败不拖垮）", async () => {
    process.env["GITHUB_TOKEN"] = "t";
    process.env["GITHUB_REPO"] = "boardx/boardx-dev-template";
    process.env["PORTAL_NARRATIVE_ISSUES"] = "999"; // 不同配置指纹 → 不吃上一用例的缓存
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("net down"); }));
    const body = await (await GET()).json();
    expect(body.configured).toBe(true);
    expect(body.items).toEqual([]);
    expect(body.needs_human_count).toBe(0);
  });
});
