import { defineConfig } from "vitest/config";

// 单元测试只跑 lib/ 下的 *.test.ts；e2e/（Playwright）由 `pnpm e2e` 单独跑，排除掉。
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
  },
});
