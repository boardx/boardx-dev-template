import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { requireSysAdmin } from "@/lib/admin";

vi.mock("@/lib/admin", () => ({
  requireSysAdmin: vi.fn(),
}));

const mockRequireSysAdmin = vi.mocked(requireSysAdmin);

describe("GET /api/admin/coordination/status", () => {
  beforeEach(() => {
    mockRequireSysAdmin.mockResolvedValue({ ok: true } as Awaited<ReturnType<typeof requireSysAdmin>>);
    delete process.env["COORD_SERVICE_URL"];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env["COORD_SERVICE_URL"];
  });

  it("401 for unauthenticated", async () => {
    mockRequireSysAdmin.mockResolvedValue({ ok: false, reason: "unauthenticated" } as Awaited<
      ReturnType<typeof requireSysAdmin>
    >);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("403 for non-sysadmin", async () => {
    mockRequireSysAdmin.mockResolvedValue({ ok: false, reason: "forbidden" } as Awaited<
      ReturnType<typeof requireSysAdmin>
    >);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns configured:false (200) when COORD_SERVICE_URL is unset — legitimate deployment state, not an error", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ configured: false });
  });

  it("proxies upstream /status and marks configured:true", async () => {
    process.env["COORD_SERVICE_URL"] = "https://coord.example";
    const upstream = {
      active_claims: [{ id: 1, resource_id: "role:coord-main", agent_id: "coord-main" }],
      recent_events: [],
      generated_at: "2026-07-08T00:00:00Z",
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

  it("502 when upstream returns non-ok", async () => {
    process.env["COORD_SERVICE_URL"] = "https://coord.example";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
    const res = await GET();
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("coord_service_unavailable");
  });

  it("502 when upstream fetch throws (network failure / timeout)", async () => {
    process.env["COORD_SERVICE_URL"] = "https://coord.example";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("fetch failed");
      })
    );
    const res = await GET();
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("coord_service_unavailable");
  });
});
