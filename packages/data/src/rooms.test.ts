import { describe, it, expect } from "vitest";
import { resolveRoomId } from "./rooms";

// issue #529 阶段2（路由层）：数字 id 直通分支是纯函数（不查 DB），可单测；public_id 命中
// 分支需要真实数据库查找，由 harness verify + docker e2e 覆盖。
describe("resolveRoomId", () => {
  it("旧的数字 id 字符串原样转数字返回，不触发任何 public_id 查找", async () => {
    expect(await resolveRoomId("7")).toBe(7);
  });

  it("非法格式（既不是数字也不是 rm_ public_id）落到哨兵 id（-1），不是 NaN——NaN 传进 pg 查询参数会直接抛异常", async () => {
    expect(await resolveRoomId("garbage")).toBe(-1);
  });
});
