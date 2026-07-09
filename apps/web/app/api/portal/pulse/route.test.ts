import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { currentUser } from "@/lib/session";

vi.mock("@/lib/session", () => ({ currentUser: vi.fn() }));
vi.mock("node:fs/promises", () => ({
  readdir: vi.fn(async () => [{ name: "phase-p23-developer-portal", isDirectory: () => true }]),
  readFile: vi.fn(async () =>
    JSON.stringify({ phase: "p23", features: [{ status: "passing" }, { status: "in_progress" }] })
  ),
}));

const mockCurrentUser = vi.mocked(currentUser);

describe("GET /api/portal/pulse", () => {
  beforeEach(() => {
    mockCurrentUser.mockResolvedValue({ id: 1 } as Awaited<ReturnType<typeof currentUser>>);
    delete process.env["COORD_SERVICE_URL"];
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

  it("phases 本地聚合永远可用；coord/github 未配置 → configured:false（合法中间态非错误）", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.phases.totals).toEqual({ passing: 1, total: 2 });
    expect(body.coord).toEqual({ configured: false });
    expect(body.github).toEqual({ configured: false });
  });

  it("coord-service 不可达 → 仅 coord 降级为 error，phases 不受拖垮", async () => {
    process.env["COORD_SERVICE_URL"] = "https://coord.example";
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("boom"); }));
    const body = await (await GET()).json();
    expect(body.coord).toEqual({ configured: true, error: "unreachable" });
    expect(body.phases.totals.total).toBe(2); // 互不拖垮
  });
});
