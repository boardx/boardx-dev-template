import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("public status endpoint", () => {
  it("is reachable without authentication and returns the expected shape", async () => {
    const res = await SELF.fetch("http://coord-service.local/status");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      active_claims: unknown[];
      recent_events: unknown[];
      generated_at: string;
    };
    expect(Array.isArray(body.active_claims)).toBe(true);
    expect(Array.isArray(body.recent_events)).toBe(true);
    expect(typeof body.generated_at).toBe("string");
  });
});

describe("root endpoint", () => {
  it("returns a human-friendly service description instead of not_found", async () => {
    const res = await SELF.fetch("http://coord-service.local/");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { service: string; endpoints: Record<string, string> };
    expect(body.service).toBe("coord-service");
    expect(body.endpoints["GET /status"]).toBeTruthy();
  });
});
