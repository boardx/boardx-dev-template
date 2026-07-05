import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runProjector } from "../../src/cron/projector";
import { insertEvent } from "../../src/db/queries";

describe("projector", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    env.GITHUB_TOKEN = undefined;
    env.GITHUB_REPO = undefined;
  });

  it("no-ops without advancing the cursor when GitHub isn't configured", async () => {
    const result = await runProjector(env);
    expect(result).toEqual({ processed: 0, skipped: true });
  });

  it("posts a comment for an issue:<n> mapped resource and advances the cursor", async () => {
    env.GITHUB_TOKEN = "test-token";
    env.GITHUB_REPO = "boardx/boardx-dev-template";
    await insertEvent(env.DB, {
      type: "claim",
      resourceId: "issue:358",
      agentId: "coord-architecture",
      at: new Date().toISOString(),
    });

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runProjector(env);
    expect(result).toEqual({ processed: 1, skipped: false });
    expect(fetchMock).toHaveBeenCalledTimes(2); // comment + agent label
    const firstCallArgs = fetchMock.mock.calls[0];
    expect(String(firstCallArgs?.[0])).toContain(
      "/repos/boardx/boardx-dev-template/issues/358/comments"
    );
  });

  it("skips events whose resource_id has no defined issue mapping, but still advances past them", async () => {
    env.GITHUB_TOKEN = "test-token";
    env.GITHUB_REPO = "boardx/boardx-dev-template";
    await insertEvent(env.DB, {
      type: "heartbeat",
      resourceId: "role:coord-main",
      agentId: "coord-main",
      at: new Date().toISOString(),
    });

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runProjector(env);
    expect(result.processed).toBe(1); // cursor still advances past the unmapped event
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not re-process an event once the cursor has passed it", async () => {
    env.GITHUB_TOKEN = "test-token";
    env.GITHUB_REPO = "boardx/boardx-dev-template";
    await insertEvent(env.DB, {
      type: "release",
      resourceId: "issue:900",
      agentId: "coord-architecture",
      at: new Date().toISOString(),
    });

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await runProjector(env);
    expect(first.processed).toBe(1);
    const second = await runProjector(env);
    expect(second.processed).toBe(0);
  });
});
