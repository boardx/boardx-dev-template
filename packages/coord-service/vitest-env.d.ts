import type { D1Migration } from "@cloudflare/vitest-pool-workers/config";
import type { Env as CoordServiceEnv } from "./src/db/types";

declare module "cloudflare:test" {
  interface ProvidedEnv extends CoordServiceEnv {
    // Injected via vitest.config.ts's miniflare.bindings — see test/apply-migrations.ts
    TEST_MIGRATIONS: D1Migration[];
  }
}
