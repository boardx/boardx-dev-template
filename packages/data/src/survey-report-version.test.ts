import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import {
  buildSurveyReportSourceSnapshot,
  hashSurveyReportRequirement,
  type SurveyReportSourceSnapshotInput,
} from "./surveyReportVersion";

const generatedAt = "2026-07-18T03:20:00.000Z";

function sourceWithResponses(
  responses: SurveyReportSourceSnapshotInput["responses"]
): SurveyReportSourceSnapshotInput {
  return {
    survey: {
      id: 7,
      title: "商品安全调研",
      description: "了解消费者对商品安全的认知。",
      updatedAt: "2026-07-18T03:00:00.000Z",
    },
    questions: [
      {
        id: 11,
        position: 0,
        title: "你最关注哪项安全信息？",
        type: "single",
        required: true,
        options: ["成分", "认证"],
        category: "安全认知",
      },
    ],
    responses,
  };
}

function response(id: number, answer: string, submittedAt: string) {
  return {
    id,
    submittedAt,
    answers: { "11": answer },
  };
}

describe("survey report source revisions", () => {
  it("reuses a source revision when only input order changes", () => {
    const firstResponse = response(1, "成分", "2026-07-18T01:00:00.000Z");
    const secondResponse = response(2, "认证", "2026-07-18T02:00:00.000Z");

    const first = buildSurveyReportSourceSnapshot(
      sourceWithResponses([secondResponse, firstResponse]),
      generatedAt
    );
    const second = buildSurveyReportSourceSnapshot(
      sourceWithResponses([firstResponse, secondResponse]),
      "2026-07-18T04:00:00.000Z"
    );

    expect(second.sourceRevision).toBe(first.sourceRevision);
    expect(second.contentHash).toBe(first.contentHash);
  });

  it("changes the source revision when an answer changes", () => {
    const first = buildSurveyReportSourceSnapshot(
      sourceWithResponses([response(1, "成分", "2026-07-18T01:00:00.000Z")]),
      generatedAt
    );
    const second = buildSurveyReportSourceSnapshot(
      sourceWithResponses([response(1, "认证", "2026-07-18T01:00:00.000Z")]),
      generatedAt
    );

    expect(second.sourceRevision).not.toBe(first.sourceRevision);
    expect(second.contentHash).not.toBe(first.contentHash);
  });

  it("omits respondent identity from the source data", () => {
    const identifiedResponse = {
      ...response(1, "成分", "2026-07-18T01:00:00.000Z"),
      respondentUserId: 991,
    };
    const snapshot = buildSurveyReportSourceSnapshot(
      sourceWithResponses([identifiedResponse]),
      generatedAt
    );
    const serialized = JSON.stringify(snapshot.sourceData);

    expect(serialized).not.toContain("respondentUserId");
    expect(serialized).not.toContain("respondent_user_id");
    expect(serialized).not.toContain("991");
  });

  it("normalizes whitespace before hashing requirements", () => {
    expect(hashSurveyReportRequirement("先结论  后证据"))
      .toBe(hashSurveyReportRequirement("  先结论\n后证据  "));
  });
});

describe("survey report version persistence migration", () => {
  it("creates reusable source snapshots and a unique ready artifact key", () => {
    const sql = readFileSync(
      new URL("../migrations/048_survey_report_versions.sql", import.meta.url),
      "utf8"
    );

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS survey_report_source_snapshots");
    expect(sql).toContain("UNIQUE (survey_id, content_hash)");
    expect(sql).toContain("source_revision");
    expect(sql).toContain("requirement_hash");
    expect(sql).toContain("template_version");
    expect(sql).toContain("WHERE status = 'ready'");
  });

  it("creates a durable generation claim keyed by every artifact dimension", () => {
    const migrationUrl = new URL(
      "../migrations/049_survey_report_generation_claims.sql",
      import.meta.url
    );
    expect(existsSync(migrationUrl)).toBe(true);
    if (!existsSync(migrationUrl)) return;
    const sql = readFileSync(migrationUrl, "utf8");

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS survey_report_generation_claims");
    expect(sql).toContain(
      "PRIMARY KEY (survey_id, source_revision, requirement_hash, template_version)"
    );
    expect(sql).toContain("session_id uuid NOT NULL");
    expect(sql).toContain("status text NOT NULL");
  });
});
