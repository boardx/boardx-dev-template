import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        // SQLite-backed DO 与 isolatedStorage 尚不兼容（.sqlite-shm 弹栈断言失败，
        // 见 coord-repohub 同款注释）。测试各用独立 slug/handle 自行隔离。
        isolatedStorage: false,
        singleWorker: true,
        wrangler: { configPath: "./wrangler.toml" },
      },
    },
  },
});
