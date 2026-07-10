import { describe, it, expect } from "vitest";
import { generateId, isValidPublicId } from "./ids";

describe("generateId", () => {
  it("格式为 <prefix>_<12位字符>", () => {
    const id = generateId("brd");
    expect(id).toMatch(/^brd_[0-9A-Za-z]{12}$/);
  });

  it("拒绝非法 prefix（含数字/大写/过长/为空）", () => {
    expect(() => generateId("b1")).toThrow();
    expect(() => generateId("Brd")).toThrow();
    expect(() => generateId("thisistoolong")).toThrow();
    expect(() => generateId("")).toThrow();
  });

  it("连续生成大量 id 无碰撞（同一 prefix）", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i += 1) {
      const id = generateId("rm");
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
  });

  it("不同 prefix 生成的 id 各自带对应前缀，互不混淆", () => {
    const boardId = generateId("brd");
    const roomId = generateId("rm");
    expect(boardId.startsWith("brd_")).toBe(true);
    expect(roomId.startsWith("rm_")).toBe(true);
  });

  it("id 不含易混淆字符 0/O、1/I/l", () => {
    for (let i = 0; i < 200; i += 1) {
      const id = generateId("brd");
      const body = id.slice("brd_".length);
      expect(body).not.toMatch(/[0OIl1]/);
    }
  });
});

describe("isValidPublicId", () => {
  it("接受合法格式", () => {
    expect(isValidPublicId(generateId("brd"))).toBe(true);
    expect(isValidPublicId(generateId("brd"), "brd")).toBe(true);
  });

  it("prefix 指定但不匹配时拒绝", () => {
    expect(isValidPublicId(generateId("brd"), "rm")).toBe(false);
  });

  it("拒绝自增整数字符串、空字符串、随意文本", () => {
    expect(isValidPublicId("1")).toBe(false);
    expect(isValidPublicId("")).toBe(false);
    expect(isValidPublicId("not-an-id")).toBe(false);
  });
});
