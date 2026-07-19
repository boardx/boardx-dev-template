import { describe, expect, it } from "vitest";
import { adrIdFromFileName, adrIdNumber, findAdrIdConflicts, nextAdrId } from "./adr-id";

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

describe("adrIdFromFileName", () => {
  it("解析标准文件名", () => {
    expect(adrIdFromFileName("ADR-020-atomic-adr-numbering.md")).toBe("ADR-020");
    expect(adrIdFromFileName("ADR-001-per-owner-in-progress.md")).toBe("ADR-001");
  });
  it("旧序列文件名不匹配", () => {
    expect(adrIdFromFileName("0001-record-architecture-decisions.md")).toBeNull();
  });
  it("README.md 本身不匹配", () => {
    expect(adrIdFromFileName("README.md")).toBeNull();
  });
});

describe("nextAdrId 与孤儿文件的交互（coord-main review 2026-07-19 抓到的真实缺口）", () => {
  it("自动取号必须合并索引表与文件名两个来源——只看索引表会撞上未登记的孤儿文件", () => {
    // 复现场景：docs/adr/ 下有 ADR-020-orphan.md（文件已存在），但 README.md 索引表
    // 只到 ADR-018（没登记 020，比如上一次占号后 README 写入被回滚/冲突未解决）。
    const indexedIds = ["ADR-018"];
    const adrFileNames = ["ADR-018-spec-ref-closed-loop.md", "ADR-020-orphan.md"];

    // 错误用法（此前 new-adr.ts 的 bug）：只传索引表 id，取出 ADR-019——
    // 而 ADR-020 已经是孤儿文件，019 本身没冲突，但下一次再取号会撞上 020。
    // 更直接的回归点是：如果孤儿文件本身就是 019（比索引表 max 只大 1），
    // 只看索引表会直接撞车。
    const wrongInput = indexedIds; // bug 版本的调用方式
    expect(nextAdrId(wrongInput)).toBe("ADR-019"); // 展示 bug 会产生的号

    // 正确用法：合并两个来源（new-adr.ts 修复后的调用方式）
    const fileIds = adrFileNames.map(adrIdFromFileName).filter((x): x is string => x !== null);
    const merged = [...indexedIds, ...fileIds];
    expect(nextAdrId(merged)).toBe("ADR-021"); // 跳过孤儿文件占用的 020，不撞车

    // 双保险：合并后取到的号，用 findAdrIdConflicts 反查必须真的无冲突
    expect(findAdrIdConflicts(nextAdrId(merged), indexedIds, adrFileNames)).toEqual([]);
  });

  it("孤儿文件的号恰好紧邻索引表 max 时最容易撞车——专门测这个边界", () => {
    const indexedIds = ["ADR-018"];
    const adrFileNames = ["ADR-019-orphan-not-yet-indexed.md"]; // 019 是孤儿，比 018 只大 1

    // bug 版本：只看索引表，取号结果是 019——与孤儿文件正面相撞
    expect(nextAdrId(indexedIds)).toBe("ADR-019");

    // 修复版本：合并后正确跳到 020
    const fileIds = adrFileNames.map(adrIdFromFileName).filter((x): x is string => x !== null);
    const merged = [...indexedIds, ...fileIds];
    expect(nextAdrId(merged)).toBe("ADR-020");
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
