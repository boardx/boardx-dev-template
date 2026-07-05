import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { sha256Hex } from "../../src/lib/crypto";

const N = 20;

async function seedAgent(id: string, token: string): Promise<void> {
  const tokenHash = await sha256Hex(token);
  await env.DB.prepare(
    "INSERT INTO agents (id, kind, areas, token_hash, active, created_at) VALUES (?, ?, ?, ?, 1, ?)"
  )
    .bind(id, "worker", null, tokenHash, new Date().toISOString())
    .run();
}

function claimRequest(token: string, body: Record<string, unknown>): Request {
  return new Request("http://coord-service.local/claims", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * This is the test that validates the entire reason this package exists: a D1
 * partial unique index gives a real atomic compare-and-swap that a GitHub label
 * add/remove never could. See AGENTS.md and src/db/queries.ts insertClaim.
 */
describe("claims concurrency - the core correctness property", () => {
  beforeEach(async () => {
    for (let i = 0; i < N; i++) {
      await seedAgent(`test-agent-${i}`, `token-${i}`);
    }
  });

  it("exactly one of N concurrent claims on the same resource_id succeeds", async () => {
    const requests = Array.from({ length: N }, (_, i) =>
      claimRequest(`token-${i}`, { resource_id: "role:coord-main", resource_type: "coordinator-role" })
    );

    const responses = await Promise.all(requests.map((r) => SELF.fetch(r)));
    const statuses = responses.map((r) => r.status);

    expect(statuses.filter((s) => s === 201).length).toBe(1);
    expect(statuses.filter((s) => s === 409).length).toBe(N - 1);

    // Verified independently of what the HTTP layer reported, against the DB directly —
    // a miscounting bug in one layer can't hide behind the other this way.
    const row = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM claims WHERE resource_id = ? AND status = 'in_progress'"
    )
      .bind("role:coord-main")
      .first<{ count: number }>();
    expect(row?.count).toBe(1);
  });

  it("claims on different resource_ids never contend with each other", async () => {
    const requests = Array.from({ length: N }, (_, i) =>
      claimRequest(`token-${i}`, { resource_id: `feature:p99/F${i}`, resource_type: "feature" })
    );
    const responses = await Promise.all(requests.map((r) => SELF.fetch(r)));
    expect(responses.every((r) => r.status === 201)).toBe(true);
  });

  it("release then reclaim: the partial index doesn't permanently lock a resource", async () => {
    const first = await SELF.fetch(
      claimRequest("token-0", { resource_id: "role:coord-board", resource_type: "coordinator-role" })
    );
    expect(first.status).toBe(201);
    const { claim } = (await first.json()) as { claim: { id: number } };

    const release = await SELF.fetch(
      new Request(`http://coord-service.local/claims/${claim.id}/release`, {
        method: "POST",
        headers: { Authorization: "Bearer token-0" },
      })
    );
    expect(release.status).toBe(200);

    const requests = Array.from({ length: N }, (_, i) =>
      claimRequest(`token-${i}`, { resource_id: "role:coord-board", resource_type: "coordinator-role" })
    );
    const responses = await Promise.all(requests.map((r) => SELF.fetch(r)));
    expect(responses.filter((r) => r.status === 201).length).toBe(1);
  });

  it("rejects an invalid token before ever touching the claims table", async () => {
    const before = await env.DB.prepare("SELECT COUNT(*) as count FROM claims").first<{ count: number }>();

    const res = await SELF.fetch(
      claimRequest("not-a-real-token", { resource_id: "role:coord-ava", resource_type: "coordinator-role" })
    );
    expect(res.status).toBe(401);

    const after = await env.DB.prepare("SELECT COUNT(*) as count FROM claims").first<{ count: number }>();
    expect(after?.count).toBe(before?.count);
  });

  it("records a claim under the token's real identity - a spoofed agent_id in the body is ignored", async () => {
    const res = await SELF.fetch(
      claimRequest("token-0", {
        resource_id: "role:coord-survey",
        resource_type: "coordinator-role",
        agent_id: "test-agent-1", // spoofed — token-0 actually belongs to test-agent-0
      })
    );
    expect(res.status).toBe(201);
    const { claim } = (await res.json()) as { claim: { agent_id: string } };
    expect(claim.agent_id).toBe("test-agent-0");
  });
});
