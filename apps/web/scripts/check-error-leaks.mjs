#!/usr/bin/env node
// check-error-leaks.mjs — API 错误泄漏门控（ADR-015 / #539 / #669）。
//
// 为什么不是一行 grep：#669 最初用 `grep "NextResponse.json(.*e\.message"` 做门控，
// 有三个假阴性，恰好把仓库里一处真泄漏（surveys/ai/route.ts 的 `error.message`）漏过去，
// 门却是绿的——比没有门控更糟，因为它让人相信"绿=没泄漏"。三个盲区：
//   1. 变量名只覆盖 err/e —— `error.message` 里 `.message` 前是 `r`，`e\.message` 匹配不到；
//   2. 逐行 grep —— 跨行的 `NextResponse.json(\n { error: err.message` 漏；
//   3. `--include="route.ts"` —— 只扫文件名恰为 route.ts 的，payload.ts / devportal 全漏。
// 括号平衡扫描一次解决全部三个，且能被真实泄漏验证（补丁前红、补丁后绿）。
//
// 抓什么：回给客户端的响应体里，**异常变量**的 `.message` 或 `String(<异常变量>)`。
// 放行什么：zod/校验的 `validation.message`（是故意展示给用户的可读提示，不是内部错误细节）、
//   服务端日志 `console.error(...)`（不出网）、入库 trace `errorMessage: String(err)`（不出网）。
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url)); // apps/web/scripts
const ROOTS = [
  join(HERE, "..", "app", "api"),              // apps/web/app/api
  join(HERE, "..", "..", "devportal", "app", "api"), // apps/devportal/app/api（ADR-015 主打"零运行时分裂"，devportal 同样纳管）
];

// 异常变量命名超集：err/error/e/ex/exc/caught（+可选数字后缀 err2/e2）。
// 刻意不含任意标识符——`validation.message`、`item.message` 等业务字段不是泄漏。
const EXC = "(?:err|error|e|ex|exc|caught)[0-9]?";
const LEAK = new RegExp(`\\b${EXC}\\.message\\b|\\bString\\(\\s*${EXC}\\s*\\)`);

const RESP = /\b(?:NextResponse|Response)\s*\.\s*json\s*\(/g;

function tsFiles(dir) {
  let out = [];
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out = out.concat(tsFiles(p));
    else if (/\.ts$/.test(e) && !/\.test\.ts$/.test(e)) out.push(p);
  }
  return out;
}

// 从 `.json(` 的左括号处做括号平衡，返回参数文本 + 它覆盖到的结束下标。
function balanced(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (c === "(") depth++;
    else if (c === ")") { depth--; if (depth === 0) return { text: src.slice(openIdx, i + 1), end: i }; }
  }
  return { text: src.slice(openIdx), end: src.length };
}

// 去掉行注释（// …）——避免注释里的示例被误报；保守只处理独立 // 段。
function stripLineComments(text) {
  return text.replace(/\/\/[^\n]*/g, "");
}

const findings = [];
for (const root of ROOTS) {
  for (const file of tsFiles(root)) {
    const src = readFileSync(file, "utf8");
    RESP.lastIndex = 0;
    let m;
    while ((m = RESP.exec(src))) {
      const openParen = src.indexOf("(", m.index);
      if (openParen < 0) continue;
      const { text } = balanced(src, openParen);
      if (LEAK.test(stripLineComments(text))) {
        const line = src.slice(0, m.index).split("\n").length;
        findings.push(`${relative(process.cwd(), file)}:${line}`);
      }
      RESP.lastIndex = openParen + 1;
    }
  }
}

if (findings.length) {
  console.error("✗ API 路由把内部错误细节回传客户端（改用通用文案 + console.error 落日志，见 ADR-015）:");
  for (const f of findings) console.error("  " + f);
  process.exit(1);
}
console.log("· API 错误泄漏门控：0 泄漏");
