import path from "node:path";
import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig(async () => {
  const migrationsPath = path.join(__dirname, "migrations");
  const migrations = await readD1Migrations(migrationsPath);

  return {
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
      poolOptions: {
        workers: {
          wrangler: { configPath: "./wrangler.toml" },
          miniflare: {
            // Exposed to the Worker under test as env.TEST_MIGRATIONS so
            // test/apply-migrations.ts can apply the real schema before any
            // test runs — wrangler.toml's migrations_dir only wires up the
            // `wrangler d1 migrations apply` CLI path, not this test pool.
            bindings: { TEST_MIGRATIONS: migrations },
          },
        },
      },
    },
  };
});
