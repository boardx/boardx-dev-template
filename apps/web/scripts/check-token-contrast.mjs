#!/usr/bin/env node
// check-token-contrast.mjs — 主题 token 对的 WCAG 对比度机械门禁。
//
// 2026-07-09 对比度复盘的架构落点：主题里每个「色面 X + X-foreground」token 对
// 必须过对比度线，由本脚本在 lint 阶段机械计算——不再依赖任何人用肉眼盯截图。
// 起因：Rooms Create 按钮禁用态灰底灰字（bg-primary + disabled:opacity-50 的
// 组合把黑底白字整体压成 ~2:1 的灰对灰）。
//
// 阈值：
// - 中性对（background/card/popover/primary/secondary/muted/accent/disabled）≥ 4.5:1
//   （WCAG AA 正文线；这些对承载任意字号的文字）
// - 状态色对（destructive/success）≥ 3:1（WCAG 大字/UI 组件线；这两对只用于
//   粗体按钮文字和状态提示，行业通用的警示红/成功绿在 4.5 线下无法保持色相辨识度，
//   这是显式记录的取舍，不是漏检）
// 明暗两套主题都检查。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf8");

const NEUTRAL_PAIRS = ["background", "card", "popover", "primary", "secondary", "muted", "accent", "disabled", "survey-accent"];
const STATUS_PAIRS = ["destructive", "success"];

function parseVars(block) {
  const vars = {};
  for (const m of block.matchAll(/--([\w-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/g)) {
    vars[m[1]] = { h: Number(m[2]), s: Number(m[3]) / 100, l: Number(m[4]) / 100 };
  }
  return vars;
}

function hslToRgb({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m];
}

function luminance(hsl) {
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const [r, g, b] = hslToRgb(hsl).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// 提取 :root 与 .dark 两个块（.dark 缺省时继承 :root 的值）
const rootMatch = css.match(/:root\s*\{([\s\S]*?)\n  \}/);
const darkMatch = css.match(/\.dark\s*\{([\s\S]*?)\n  \}/);
if (!rootMatch) {
  console.error("✗ check-token-contrast: 找不到 :root token 块");
  process.exit(1);
}
const rootVars = parseVars(rootMatch[1]);
const darkVars = darkMatch ? { ...rootVars, ...parseVars(darkMatch[1]) } : null;

let failed = false;
function checkTheme(name, vars) {
  for (const [pairs, threshold] of [[NEUTRAL_PAIRS, 4.5], [STATUS_PAIRS, 3.0]]) {
    for (const base of pairs) {
      const bg = vars[base];
      const fg = vars[`${base}-foreground`] ?? vars["foreground"];
      if (!bg || !fg) {
        console.error(`✗ [${name}] token 对缺失：--${base} / --${base}-foreground`);
        failed = true;
        continue;
      }
      const ratio = contrast(bg, fg);
      if (ratio < threshold) {
        console.error(
          `✗ [${name}] --${base} 与 --${base}-foreground 对比度 ${ratio.toFixed(2)}:1 < ${threshold}:1——` +
            `调整 token 值，不要在组件层用 opacity/覆盖类绕过`
        );
        failed = true;
      }
    }
  }
}

checkTheme("light", rootVars);
if (darkVars) checkTheme("dark", darkVars);

if (failed) process.exit(1);
console.log("✓ token 对比度：全部色面/文字对过线（中性 ≥4.5:1，状态色 ≥3:1，明暗两套）");
