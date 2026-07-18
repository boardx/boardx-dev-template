#!/usr/bin/env node
// 测试入口适配：feature 验收契约用 `--grep`（mocha 系惯例），vitest 只认 -t/--testNamePattern。
// 这里做纯翻译后透传 vitest，不改变任何测试语义。
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const passthrough = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--grep") {
    passthrough.push("-t", args[++i] ?? "");
  } else {
    passthrough.push(args[i]);
  }
}
const r = spawnSync("pnpm", ["exec", "vitest", "run", ...passthrough], { stdio: "inherit" });
process.exit(r.status ?? 1);
