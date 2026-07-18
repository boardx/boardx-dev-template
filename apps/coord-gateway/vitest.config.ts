import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        // 同 coord-repohub：SQLite DO 与 isolatedStorage 不兼容
        isolatedStorage: false,
        singleWorker: true,
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          bindings: {
            GITHUB_WEBHOOK_SECRET: "test-webhook-secret",
            COORD_API_TOKEN: "test-api-token",
          },
        },
      },
    },
  },
});
