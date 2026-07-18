// devportal 单测配置（p30-F02 起）：只跑 tests/**；e2e/**（Playwright）不归 vitest。
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
