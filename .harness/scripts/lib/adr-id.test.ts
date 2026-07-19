import { describe, expect, it } from "vitest";
import { adrIdNumber, findAdrIdConflicts, nextAdrId } from "./adr-id";

describe("adrIdNumber", () => {
  it("解析标准格式", () => {
    expect(adrIdNumber("ADR-018")).toBe(18);
    expect(adrIdNumber("ADR-001")).toBe(1);
  });
  it("旧序列 0001/0002 不参与本编号空间", () => {
    expect(adrIdNumber("0001")).toBeNull();
    expect(adrIdNumber("0002")).toBeNull();
  });
  it("非法格式返回 null", () => {
    expect(adrIdNumber("adr-018")).toBeNull();
    expect(adrIdNumber("ADR-abc")).toBeNull();
    expect(adrIdNumber("")).toBeNull();
  });
});

describe("nextAdrId", () => {
  it("取 max+1，3 位零填充", () => {
    expect(nextAdrId(["ADR-001", "ADR-017", "ADR-018"])).toBe("ADR-019");
  });
  it("忽略混入的旧序列 id", () => {
    expect(nextAdrId(["0001", "0002", "ADR-005"])).toBe("ADR-006");
  });
  it("空列表从 001 起", () => {
    expect(nextAdrId([])).toBe("ADR-001");
  });
  it("乱序输入仍取真实最大值", () => {
    expect(nextAdrId(["ADR-003", "ADR-018", "ADR-009"])).toBe("ADR-019");
  });
  it("三位数以上不再零填充截断（回归防呆，虽然近期不会撞到）", () => {
    expect(nextAdrId(["ADR-999"])).toBe("ADR-1000");
  });
});

describe("findAdrIdConflicts", () => {
  it("无冲突返回空数组", () => {
    expect(findAdrIdConflicts("ADR-019", ["ADR-018"], ["ADR-018-foo.md"])).toEqual([]);
  });
  it("README 索引表已占用", () => {
    const c = findAdrIdConflicts("ADR-018", ["ADR-018"], []);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatch(/README\.md/);
  });
  it("文件已存在但未登记索引表也算冲突（双来源检测，同 phase-id 模式）", () => {
    const c = findAdrIdConflicts("ADR-018", [], ["ADR-018-spec-ref-closed-loop.md"]);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatch(/文件已存在/);
  });
  it("两处都占用返回两条冲突", () => {
    const c = findAdrIdConflicts("ADR-018", ["ADR-018"], ["ADR-018-spec-ref-closed-loop.md"]);
    expect(c).toHaveLength(2);
  });
  it("前缀不误伤：ADR-1 不应被 ADR-18 的文件名污染", () => {
    // 真实回归点：字符串前缀匹配必须精确到 "<id>-"，否则 "ADR-1" 会被
    // "ADR-18-xxx.md" 误判为冲突（"ADR-1" 是 "ADR-18" 的前缀但不是同一个 id）。
    const c = findAdrIdConflicts("ADR-001", [], ["ADR-018-spec-ref-closed-loop.md"]);
    expect(c).toEqual([]);
  });
});
