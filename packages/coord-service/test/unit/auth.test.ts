import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { requireAgent, requireReviewer } from "../../src/auth";
import { sha256Hex } from "../../src/lib/crypto";
import { HttpError } from "../../src/lib/errors";

async function seedAgent(id: string, token: string, kind: string, active = 1): Promise<void> {
  const tokenHash = await sha256Hex(token);
  await env.DB.prepare(
    "INSERT INTO agents (id, kind, areas, token_hash, active, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(id, kind, null, tokenHash, active, new Date().toISOString())
    .run();
}

function requestWithAuth(header?: string): Request {
  const headers: Record<string, string> = {};
  if (header !== undefined) headers["Authorization"] = header;
  return new Request("http://coord-service.local/whatever", { headers });
}

describe("auth - identity is always derived from the token", () => {
  it("rejects a request with no Authorization header", async () => {
    await expect(requireAgent(requestWithAuth(undefined), env)).rejects.toBeInstanceOf(HttpError);
  });

  it("rejects a non-Bearer Authorization header", async () => {
    await expect(requireAgent(requestWithAuth("Basic abc123"), env)).rejects.toBeInstanceOf(HttpError);
  });

  it("rejects an unknown token", async () => {
    await expect(requireAgent(requestWithAuth("Bearer not-a-real-token"), env)).rejects.toBeInstanceOf(HttpError);
  });

  it("resolves the agent for a known, active token", async () => {
    await seedAgent("test-auth-agent", "auth-token-1", "worker");
    const agent = await requireAgent(requestWithAuth("Bearer auth-token-1"), env);
    expect(agent.id).toBe("test-auth-agent");
  });

  it("rejects a token belonging to a deactivated agent", async () => {
    await seedAgent("test-auth-agent-inactive", "auth-token-2", "worker", 0);
    await expect(requireAgent(requestWithAuth("Bearer auth-token-2"), env)).rejects.toBeInstanceOf(HttpError);
  });

  it("requireReviewer rejects a non-reviewer identity", async () => {
    await seedAgent("test-auth-worker", "auth-token-3", "worker");
    await expect(requireReviewer(requestWithAuth("Bearer auth-token-3"), env)).rejects.toBeInstanceOf(HttpError);
  });

  it("requireReviewer accepts a reviewer identity", async () => {
    await seedAgent("test-auth-reviewer", "auth-token-4", "reviewer");
    const agent = await requireReviewer(requestWithAuth("Bearer auth-token-4"), env);
    expect(agent.kind).toBe("reviewer");
  });
});
