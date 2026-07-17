// cycle.ts 单测（ADR-014 统一时钟）：周期锚定必须确定、跨机器一致。
import { describe, it, expect } from "vitest";
import { cycleStart, cycleId, describeCycle, CYCLE_HOURS } from "../../src/lib/cycle";

describe("C-cycle 时钟（权威实现）", () => {
  it("锚定到 UTC 整点 00/03/06/09/12/15/18/21", () => {
    for (const [input, expectedHour] of [
      ["2026-07-15T00:00:00Z", 0], ["2026-07-15T02:59:59Z", 0],
      ["2026-07-15T03:00:00Z", 3], ["2026-07-15T09:47:12Z", 9],
      ["2026-07-15T23:59:59Z", 21],
    ] as const) {
      expect(cycleStart(new Date(input)).getUTCHours()).toBe(expectedHour);
    }
  });

  it("cycle id 是同一周期内任意时刻的同一字符串（全队指代一致）", () => {
    const a = cycleId(cycleStart(new Date("2026-07-15T09:00:00Z")));
    const b = cycleId(cycleStart(new Date("2026-07-15T11:59:59Z")));
    expect(a).toBe(b);
    expect(a).toBe("2026-07-15T09Z");
  });

  it("跨周期边界后 id 改变", () => {
    const before = cycleId(cycleStart(new Date("2026-07-15T11:59:59Z")));
    const after = cycleId(cycleStart(new Date("2026-07-15T12:00:00Z")));
    expect(before).not.toBe(after);
    expect(after).toBe("2026-07-15T12Z");
  });

  it("describeCycle 的剩余/已过秒数自洽且总和=周期长度", () => {
    const c = describeCycle(new Date("2026-07-15T10:30:00Z"));
    expect(c.id).toBe("2026-07-15T09Z");
    expect(c.started_at).toBe("2026-07-15T09:00:00.000Z");
    expect(c.ends_at).toBe("2026-07-15T12:00:00.000Z");
    expect(c.elapsed_seconds).toBe(90 * 60);
    expect(c.remaining_seconds).toBe(90 * 60);
    expect(c.elapsed_seconds + c.remaining_seconds).toBe(CYCLE_HOURS * 3600);
  });

  it("边界时刻：周期起点 remaining=满、elapsed=0", () => {
    const c = describeCycle(new Date("2026-07-15T09:00:00Z"));
    expect(c.elapsed_seconds).toBe(0);
    expect(c.remaining_seconds).toBe(CYCLE_HOURS * 3600);
  });
});
