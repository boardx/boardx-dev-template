// p30/F06 follow-up 单测（#807）：findEngineerByGithubLogin 返回判别联合后，
// approvals 的两个消费方必须把"上游目录读面打不通"（502）与"查无此人"（403）
// 区分开——回归 #812 review 建议补的两条断言。
//
// getSessionUser 走 vi.mock 注入固定身份；directory 的 /engineers、/memberships
// 读面走 vi.stubGlobal("fetch", ...) 分别控制成功/失败，不依赖真实 coord-gateway。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV = {
  COORD_GATEWAY_URL: "https://gw.test",
  COORD_API_TOKEN: "api-token",
  COORD_GATEWAY_ADMIN_TOKEN: "admin-token",
};

vi.mock("@/lib/session", () => ({
  getSessionUser: vi.fn(),
}));

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  for (const [k, v] of Object.entries(ENV)) process.env[k] = v;
});

afterEach(() => {
  for (const k of Object.keys(ENV)) delete process.env[k];
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("GET /api/portal/approvals — directory-unreachable vs forbidden", () => {
  it("upstream /engineers 打不通 → 502 error:unreachable（不是 403）", async () => {
    const { getSessionUser } = await import("@/lib/session");
    vi.mocked(getSessionUser).mockResolvedValue({ login: "owner-user", email: null, name: null, avatarUrl: null, via: "oauth" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/engineers")) return jsonRes(500, { error: "internal" });
        if (url.includes("/memberships")) return jsonRes(200, { memberships: [] });
        throw new Error(`unexpected url: ${url}`);
      }),
    );
    const { GET } = await import("../app/api/portal/approvals/route");
    const res = await GET(new Request("https://x/api/portal/approvals?project=demo"));
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("unreachable");
  });

  it("上游可达但查无此人 → 403 forbidden（既有行为不回归）", async () => {
    const { getSessionUser } = await import("@/lib/session");
    vi.mocked(getSessionUser).mockResolvedValue({ login: "stranger", email: null, name: null, avatarUrl: null, via: "oauth" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/engineers")) return jsonRes(200, { engineers: [] });
        if (url.includes("/memberships")) return jsonRes(200, { memberships: [] });
        throw new Error(`unexpected url: ${url}`);
      }),
    );
    const { GET } = await import("../app/api/portal/approvals/route");
    const res = await GET(new Request("https://x/api/portal/approvals?project=demo"));
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("forbidden");
  });
});

describe("POST /api/portal/approvals/:id — directory-unreachable vs forbidden", () => {
  it("upstream /engineers 打不通 → 502 error:directory_unreachable（不是 403）", async () => {
    const { getSessionUser } = await import("@/lib/session");
    vi.mocked(getSessionUser).mockResolvedValue({ login: "owner-user", email: null, name: null, avatarUrl: null, via: "oauth" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/engineers")) return jsonRes(500, { error: "internal" });
        if (url.includes("/memberships")) return jsonRes(200, { memberships: [] });
        throw new Error(`unexpected url: ${url}`);
      }),
    );
    const { POST } = await import("../app/api/portal/approvals/[id]/route");
    const res = await POST(
      new Request("https://x/api/portal/approvals/mem_1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project: "demo", action: "approve" }),
      }),
      { params: { id: "mem_1" } },
    );
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("directory_unreachable");
  });

  it("上游可达但查无此人 → 403 forbidden（既有行为不回归）", async () => {
    const { getSessionUser } = await import("@/lib/session");
    vi.mocked(getSessionUser).mockResolvedValue({ login: "stranger", email: null, name: null, avatarUrl: null, via: "oauth" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/engineers")) return jsonRes(200, { engineers: [] });
        if (url.includes("/memberships")) return jsonRes(200, { memberships: [] });
        throw new Error(`unexpected url: ${url}`);
      }),
    );
    const { POST } = await import("../app/api/portal/approvals/[id]/route");
    const res = await POST(
      new Request("https://x/api/portal/approvals/mem_1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project: "demo", action: "approve" }),
      }),
      { params: { id: "mem_1" } },
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("forbidden");
  });
});
