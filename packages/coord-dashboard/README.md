# @repo/coord-dashboard

A **standalone Cloudflare Pages** dashboard for the agent coordination plane.
It reads the coordination plane through coord-gateway (per-repo RepoHub Durable
Object, ADR-017 — coord-service is retired) and renders who holds which lease
plus the recent coordination event stream. Auto-refreshes every 30s.
**Read-only** — it never mutates coordination state.

## Why it's its own deploy (not a page in `apps/web`)

`apps/web` also has `/admin/coordination`, but that requires logging into the
product app as SysAdmin. This dashboard is **ops infrastructure for watching the
agent fleet** — it should not be coupled to the product's auth or deploy. So it
lives here as an independent Pages project with its own URL and lifecycle.

## Architecture

```
browser ──GET /────────────▶ public/index.html      (static, self-contained)
browser ──GET /api/status──▶ functions/api/status.ts (Pages Function, edge)
                                    │  server-side authenticated fetch
                                    ▼  (COORD_API_TOKEN Pages secret, no CORS)
                             coord-gateway /api/coord/repos/:repo/claims + /events
```

The Function is a **same-origin authenticated proxy**: the gateway's read
endpoints require a bearer token, which lives as a Pages **secret** on the
server side and is never sent to the browser. The Function fetches
worker-to-worker on the edge, reshapes `{ leases }` + `{ events }` into the
`{ active_claims, recent_events }` contract the static page renders, and returns
JSON from the dashboard's own origin.

## Access

The page itself is public, but the data now comes through an authenticated
gateway token held server-side. To gate the page behind a login too, put a
[Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/)
policy in front of the Pages project (Zero Trust → Access → Applications); no
code change needed.

## Develop

```bash
pnpm --filter @repo/coord-dashboard dev     # wrangler pages dev — serves public/ + functions/ locally
```

Open the printed URL; `/api/status` proxies to coord-gateway (requires the env below).

## Deploy

Needs a Cloudflare API token with **Cloudflare Pages: Edit** (plus account read).
Put `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` in the environment, then:

```bash
cd packages/coord-dashboard
pnpm deploy
```

First deploy creates the `coord-dashboard` Pages project and prints the
`https://coord-dashboard*.pages.dev` URL.

## Runtime configuration (required since the ADR-017 cutover)

`functions/api/status.ts` reads:

- `COORD_GATEWAY_URL` — e.g. `https://coord-gateway.boardx.workers.dev` (`[vars]` in `wrangler.toml`)
- `COORD_REPO` — e.g. `boardx/boardx-dev-template` (`[vars]`)
- `COORD_API_TOKEN` — gateway bearer, **encrypted Pages secret**:
  `wrangler pages secret put COORD_API_TOKEN --project-name coord-dashboard`

Until all three are present the dashboard renders an honest empty state with a
"not configured" banner (200, not an error). Env changes must be atomic with
deploys (mod-devportal incident discipline).
