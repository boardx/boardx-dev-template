import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { currentUser } from "@/lib/session";

vi.mock("@/lib/session", () => ({ currentUser: vi.fn() }));

const mockCurrentUser = vi.mocked(currentUser);

describe("GET /api/portal/coordination", () => {
  beforeEach(() => {
    mockCurrentUser.mockResolvedValue({ id: 1 } as Awaited<ReturnType<typeof currentUser>>);
    delete process.env["COORD_SERVICE_URL"];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env["COORD_SERVICE_URL"];
  });

  it("未登录 401（登录即可，不要求 SysAdmin）", async () => {
    mockCurrentUser.mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof currentUser>>);
    expect((await GET()).status).toBe(401);
  });

  it("未配置 COORD_SERVICE_URL → configured:false（200，合法中间态）", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ configured: false });
  });

  it("代理上游 /status：透传完整 active_claims + recent_events 并标 configured:true", async () => {
    process.env["COORD_SERVICE_URL"] = "https://coord.example";
    const upstream = {
      active_claims: [
        { id: 1, resource_id: "role:coord-main", agent_id: "coord-main", last_heartbeat_at: "2026-07-09T10:00:00Z", ttl_seconds: 21600 },
      ],
      recent_events: [{ id: 9, type: "expire", resource_id: "role:coord-main", agent_id: "coord-main", at: "2026-07-08T00:00:00Z" }],
      generated_at: "2026-07-09T10:00:30Z",
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("https://coord.example/status");
      return new Response(JSON.stringify(upstream), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ configured: true, ...upstream });
  });

  it("上游非 2xx → 502 coord_service_unavailable", async () => {
    process.env["COORD_SERVICE_URL"] = "https://coord.example";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    const res = await GET();
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("coord_service_unavailable");
  });

  it("上游网络失败 → 502（不抛未捕获异常）", async () => {
    process.env["COORD_SERVICE_URL"] = "https://coord.example";
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("net down"); }));
    const res = await GET();
    expect(res.status).toBe(502);
  });
});
