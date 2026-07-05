import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { sha256Hex } from "../../src/lib/crypto";

async function seedAgent(id: string, token: string, kind = "worker"): Promise<void> {
  const tokenHash = await sha256Hex(token);
  await env.DB.prepare(
    "INSERT INTO agents (id, kind, areas, token_hash, active, created_at) VALUES (?, ?, ?, ?, 1, ?)"
  )
    .bind(id, kind, null, tokenHash, new Date().toISOString())
    .run();
}

function req(path: string, token: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  return new Request(`http://coord-service.local${path}`, { ...init, headers });
}

describe("claim lifecycle", () => {
  beforeEach(async () => {
    await seedAgent("lifecycle-agent", "lifecycle-token");
  });

  it("claim -> heartbeat -> release happy path", async () => {
    const claimRes = await SELF.fetch(
      req("/claims", "lifecycle-token", {
        method: "POST",
        body: JSON.stringify({ resource_id: "feature:p99/F01", resource_type: "feature" }),
      })
    );
    expect(claimRes.status).toBe(201);
    const { claim } = (await claimRes.json()) as { claim: { id: number; status: string } };
    expect(claim.status).toBe("in_progress");

    const heartbeatRes = await SELF.fetch(
      req(`/claims/${claim.id}/heartbeat`, "lifecycle-token", { method: "POST" })
    );
    expect(heartbeatRes.status).toBe(200);

    const releaseRes = await SELF.fetch(
      req(`/claims/${claim.id}/release`, "lifecycle-token", { method: "POST" })
    );
    expect(releaseRes.status).toBe(200);
    const { claim: released } = (await releaseRes.json()) as { claim: { status: string } };
    expect(released.status).toBe("released");
  });

  it("heartbeat on a claim you don't own is rejected", async () => {
    await seedAgent("other-agent", "other-token");
    const claimRes = await SELF.fetch(
      req("/claims", "lifecycle-token", {
        method: "POST",
        body: JSON.stringify({ resource_id: "feature:p99/F02", resource_type: "feature" }),
      })
    );
    const { claim } = (await claimRes.json()) as { claim: { id: number } };

    const heartbeatRes = await SELF.fetch(
      req(`/claims/${claim.id}/heartbeat`, "other-token", { method: "POST" })
    );
    expect(heartbeatRes.status).toBe(403);
  });

  it("releasing an already-released claim returns a conflict", async () => {
    const claimRes = await SELF.fetch(
      req("/claims", "lifecycle-token", {
        method: "POST",
        body: JSON.stringify({ resource_id: "feature:p99/F03", resource_type: "feature" }),
      })
    );
    const { claim } = (await claimRes.json()) as { claim: { id: number } };
    await SELF.fetch(req(`/claims/${claim.id}/release`, "lifecycle-token", { method: "POST" }));

    const secondRelease = await SELF.fetch(
      req(`/claims/${claim.id}/release`, "lifecycle-token", { method: "POST" })
    );
    expect(secondRelease.status).toBe(409);
  });

  it("claiming an unknown claim id returns 404", async () => {
    const res = await SELF.fetch(req("/claims/999999/heartbeat", "lifecycle-token", { method: "POST" }));
    expect(res.status).toBe(404);
  });
});
