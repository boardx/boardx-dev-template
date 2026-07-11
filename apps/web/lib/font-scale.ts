// font-scale.ts — 字号档位的**单一事实源**（ADR-013 对比度保障策略）。
//
// 为什么必须单源：字号表此前存在两份手抄副本——tailwind.config.ts 的 fontSize
// （决定 text-N 类是否生效）和 lib/utils.ts 的 CUSTOM_FONT_SIZES（决定 tailwind-merge
// 是否认识 text-N 是字号而非文字颜色）。两份清单各自漂移酿成两起真实事故：
//   2026-07-09：cn() 把 text-primary-foreground 误判为与 text-13 同组吞掉 → 黑底黑字；
//   2026-07-10：修复清单漏抄 "12"，text-12 再次吞配色 → AVA 研究类型按钮黑底黑字。
// 教训：手抄清单必然漂移，修清单不如消灭第二份清单。
//
// 从此：tailwind.config.ts 与 utils.ts 都 import 本文件；新增字号只改这里一处，
// 类生效与 merge 识别自动同步。lint-design.sh §1.6 机械校验代码里用到的每个
// text-<数字> 都在本表内（用了未登记档位 = lint 红）。
export const FONT_SIZE_SCALE: Record<string, string> = {
  "9": "9px",
  "10": "10px",
  "11": "11px",
  "12": "12px",
  "13": "13px",
  "14": "14px",
  "15": "15px",
  "17": "17px",
  "18": "18px",
  "20": "20px",
  "21": "21px",
  "22": "22px",
  "26": "26px",
  "30": "30px",
  "34": "34px",
};

export const FONT_SIZE_KEYS = Object.keys(FONT_SIZE_SCALE);
