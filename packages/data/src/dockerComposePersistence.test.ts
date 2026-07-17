import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const composePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "infra",
  "docker-compose.yml",
);
const initPath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "init.sh");

describe("local Docker data persistence", () => {
  it("uses project-scoped named volumes for stateful services", () => {
    const compose = readFileSync(composePath, "utf8");

    expect(compose).toContain("- postgres_data:/var/lib/postgresql/data");
    expect(compose).toContain("- redis_data:/data");
    expect(compose).toContain("- minio_data:/data");
    expect(compose).toMatch(
      /\nvolumes:\n  postgres_data:\n  redis_data:\n  minio_data:\s*$/,
    );
  });

  it("runs migrations after starting a fresh local infrastructure stack", () => {
    const init = readFileSync(initPath, "utf8");
    const composeStart = init.indexOf("docker compose -f infra/docker-compose.yml up -d --wait");
    const migrate = init.indexOf("pnpm --filter @repo/data run migrate");

    expect(composeStart).toBeGreaterThan(-1);
    expect(migrate).toBeGreaterThan(composeStart);
  });
});
