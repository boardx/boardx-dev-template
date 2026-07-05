/**
 * Node-safe client for coord-service, meant for `.harness/scripts` (plain Node,
 * not a Worker) to import as `@repo/coord-service/client`. Deliberately has
 * zero dependency on Workers-only globals (D1Database etc.) — only `fetch`,
 * which modern Node (>=18) provides natively, same as this repo's own
 * `engines.node` requirement.
 *
 * Every call is designed to be used as a best-effort dual-write: callers should
 * treat a thrown error or a non-ok response as "coord-service unavailable right
 * now" and fall back to whatever the primary (file-based / GitHub-label-based)
 * mechanism already decided — never let this block or override it. See
 * .harness/scripts/coordinator-lock.ts for the reference integration.
 */

export interface ClaimResult {
  ok: boolean;
  status: number;
  body?: unknown;
}

export interface ActiveClaim {
  id: number;
  resource_id: string;
  agent_id: string;
  last_heartbeat_at: string;
  ttl_seconds: number;
}

export interface CoordServiceClient {
  claim(resourceId: string, resourceType: string, ttlSeconds?: number): Promise<ClaimResult>;
  heartbeat(claimId: number): Promise<ClaimResult>;
  release(claimId: number): Promise<ClaimResult>;
  /** Reads the current in_progress claim for a resource, or null if free.
   *  Public endpoint — used by the Phase 5 cutover to decide, before ever
   *  touching the local file lock, whether D1 says the resource is already
   *  held by someone else. Never throws on a reachable-but-empty result. */
  queryActiveClaim(resourceId: string): Promise<ActiveClaim | null>;
}

export function createCoordServiceClient(baseUrl: string, token: string): CoordServiceClient {
  async function call(path: string, init: RequestInit): Promise<ClaimResult> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("Content-Type", "application/json");
    const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
    const body = await res.json().catch(() => undefined);
    return { ok: res.ok, status: res.status, body };
  }

  return {
    claim(resourceId, resourceType, ttlSeconds) {
      return call("/claims", {
        method: "POST",
        body: JSON.stringify({
          resource_id: resourceId,
          resource_type: resourceType,
          ttl_seconds: ttlSeconds,
        }),
      });
    },
    heartbeat(claimId) {
      return call(`/claims/${claimId}/heartbeat`, { method: "POST" });
    },
    release(claimId) {
      return call(`/claims/${claimId}/release`, { method: "POST" });
    },
    async queryActiveClaim(resourceId) {
      const params = new URLSearchParams({ resource_id: resourceId, status: "in_progress" });
      const result = await call(`/claims?${params.toString()}`, { method: "GET" });
      if (!result.ok) return null;
      const claims = (result.body as { claims?: ActiveClaim[] } | undefined)?.claims;
      return claims?.[0] ?? null;
    },
  };
}

/** Reads COORD_SERVICE_URL/COORD_SERVICE_TOKEN and returns a client, or null if
 *  either is unset — the single gate that makes dual-write entirely opt-in. */
export function createCoordServiceClientFromEnv(): CoordServiceClient | null {
  const baseUrl = process.env["COORD_SERVICE_URL"];
  const token = process.env["COORD_SERVICE_TOKEN"];
  if (!baseUrl || !token) return null;
  return createCoordServiceClient(baseUrl, token);
}
