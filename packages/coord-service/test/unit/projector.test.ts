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
      resourceId: "feature:p18/F03",
      agentId: "wrk-ava-1",
      at: new Date().toISOString(),
    });

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runProjector(env);
    expect(result.processed).toBe(1); // cursor still advances past the unmapped event
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves role:coord-main via a coordination:lease label search and posts the unprefixed heartbeat format", async () => {
    env.GITHUB_TOKEN = "test-token";
    env.GITHUB_REPO = "boardx/boardx-dev-template";
    await insertEvent(env.DB, {
      type: "heartbeat",
      resourceId: "role:coord-main",
      agentId: "coord-main",
      at: "2026-07-08T00:00:00Z",
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void init;
      const url = String(input);
      if (url.includes("/issues?labels=")) {
        expect(url).toContain(encodeURIComponent("coordination:lease"));
        return new Response(JSON.stringify([{ number: 323 }]), { status: 200 });
      }
      return new Response(null, { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runProjector(env);
    expect(result).toEqual({ processed: 1, skipped: false });
    const commentCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("/comments"));
    expect(String(commentCall?.[0])).toContain("/repos/boardx/boardx-dev-template/issues/323/comments");
    const commentBody = JSON.parse(String(commentCall?.[1]?.body));
    expect(commentBody.body).toBe("coordinator-heartbeat at 2026-07-08T00:00:00Z");
  });

  it("resolves role:coord-<module> via a coordination:lease:<module> label search and posts the module-prefixed heartbeat format", async () => {
    env.GITHUB_TOKEN = "test-token";
    env.GITHUB_REPO = "boardx/boardx-dev-template";
    await insertEvent(env.DB, {
      type: "heartbeat",
      resourceId: "role:coord-store-admin",
      agentId: "coord-store-admin",
      at: "2026-07-08T00:00:00Z",
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void init;
      const url = String(input);
      if (url.includes("/issues?labels=")) {
        expect(url).toContain(encodeURIComponent("coordination:lease:store-admin"));
        return new Response(JSON.stringify([{ number: 352 }]), { status: 200 });
      }
      return new Response(null, { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runProjector(env);
    expect(result).toEqual({ processed: 1, skipped: false });
    const commentCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("/comments"));
    expect(String(commentCall?.[0])).toContain("/repos/boardx/boardx-dev-template/issues/352/comments");
    const commentBody = JSON.parse(String(commentCall?.[1]?.body));
    expect(commentBody.body).toBe("module-coordinator-heartbeat by:coord-store-admin at 2026-07-08T00:00:00Z");
  });

  it("skips a role event when the label search finds no matching issue, but still advances the cursor", async () => {
    env.GITHUB_TOKEN = "test-token";
    env.GITHUB_REPO = "boardx/boardx-dev-template";
    await insertEvent(env.DB, {
      type: "heartbeat",
      resourceId: "role:coord-nonexistent",
      agentId: "coord-nonexistent",
      at: new Date().toISOString(),
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/issues?labels=")) return new Response(JSON.stringify([]), { status: 200 });
      return new Response(null, { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runProjector(env);
    expect(result.processed).toBe(1);
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/comments"))).toBe(false);
  });

  it("caches the label search across multiple events for the same role in one batch", async () => {
    env.GITHUB_TOKEN = "test-token";
    env.GITHUB_REPO = "boardx/boardx-dev-template";
    await insertEvent(env.DB, {
      type: "claim",
      resourceId: "role:coord-main",
      agentId: "coord-main",
      at: "2026-07-08T00:00:00Z",
    });
    await insertEvent(env.DB, {
      type: "heartbeat",
      resourceId: "role:coord-main",
      agentId: "coord-main",
      at: "2026-07-08T00:15:00Z",
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/issues?labels=")) return new Response(JSON.stringify([{ number: 323 }]), { status: 200 });
      return new Response(null, { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runProjector(env);
    expect(result.processed).toBe(2);
    const searchCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes("/issues?labels="));
    expect(searchCalls).toHaveLength(1); // second event reuses the cached lookup
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
