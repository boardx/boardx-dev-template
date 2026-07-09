import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// 自定义字号档（键 = px 数字），必须与 tailwind.config.ts 的 theme.extend.fontSize
// 保持一致。tailwind-merge 默认只认得内置字号 scale（xs/sm/base/lg/…），不认识
// 这些 text-13/text-15/… 自定义档——于是会把 `text-13`（字号）误判成和
// `text-primary-foreground`（文字颜色）同组，合并时把后者吞掉。真实事故（2026-07-09）：
// Rooms/Boards 的 Create 按钮（size="sm" → 含 text-13）经 cn() 合并后
// text-primary-foreground 被吞，黑底继承父级 foreground 变成黑底黑字（约 1.1:1）。
// 这里显式把自定义字号登记进 font-size 组，cn() 从此对"自定义字号 + 文字色"的组合
// 合并正确——全仓一次性修好，不止这一个按钮。
const CUSTOM_FONT_SIZES = ["9", "10", "11", "13", "15", "17", "22", "26", "30", "34"];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": CUSTOM_FONT_SIZES.map((n) => ({ text: [n] })),
    },
  },
});

// shadcn 惯用的 className 合并工具
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
