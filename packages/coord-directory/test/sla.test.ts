// computeSlaStatus 纯函数单测（p30/F06）：无 I/O、无隐式时钟依赖，now 显式传入 → 完全确定性。
import { describe, expect, it } from "vitest";
import { computeSlaStatus } from "../src/sla";

const H = 3_600_000;

describe("computeSlaStatus", () => {
  it("刚创建：hoursLeft ≈ promiseH，未超时、未临界", () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    const createdAt = new Date(now).toISOString();
    const s = computeSlaStatus(createdAt, 24, now);
    expect(s.hoursLeft).toBe(24);
    expect(s.timedOut).toBe(false);
    expect(s.urgent).toBe(false);
    expect(s.deadline).toBe(new Date(now + 24 * H).toISOString().replace(/\.\d{3}Z$/, "Z"));
  });

  it("临界：剩余 <=4h 且 >0 → urgent=true（W6 审批队列变红阈值）", () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    const createdAt = new Date(now - 20 * H).toISOString(); // 24h 承诺，已过 20h，剩 4h
    const s = computeSlaStatus(createdAt, 24, now);
    expect(s.hoursLeft).toBe(4);
    expect(s.urgent).toBe(true);
    expect(s.timedOut).toBe(false);
  });

  it("超时：剩余 <=0 → timedOut=true，urgent=false（终态徽章不用红黄双重语义）", () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    const createdAt = new Date(now - 25 * H).toISOString();
    const s = computeSlaStatus(createdAt, 24, now);
    expect(s.hoursLeft).toBeLessThanOrEqual(0);
    expect(s.timedOut).toBe(true);
    expect(s.urgent).toBe(false);
  });

  it("非法 created_at → fail-closed 视为已超时（不显示假绿色倒计时）", () => {
    const s = computeSlaStatus("not-a-date", 24, Date.now());
    expect(s.timedOut).toBe(true);
    expect(s.urgent).toBe(false);
  });

  it("非法 promiseH（<=0/非数字）→ 兜底 24h", () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    const createdAt = new Date(now).toISOString();
    expect(computeSlaStatus(createdAt, 0, now).hoursLeft).toBe(24);
    expect(computeSlaStatus(createdAt, -5, now).hoursLeft).toBe(24);
    expect(computeSlaStatus(createdAt, NaN, now).hoursLeft).toBe(24);
  });
});
