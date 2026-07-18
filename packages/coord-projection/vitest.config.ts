import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        // 库包无 wrangler.toml，直接给 miniflare 兼容日期（沿用仓内 2026-07-01 纪律）。
        // singleWorker/isolatedStorage 与 coord-repohub 保持同款配置口径。
        isolatedStorage: false,
        singleWorker: true,
        miniflare: { compatibilityDate: "2026-07-01" },
      },
    },
  },
});
