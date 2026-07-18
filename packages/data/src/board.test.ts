import { describe, it, expect } from "vitest";
import { boardTitleOrDefault, DEFAULT_BOARD_TITLE, boardRole, resolveBoardId } from "./board";

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

describe("boardRole", () => {
  it("白板属主 + 可访问房间 → owner", () => {
    expect(boardRole(true, true, false)).toBe("owner");
  });

  it("非属主但房间成员 → editor", () => {
    expect(boardRole(false, true, false)).toBe("editor");
  });

  it("不可访问房间但白板 public → viewer（只读）", () => {
    expect(boardRole(false, false, true)).toBe("viewer");
  });

  it("既非房间成员也非 public → null（无权）", () => {
    expect(boardRole(false, false, false)).toBeNull();
  });

  it("可访问房间优先于 public（房间成员即便 public 也是 editor）", () => {
    expect(boardRole(false, true, true)).toBe("editor");
  });
});

// issue #529 阶段2（路由层）：数字 id 直通分支是纯函数（不查 DB），可单测；public_id 命中
// 分支需要真实数据库查找，由 harness verify + docker e2e 覆盖（同文件头一贯的测试哲学）。
describe("resolveBoardId", () => {
  it("旧的数字 id 字符串原样转数字返回，不触发任何 public_id 查找", async () => {
    expect(await resolveBoardId("42")).toBe(42);
  });

  it("非法格式（既不是数字也不是 brd_ public_id）落到哨兵 id（-1），不是 NaN——NaN 传进 pg 查询参数会直接抛异常", async () => {
    expect(await resolveBoardId("not-an-id")).toBe(-1);
  });
});
