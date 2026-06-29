import { describe, it, expect } from "vitest";
import { boardTitleOrDefault, DEFAULT_BOARD_TITLE } from "./board";

// 纯函数单测：空名回退默认标题（真实 DB 交互由 harness verify + docker e2e 覆盖）。
describe("boardTitleOrDefault", () => {
  it("非空名去首尾空白后原样返回", () => {
    expect(boardTitleOrDefault("  My Board  ")).toBe("My Board");
  });

  it("空字符串回退默认标题", () => {
    expect(boardTitleOrDefault("")).toBe(DEFAULT_BOARD_TITLE);
  });

  it("全空白回退默认标题", () => {
    expect(boardTitleOrDefault("   ")).toBe(DEFAULT_BOARD_TITLE);
  });

  it("null / undefined 回退默认标题", () => {
    expect(boardTitleOrDefault(null)).toBe(DEFAULT_BOARD_TITLE);
    expect(boardTitleOrDefault(undefined)).toBe(DEFAULT_BOARD_TITLE);
  });
});
