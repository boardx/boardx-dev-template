# @repo/coord-dashboard

A **standalone Cloudflare Pages** dashboard for the agent coordination plane.
It reads coord-service's public `/status` and renders who holds which lease plus
the recent coordination event stream. Auto-refreshes every 30s. **Read-only** —
it never mutates coordination state.

## Why it's its own deploy (not a page in `apps/web`)

`apps/web` also has `/admin/coordination`, but that requires logging into the
product app as SysAdmin. This dashboard is **ops infrastructure for watching the
agent fleet** — it should not be coupled to the product's auth or deploy. So it
lives here as an independent Pages project with its own URL and lifecycle.

## Architecture

```
browser ──GET /────────────▶ public/index.html      (static, self-contained)
browser ──GET /api/status──▶ functions/api/status.ts (Pages Function, edge)
                                    │  server-side fetch (no CORS)
                                    ▼
                             coord-service /status    (public, *.workers.dev)
```

The Function is a **same-origin proxy**: coord-service sends no CORS headers, so
the browser can't call `*.workers.dev` directly from `*.pages.dev`. The Function
fetches worker-to-worker on the edge and returns JSON from the dashboard's own
origin. This keeps the package fully self-contained — **zero changes to
coord-service**. The data is already world-readable (`/status` is public by
design, ADR-009), so the proxy adds no new exposure.

## Access

Public — the underlying `/status` is already public read-only, so the dashboard
exposes nothing new. To gate it behind a login, put a
[Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/)
policy in front of the Pages project (Zero Trust → Access → Applications); no
code change needed.

## Develop

```bash
pnpm --filter @repo/coord-dashboard dev     # wrangler pages dev — serves public/ + functions/ locally
```

Open the printed URL; `/api/status` proxies to the live staging coord-service.

## Deploy

Needs a Cloudflare API token with **Cloudflare Pages: Edit** (plus account read).
Put `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` in the environment (e.g. the
gitignored `packages/coord-service/.env.cloudflare` already used for the Worker,
if that token also has Pages scope), then:

```bash
cd packages/coord-dashboard
sh -c 'set -a; . ../coord-service/.env.cloudflare; set +a; pnpm deploy'
```

First deploy creates the `coord-dashboard` Pages project and prints the
`https://coord-dashboard*.pages.dev` URL.

## Point at a different coord-service

`functions/api/status.ts` reads `COORD_SERVICE_URL` (defaults to the staging
Worker). Override it as a Pages project variable or with
`--var COORD_SERVICE_URL:<url>` on deploy.
