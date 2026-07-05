import { errorResponse } from "./lib/errors";
import type { Env } from "./db/types";

export type Handler = (request: Request, env: Env, params: Record<string, string>) => Promise<Response>;

interface Route {
  method: string;
  segments: string[]; // e.g. ["claims", ":id", "heartbeat"]
  handler: Handler;
}

/** A hand-rolled ~40-line method+path matcher. Deliberately not a framework
 *  (Hono/itty-router) — the surface is 6 routes; see AGENTS.md. */
export class Router {
  private routes: Route[] = [];

  private add(method: string, path: string, handler: Handler): void {
    this.routes.push({ method, segments: path.split("/").filter(Boolean), handler });
  }

  get(path: string, handler: Handler): void {
    this.add("GET", path, handler);
  }

  post(path: string, handler: Handler): void {
    this.add("POST", path, handler);
  }

  async handle(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    for (const route of this.routes) {
      if (route.method !== request.method) continue;
      if (route.segments.length !== pathSegments.length) continue;

      const params: Record<string, string> = {};
      let matched = true;
      for (let i = 0; i < route.segments.length; i++) {
        const seg = route.segments[i];
        const actual = pathSegments[i];
        if (seg === undefined || actual === undefined) {
          matched = false;
          break;
        }
        if (seg.startsWith(":")) {
          params[seg.slice(1)] = actual;
        } else if (seg !== actual) {
          matched = false;
          break;
        }
      }
      if (!matched) continue;

      try {
        return await route.handler(request, env, params);
      } catch (err) {
        return errorResponse(err);
      }
    }
    return Response.json({ error: "not_found" }, { status: 404 });
  }
}
