import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "migrations",
  "039_ai_store_team_tenancy.sql",
);
const platformRecoveryMigrationPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "migrations",
  "047_ai_store_platform_team_recovery.sql",
);

describe("AI Store Team migration audit", () => {
  it("backfills only an existing Team or an owner's unique Team", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("origin_team_id = team_id");
    expect(sql).toContain("HAVING COUNT(*) = 1");
    expect(sql).toContain("MIN(team_id)");
    expect(sql).not.toContain("LIMIT 1");
  });

  it("quarantines unresolved resources and subscriptions without deleting relations", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("ai_store_team_migration_audit");
    expect(sql).toContain("migration_quarantined_at");
    expect(sql).toContain("consumer_team_id");
    expect(sql).toContain("unresolved_origin_team");
    expect(sql).toContain("unresolved_consumer_team");
    expect(sql).not.toMatch(/DELETE\s+FROM\s+ai_store_(items|subscriptions)/i);
  });

  it("is idempotent and constrains every active row to a Team", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("IF NOT EXISTS");
    expect(sql).toContain("ON CONFLICT");
    expect(sql).toContain("origin_team_id IS NOT NULL OR migration_quarantined_at IS NOT NULL");
    expect(sql).toContain("consumer_team_id IS NOT NULL OR migration_quarantined_at IS NOT NULL");
  });

  it("recovers only quarantined platform resources into an explicit BoardX system Team", () => {
    const sql = readFileSync(platformRecoveryMigrationPath, "utf8");

    expect(sql).toContain("ai-store-system@boardx.internal");
    expect(sql).toContain("BoardX AI Store");
    expect(sql).toContain("scope = 'platform'");
    expect(sql).toContain("migration_quarantined_at IS NOT NULL");
    expect(sql).toContain("migration_quarantined_at = NULL");
    expect(sql).toContain("origin_team_id = system_team.id");
    expect(sql).not.toMatch(/DELETE\s+FROM\s+ai_store_/i);
  });
});
