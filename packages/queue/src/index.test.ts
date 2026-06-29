import { describe, it, expect } from "vitest";
import { resolveRedisConnection, QUEUE_NAMES } from "./index";

// 纯函数单测：不连真实 Redis（真实连接由 harness verify + docker 覆盖）。
describe("resolveRedisConnection", () => {
  it("解析 REDIS_URL", () => {
    expect(resolveRedisConnection({ REDIS_URL: "redis://cache:6380" } as NodeJS.ProcessEnv)).toEqual({
      host: "cache",
      port: 6380,
    });
  });

  it("REDIS_URL 无端口时回退 6379", () => {
    expect(resolveRedisConnection({ REDIS_URL: "redis://cache" } as NodeJS.ProcessEnv)).toEqual({
      host: "cache",
      port: 6379,
    });
  });

  it("无 URL 时回退本地默认", () => {
    expect(resolveRedisConnection({} as NodeJS.ProcessEnv)).toEqual({ host: "localhost", port: 6379 });
  });
});

describe("QUEUE_NAMES", () => {
  it("jobs 队列名稳定", () => {
    expect(QUEUE_NAMES.jobs).toBe("boardx.jobs");
  });
});
