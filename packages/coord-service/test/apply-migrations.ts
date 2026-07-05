import { applyD1Migrations, env } from "cloudflare:test";

// Applies the real migrations/0001_init.sql schema to the ephemeral D1 instance
// before any test file runs, so every test gets a real, fresh, migrated database
// — including the partial unique index the concurrency test depends on.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
