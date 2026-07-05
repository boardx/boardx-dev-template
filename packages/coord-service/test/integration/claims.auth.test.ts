import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("claims route auth boundary", () => {
  it("POST /claims without a token is rejected", async () => {
    const res = await SELF.fetch("http://coord-service.local/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resource_id: "role:coord-x", resource_type: "coordinator-role" }),
    });
    expect(res.status).toBe(401);
  });

  it("GET /claims requires no auth", async () => {
    const res = await SELF.fetch("http://coord-service.local/claims");
    expect(res.status).toBe(200);
  });

  it("GET /status requires no auth and is public", async () => {
    const res = await SELF.fetch("http://coord-service.local/status");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("active_claims");
    expect(body).toHaveProperty("recent_events");
  });

  it("POST /verdicts without a reviewer identity is rejected", async () => {
    const res = await SELF.fetch("http://coord-service.local/verdicts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pr_ref: "github:1", reviewer_kind: "rev-code", verdict: "ok" }),
    });
    expect(res.status).toBe(401);
  });
});
