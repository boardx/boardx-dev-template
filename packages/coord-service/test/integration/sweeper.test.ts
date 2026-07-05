import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { sweepStaleClaims } from "../../src/cron/sweeper";
import { sha256Hex } from "../../src/lib/crypto";

async function seedAgent(id: string, token: string): Promise<void> {
  const tokenHash = await sha256Hex(token);
  await env.DB.prepare(
    "INSERT INTO agents (id, kind, areas, token_hash, active, created_at) VALUES (?, ?, ?, ?, 1, ?)"
  )
    .bind(id, "worker", null, tokenHash, new Date().toISOString())
    .run();
}

describe("sweeper", () => {
  beforeEach(async () => {
    await seedAgent("sweeper-agent", "sweeper-token");
  });

  it("expires a claim whose heartbeat is older than its ttl, and logs an expire event", async () => {
    const staleHeartbeat = new Date(Date.now() - 10_000).toISOString(); // 10s ago
    await env.DB.prepare(
      `INSERT INTO claims (resource_id, resource_type, agent_id, status, claimed_at, last_heartbeat_at, ttl_seconds)
       VALUES (?, ?, ?, 'in_progress', ?, ?, ?)`
    )
      .bind("role:coord-sweep-test", "coordinator-role", "sweeper-agent", staleHeartbeat, staleHeartbeat, 5)
      .run();

    const result = await sweepStaleClaims(env);
    expect(result.expired).toBe(1);

    const row = await env.DB.prepare("SELECT status FROM claims WHERE resource_id = ?")
      .bind("role:coord-sweep-test")
      .first<{ status: string }>();
    expect(row?.status).toBe("expired");

    const event = await env.DB.prepare(
      "SELECT type FROM events WHERE resource_id = ? ORDER BY id DESC LIMIT 1"
    )
      .bind("role:coord-sweep-test")
      .first<{ type: string }>();
    expect(event?.type).toBe("expire");
  });

  it("does not expire a claim whose heartbeat is still within ttl", async () => {
    const freshHeartbeat = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO claims (resource_id, resource_type, agent_id, status, claimed_at, last_heartbeat_at, ttl_seconds)
       VALUES (?, ?, ?, 'in_progress', ?, ?, ?)`
    )
      .bind("role:coord-sweep-fresh", "coordinator-role", "sweeper-agent", freshHeartbeat, freshHeartbeat, 21600)
      .run();

    const result = await sweepStaleClaims(env);
    expect(result.expired).toBe(0);

    const row = await env.DB.prepare("SELECT status FROM claims WHERE resource_id = ?")
      .bind("role:coord-sweep-fresh")
      .first<{ status: string }>();
    expect(row?.status).toBe("in_progress");
  });
});
