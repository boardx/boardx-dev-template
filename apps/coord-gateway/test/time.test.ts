// GET /api/coord/time（ADR-014 权威时钟，p29-F10 stage-2 迁自 coord-service）。
// 纯函数测试逐条移植自 packages/coord-service/test/unit/cycle.test.ts——迁移的
// 验收标准就是"旧测试在新家全绿"（ADR-014 语义零变更）。
import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { cycleStart, cycleId, describeCycle, CYCLE_HOURS } from "../src/cycle";

describe("C-cycle 时钟（权威实现，迁自 coord-service）", () => {
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

describe("GET /api/coord/time 端点", () => {
  it("公开只读、无需 token，返回 now/epoch_ms/cycle 且自洽", async () => {
    const before = Date.now();
    const res = await SELF.fetch("https://gw.test/api/coord/time");
    const after = Date.now();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      now: string;
      epoch_ms: number;
      cycle: { id: string; started_at: string; ends_at: string; remaining_seconds: number; elapsed_seconds: number };
    };
    // 服务端时刻落在请求往返窗口内（时钟活的，不是常量）
    expect(body.epoch_ms).toBeGreaterThanOrEqual(before - 1000);
    expect(body.epoch_ms).toBeLessThanOrEqual(after + 1000);
    expect(new Date(body.now).getTime()).toBe(body.epoch_ms);
    // cycle 与 now 用同一实现自洽
    expect(body.cycle.id).toBe(describeCycle(new Date(body.now)).id);
    expect(body.cycle.elapsed_seconds + body.cycle.remaining_seconds).toBe(CYCLE_HOURS * 3600);
  });

  it("非 GET 方法不落到时钟路由（POST → 404）", async () => {
    const res = await SELF.fetch("https://gw.test/api/coord/time", { method: "POST" });
    expect(res.status).toBe(404);
  });
});
