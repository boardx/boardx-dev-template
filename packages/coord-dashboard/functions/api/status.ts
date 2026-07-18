// Same-origin proxy for the coordination read plane.
//
// 2026-07-18 cutover (p29-F10 stage-2, ADR-017): coord-service (D1) is retired.
// The authority is now coord-gateway (one RepoHub Durable Object per repo). The
// gateway has no public unauthenticated /status — reads require a bearer token —
// so this Pages Function now does the authenticated fetch server-side with a
// Pages **secret** (COORD_API_TOKEN, never sent to the browser) and reshapes
// the gateway's /claims + /events into the { active_claims, recent_events }
// contract the static frontend already renders.
//
// Not configured → honest empty state (configured:false + empty arrays), NOT an
// error: the dashboard keeps rendering with a banner. Unreachable upstream →
// 502 with a structured error (fail-closed posture; a reachability problem is a
// visible state, not a crash). Exception detail goes to the edge log, never the
// client response.
//
// Required Pages project settings (wrangler pages secret put / dashboard vars):
//   COORD_GATEWAY_URL  e.g. https://coord-gateway.boardx.workers.dev  ([vars])
//   COORD_REPO         e.g. boardx/boardx-dev-template               ([vars])
//   COORD_API_TOKEN    gateway bearer (encrypted secret)

interface Env {
  COORD_GATEWAY_URL?: string;
  COORD_REPO?: string;
  COORD_API_TOKEN?: string;
}

const RECENT_EVENTS = 50;

export const onRequestGet = async (context: { env: Env }): Promise<Response> => {
  const { COORD_GATEWAY_URL, COORD_REPO, COORD_API_TOKEN } = context.env;
  const headers = {
    "content-type": "application/json; charset=utf-8",
    // Ops view must always reflect live state — never let an edge/browser
    // cache serve a stale coordination snapshot.
    "cache-control": "no-store",
  };

  if (!COORD_GATEWAY_URL || !COORD_REPO || !COORD_API_TOKEN) {
    // Deployment intermediate state is legitimate, not a fault: render empty.
    return new Response(
      JSON.stringify({
        configured: false,
        note: "coord-gateway proxy not configured (COORD_GATEWAY_URL/COORD_REPO vars + COORD_API_TOKEN secret); coord-service retired per ADR-017",
        active_claims: [],
        recent_events: [],
        generated_at: new Date().toISOString(),
      }),
      { status: 200, headers },
    );
  }

  const base = `${COORD_GATEWAY_URL.replace(/\/$/, "")}/api/coord/repos/${COORD_REPO}`;
  const auth = { accept: "application/json", authorization: `Bearer ${COORD_API_TOKEN}` };
  try {
    const [claimsRes, eventsRes] = await Promise.all([
      fetch(`${base}/claims`, { headers: auth }),
      fetch(`${base}/events?limit=500`, { headers: auth }),
    ]);
    if (!claimsRes.ok || !eventsRes.ok) {
      console.error("coord_gateway_upstream_error", {
        upstream: base, claims: claimsRes.status, events: eventsRes.status,
      });
      return new Response(
        JSON.stringify({ error: "coord_gateway_unavailable", upstream: base }),
        { status: 502, headers },
      );
    }
    const claimsBody = (await claimsRes.json()) as { leases?: unknown[] };
    const eventsBody = (await eventsRes.json()) as { events?: unknown[] };
    // Gateway events are ascending by event_id (ULID = chronological); the
    // dashboard shows "recent first" — take the tail, newest on top.
    const recent = (eventsBody.events ?? []).slice(-RECENT_EVENTS).reverse();
    return new Response(
      JSON.stringify({
        configured: true,
        active_claims: claimsBody.leases ?? [],
        recent_events: recent,
        generated_at: new Date().toISOString(),
      }),
      { status: 200, headers },
    );
  } catch (err) {
    console.error("coord_gateway_unreachable", { upstream: base, err: String(err) });
    return new Response(
      JSON.stringify({ error: "coord_gateway_unavailable", upstream: base }),
      { status: 502, headers },
    );
  }
};
