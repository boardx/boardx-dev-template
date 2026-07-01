import { describe, it, expect } from "vitest";
import { isBlank } from "./survey";

// 纯函数单测：标题空白判定（真实 DB 交互由 harness verify + docker e2e 覆盖）。
describe("isBlank", () => {
  it("非空标题 → false", () => {
    expect(isBlank("Team Pulse Survey")).toBe(false);
  });

  it("空字符串 → true", () => {
    expect(isBlank("")).toBe(true);
  });

  it("全空白 → true", () => {
    expect(isBlank("   ")).toBe(true);
  });

  it("null / undefined → true", () => {
    expect(isBlank(null)).toBe(true);
    expect(isBlank(undefined)).toBe(true);
  });
});
