import { describe, it, expect } from "vitest";
import { resolveDbConfig } from "./index";

// 纯函数单测：不连真实数据库（真实 DB 交互由 harness verify + docker 覆盖）。
describe("resolveDbConfig", () => {
  it("优先使用 DATABASE_URL", () => {
    const cfg = resolveDbConfig({ DATABASE_URL: "postgresql://u:p@h:5432/db" } as NodeJS.ProcessEnv);
    expect(cfg.connectionString).toBe("postgresql://u:p@h:5432/db");
  });

  it("无 DATABASE_URL 时用 PG* 拼，缺省回退本地", () => {
    const cfg = resolveDbConfig({} as NodeJS.ProcessEnv);
    expect(cfg.connectionString).toBe("postgresql://boardx:boardx@localhost:5432/boardx");
  });

  it("PG* 覆盖缺省", () => {
    const cfg = resolveDbConfig({
      PGHOST: "db.internal",
      PGPORT: "6543",
      PGUSER: "alice",
      PGPASSWORD: "secret",
      PGDATABASE: "app",
    } as NodeJS.ProcessEnv);
    expect(cfg.connectionString).toBe("postgresql://alice:secret@db.internal:6543/app");
  });
});
