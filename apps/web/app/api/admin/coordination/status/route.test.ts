import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { requireSysAdmin } from "@/lib/admin";

vi.mock("@/lib/admin", () => ({
  requireSysAdmin: vi.fn(),
}));

const mockRequireSysAdmin = vi.mocked(requireSysAdmin);

const GATEWAY_ENV = ["COORD_GATEWAY_URL", "COORD_API_TOKEN", "COORD_REPO"] as const;

function clearEnv() {
  for (const k of GATEWAY_ENV) delete process.env[k];
}

function setEnv() {
  process.env["COORD_GATEWAY_URL"] = "https://gw.example";
  process.env["COORD_API_TOKEN"] = "test-token";
  process.env["COORD_REPO"] = "boardx/boardx-dev-template";
}

describe("GET /api/admin/coordination/status", () => {
  beforeEach(() => {
    mockRequireSysAdmin.mockResolvedValue({ ok: true } as Awaited<ReturnType<typeof requireSysAdmin>>);
    clearEnv();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearEnv();
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

  it("returns configured:false (200) when gateway env is unset — legitimate deployment state, not an error", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ configured: false });
  });

  it("aggregates gateway /claims + /events into the active_claims/recent_events contract (auth header attached)", async () => {
    setEnv();
    const lease = { lease_id: "ls_1", resource_id: "role:coord-main", agent_id: "coord-main" };
    const events = [
      { event_id: "evt_1", type: "claim" },
      { event_id: "evt_2", type: "release" },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      expect((init?.headers as Record<string, string>)["Authorization"]).toBe("Bearer test-token");
      if (url === "https://gw.example/api/coord/repos/boardx/boardx-dev-template/claims") {
        return new Response(JSON.stringify({ leases: [lease] }), { status: 200 });
      }
      if (url === "https://gw.example/api/coord/repos/boardx/boardx-dev-template/events?limit=500") {
        return new Response(JSON.stringify({ events }), { status: 200 });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configured).toBe(true);
    expect(body.active_claims).toEqual([lease]);
    // 升序存储 → 响应里新的在前
    expect(body.recent_events.map((e: { event_id: string }) => e.event_id)).toEqual(["evt_2", "evt_1"]);
    expect(typeof body.generated_at).toBe("string");
  });

  it("502 when upstream returns non-ok", async () => {
    setEnv();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
    const res = await GET();
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("coord_gateway_unavailable");
  });

  it("502 when upstream fetch throws (network failure / timeout)", async () => {
    setEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("fetch failed");
      })
    );
    const res = await GET();
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("coord_gateway_unavailable");
  });
});
