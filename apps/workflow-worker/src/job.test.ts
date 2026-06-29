import { describe, it, expect } from "vitest";
import { decideStatus } from "./job";

describe("decideStatus", () => {
  it("有 payload → done", () => {
    expect(decideStatus({ id: "j1", payload: "hello" })).toBe("done");
  });
  it("空 payload → failed", () => {
    expect(decideStatus({ id: "j2", payload: "   " })).toBe("failed");
  });
  it("幂等：相同输入结果一致", () => {
    const d = { id: "j3", payload: "x" };
    expect(decideStatus(d)).toBe(decideStatus(d));
  });
});
