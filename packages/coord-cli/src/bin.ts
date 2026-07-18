#!/usr/bin/env node
// coord CLI 可执行入口：真实副作用只在这里注入（cli.ts 保持可注入、可单测）。
import { main } from "./cli.js";

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(`coord: 未预期错误：${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  });
