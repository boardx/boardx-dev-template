import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizeAiStoreItemType,
  updateAiStoreItem,
} from "./aiStore";
import { query } from "./index";

vi.mock("./index", () => ({ query: vi.fn() }));
const mockQuery = vi.mocked(query);

const skillDraft = {
  type: "skill" as const,
  scope: "platform" as const,
  status: "draft" as const,
  ownerUserId: 11,
  originTeamId: 101,
  name: "Image Skill",
  description: "Creates images.",
  author: "Owner",
  config: { instructions: "Create an image", skillKind: "image" },
};

describe("AI Store Skills model", () => {
  it("normalizes both legacy tool families into one Skill type", () => {
    expect(normalizeAiStoreItemType("ai-tool")).toEqual({
      type: "skill",
      skillKind: "text",
    });
    expect(normalizeAiStoreItemType("AI_TOOL")).toEqual({
      type: "skill",
      skillKind: "text",
    });
    expect(normalizeAiStoreItemType("image-tool")).toEqual({
      type: "skill",
      skillKind: "image",
    });
    expect(normalizeAiStoreItemType("AI_IMAGE_TOOL")).toEqual({
      type: "skill",
      skillKind: "image",
    });
  });

  it("rejects an unknown public item type", () => {
    expect(normalizeAiStoreItemType("dataset")).toBeUndefined();
  });
});

describe("AI Store live version updates", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("increments version, preserves approved status, and uses optimistic locking", async () => {
    mockQuery.mockResolvedValueOnce([{ id: 1, version: 4, status: "approved" }]);

    await updateAiStoreItem(1, 11, 101, 3, skillDraft);

    const [sql, params] = mockQuery.mock.calls[0]!;
    expect(sql).toContain("version = version + 1");
    expect(sql).toContain("WHEN status IN ('approved', 'published') THEN status");
    expect(sql).toContain("version = $4");
    expect(sql).toContain("ai_store_revision_audit");
    expect(params?.slice(0, 4)).toEqual([1, 11, 101, 3]);
  });
});

describe("Skills/version migration", () => {
  it("migrates legacy values in place and adds version/audit constraints", () => {
    const sql = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "..",
        "migrations",
        "040_ai_store_skills_versioning.sql",
      ),
      "utf8",
    );

    expect(sql).toContain("WHEN type IN ('ai-tool', 'AI_TOOL') THEN 'text'");
    expect(sql).toContain("WHEN type IN ('image-tool', 'AI_IMAGE_TOOL') THEN 'image'");
    expect(sql).toMatch(/SET[\s\S]*type\s*=\s*'skill'/);
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS version");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS ai_store_revision_audit");
    expect(sql).toContain("CHECK (type IN ('agent', 'skill', 'template'))");
  });
});
