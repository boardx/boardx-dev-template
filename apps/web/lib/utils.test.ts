import { describe, expect, it } from "vitest";
import { cn } from "./utils";

// 回归守卫（2026-07-09 事故）：自定义字号 text-13 曾被 tailwind-merge 误判成与
// text-primary-foreground 同组，导致 size="sm" 主按钮的文字色被吞、黑底黑字。
// utils.ts 里 extendTailwindMerge 把自定义字号登记进 font-size 组后修复。
describe("cn — 自定义字号不吞文字颜色", () => {
  it("text-primary-foreground 与自定义字号 text-13 共存（核心事故复现）", () => {
    const out = cn("text-primary-foreground text-13");
    expect(out).toContain("text-primary-foreground");
    expect(out).toContain("text-13");
  });

  it("完整 size=sm default 按钮保留文字色", () => {
    const out = cn(
      "bg-primary text-primary-foreground hover:bg-surface-dark active:bg-surface-dark-2 h-8 px-3 text-13"
    );
    expect(out).toContain("text-primary-foreground");
    expect(out).toContain("bg-primary");
    expect(out).toContain("text-13");
  });

  it.each(["9", "10", "11", "13", "15", "17", "22", "26", "30", "34"])(
    "每个自定义字号 text-%s 都不吞文字色",
    (size) => {
      const out = cn(`text-foreground text-${size}`);
      expect(out).toContain("text-foreground");
      expect(out).toContain(`text-${size}`);
    }
  );

  it("两个字号仍正确折叠为后者（未破坏正常合并语义）", () => {
    expect(cn("text-sm text-15")).toBe("text-15");
    expect(cn("text-13 text-17")).toBe("text-17");
  });

  it("两个文字色仍正确折叠为后者", () => {
    expect(cn("text-foreground text-primary-foreground")).toBe("text-primary-foreground");
  });
});

// ADR-013 全档位守卫（2026-07-10 第二起事故：text-12 漏登记再次吞配色）：
// 逐一断言字号表的**每个**档位与文字颜色类共存——新档位只要进了 font-scale.ts
// 单一事实源就自动被本测试覆盖，不可能再出现"登记了类但 merge 不认识"的缝。
import { FONT_SIZE_KEYS } from "./font-scale";

describe("cn() × 字号表全档位（ADR-013 单一事实源守卫）", () => {
  for (const key of FONT_SIZE_KEYS) {
    it(`text-primary-foreground 与 text-${key} 共存`, () => {
      const out = cn(`text-primary-foreground text-${key}`);
      expect(out).toContain("text-primary-foreground");
      expect(out).toContain(`text-${key}`);
    });
  }
  it("同为字号档位时后者正确覆盖前者（merge 语义仍在）", () => {
    expect(cn("text-13 text-15")).toBe("text-15");
  });
});
