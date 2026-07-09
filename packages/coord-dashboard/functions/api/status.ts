// Same-origin proxy for the public coord-service /status endpoint.
//
// Why a proxy instead of the browser calling coord-service directly: the
// dashboard is served from *.pages.dev and coord-service lives on
// *.workers.dev — a different origin. coord-service sends no CORS headers, so a
// direct browser fetch would be blocked by the same-origin policy. This Pages
// Function runs on Cloudflare's edge and fetches worker-to-worker (no CORS
// involved), then returns the JSON to the browser from the SAME origin as the
// page. Result: the dashboard package is fully self-contained and needs zero
// changes to coord-service.
//
// The data is already world-readable (coord-service /status is public by
// design, ADR-009 "full transparency"), so this proxy adds no new exposure — it
// only reshapes access from cross-origin to same-origin.

interface Env {
  // Set as a Pages project variable; falls back to the known staging URL so the
  // dashboard works out-of-the-box even before the var is configured.
  COORD_SERVICE_URL?: string;
}

const DEFAULT_COORD_SERVICE_URL = "https://coord-service-staging.boardx.workers.dev";

export const onRequestGet = async (context: { env: Env }): Promise<Response> => {
  const base = (context.env.COORD_SERVICE_URL || DEFAULT_COORD_SERVICE_URL).replace(/\/$/, "");
  try {
    const upstream = await fetch(`${base}/status`, {
      headers: { accept: "application/json" },
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        // Ops view must always reflect live state — never let an edge/browser
        // cache serve a stale coordination snapshot.
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    // Upstream unreachable (Worker/D1 down). Surface it as a structured error the
    // frontend can render, not an opaque 500 — mirrors coord-service's own
    // fail-closed posture (a reachability problem is a visible state, not a crash).
    // The exception detail goes to the edge log, NOT the client response (repo
    // convention: never return String(err) to callers). `upstream` is the public
    // coord-service host (documented in README), safe to echo for diagnosis.
    console.error("coord_service_unreachable", { upstream: base, err: String(err) });
    return new Response(
      JSON.stringify({ error: "coord_service_unreachable", upstream: base }),
      { status: 502, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }
    );
  }
};
