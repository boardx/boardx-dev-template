import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { currentUser } from "@/lib/session";

vi.mock("@/lib/session", () => ({ currentUser: vi.fn() }));

const mockCurrentUser = vi.mocked(currentUser);

const OPEN_PRS = [
  { number: 478, title: "lock/module-lock 续约语义", html_url: "https://gh/pr/478", draft: false,
    created_at: "2026-07-09T00:00:00Z", updated_at: "2026-07-09T00:10:00Z" },
  { number: 497, title: "Portal UI 原型", html_url: "https://gh/pr/497", draft: true,
    created_at: "2026-07-09T09:00:00Z", updated_at: "2026-07-09T10:00:00Z" },
];

describe("GET /api/portal/prs", () => {
  beforeEach(() => {
    mockCurrentUser.mockResolvedValue({ id: 1 } as Awaited<ReturnType<typeof currentUser>>);
    delete process.env["GITHUB_TOKEN"];
    delete process.env["GITHUB_REPO"];
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("未登录 401", async () => {
    mockCurrentUser.mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof currentUser>>);
    expect((await GET()).status).toBe(401);
  });

  it("未配置 GITHUB_TOKEN/GITHUB_REPO → configured:false（200，合法中间态非错误）", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ configured: false });
  });

  it("open PR 列表映射：number/title/url/draft/created_at/updated_at", async () => {
    process.env["GITHUB_TOKEN"] = "t";
    process.env["GITHUB_REPO"] = "boardx/boardx-dev-template";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(OPEN_PRS), { status: 200 })));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configured).toBe(true);
    expect(body.items).toHaveLength(2);
    expect(body.items[0]).toEqual({
      number: 478,
      title: "lock/module-lock 续约语义",
      url: "https://gh/pr/478",
      draft: false,
      created_at: "2026-07-09T00:00:00Z",
      updated_at: "2026-07-09T00:10:00Z",
    });
    expect(body.items[1].draft).toBe(true);
  });

  it("GitHub 不可达 → configured:true + error（降级不 5xx，互不拖垮）", async () => {
    process.env["GITHUB_TOKEN"] = "t";
    process.env["GITHUB_REPO"] = "boardx/other-repo"; // 不同配置指纹 → 不吃上一用例的缓存
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("net down"); }));
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ configured: true, error: "unreachable" });
  });

  it("上游非 2xx → upstream_<status>（降级不 5xx）", async () => {
    process.env["GITHUB_TOKEN"] = "t";
    process.env["GITHUB_REPO"] = "boardx/third-repo"; // 不同配置指纹避开缓存
    vi.stubGlobal("fetch", vi.fn(async () => new Response("rate limited", { status: 403 })));
    const body = await (await GET()).json();
    expect(body).toEqual({ configured: true, error: "upstream_403" });
  });
});
