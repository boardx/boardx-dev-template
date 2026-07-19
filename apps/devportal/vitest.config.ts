// devportal 单测配置（p30-F02 起）：只跑 tests/**；e2e/**（Playwright）不归 vitest。
// p30/F07：新增 resolve.alias 让 tests/ 里能直接 import 用 "@/..." 写的 route
// handler（app/api/portal/** 用 tsconfig 的 "@/*" 别名），同 tsconfig.json paths。
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
