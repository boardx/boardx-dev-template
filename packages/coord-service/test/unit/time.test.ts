import { describe, expect, it } from "vitest";
import { isExpired, secondsSince } from "../../src/lib/time";

describe("time helpers", () => {
  it("secondsSince computes elapsed seconds relative to a reference time", () => {
    const past = "2026-07-04T00:00:00.000Z";
    const reference = "2026-07-04T00:10:00.000Z";
    expect(secondsSince(past, reference)).toBe(600);
  });

  it("isExpired is false when heartbeat is within ttl", () => {
    const heartbeat = "2026-07-04T00:00:00.000Z";
    const reference = "2026-07-04T00:05:00.000Z"; // 300s later
    expect(isExpired(heartbeat, 600, reference)).toBe(false);
  });

  it("isExpired is true once heartbeat age exceeds ttl", () => {
    const heartbeat = "2026-07-04T00:00:00.000Z";
    const reference = "2026-07-04T00:15:00.000Z"; // 900s later
    expect(isExpired(heartbeat, 600, reference)).toBe(true);
  });
});
