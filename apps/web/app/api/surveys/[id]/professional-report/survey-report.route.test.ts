import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  callQwenJson: vi.fn(),
  canManageSurveyScope: vi.fn(),
  canViewSurvey: vi.fn(),
  claimSurveyReportGeneration: vi.fn(),
  completeSurveyReportGenerationClaim: vi.fn(),
  createSurveyAiModelTrace: vi.fn(),
  createSurveyAiSession: vi.fn(),
  createVersionedSurveyReportArtifact: vi.fn(),
  ensureSurveyReportCategoryPlan: vi.fn(),
  ensureSurveyReportSourceSnapshot: vi.fn(),
  findReadySurveyReportArtifact: vi.fn(),
  findReadySurveyReportArtifactById: vi.fn(),
  findSurveyReportSourceSnapshot: vi.fn(),
  getSurveyWithQuestions: vi.fn(),
  listReadySurveyReportArtifacts: vi.fn(),
  listSurveyResponses: vi.fn(),
  readSurveyReportCategoryPlan: vi.fn(),
  releaseSurveyReportGenerationClaim: vi.fn(),
  updateSurveyAiSessionStatus: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  currentTeamId: vi.fn(() => 3),
  currentUser: vi.fn(() => Promise.resolve({ id: 7 })),
}));

vi.mock("@/lib/qwen", () => ({
  callQwenJson: mocks.callQwenJson,
}));

vi.mock("@repo/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@repo/data")>();
  return {
    ...actual,
    canManageSurveyScope: mocks.canManageSurveyScope,
    canViewSurvey: mocks.canViewSurvey,
    claimSurveyReportGeneration: mocks.claimSurveyReportGeneration,
    completeSurveyReportGenerationClaim:
      mocks.completeSurveyReportGenerationClaim,
    createSurveyAiModelTrace: mocks.createSurveyAiModelTrace,
    createSurveyAiSession: mocks.createSurveyAiSession,
    createVersionedSurveyReportArtifact:
      mocks.createVersionedSurveyReportArtifact,
    ensureSurveyReportCategoryPlan: mocks.ensureSurveyReportCategoryPlan,
    ensureSurveyReportSourceSnapshot: mocks.ensureSurveyReportSourceSnapshot,
    findReadySurveyReportArtifact: mocks.findReadySurveyReportArtifact,
    findReadySurveyReportArtifactById:
      mocks.findReadySurveyReportArtifactById,
    findSurveyReportSourceSnapshot: mocks.findSurveyReportSourceSnapshot,
    getSurveyWithQuestions: mocks.getSurveyWithQuestions,
    listReadySurveyReportArtifacts: mocks.listReadySurveyReportArtifacts,
    listSurveyResponses: mocks.listSurveyResponses,
    readSurveyReportCategoryPlan: mocks.readSurveyReportCategoryPlan,
    releaseSurveyReportGenerationClaim:
      mocks.releaseSurveyReportGenerationClaim,
    updateSurveyAiSessionStatus: mocks.updateSurveyAiSessionStatus,
  };
});

import { GET, POST } from "./route";

const params = { params: { id: "41" } };
const artifact = {
  id: "10000000-0000-4000-8000-000000000041",
  surveyId: 41,
  sourceRevision: "survey-41-revision",
  requirementHash: "requirement-hash",
  templateVersion: "survey-report-v1",
  responseCount: 1,
  report: {},
  status: "ready",
  modelId: "qwen3.7-max",
  provider: "qwen",
  createdAt: "2026-07-18T08:00:00.000Z",
};

function reportRequest() {
  return new Request("http://test.local/api/surveys/41/professional-report", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
}

describe("POST /api/surveys/:id/professional-report generation claim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canManageSurveyScope.mockResolvedValue(true);
    mocks.canViewSurvey.mockResolvedValue(true);
    mocks.getSurveyWithQuestions.mockResolvedValue({
      id: 41,
      title: "并发报告测试",
      description: "",
      updated_at: "2026-07-18T07:00:00.000Z",
      team_id: 3,
      questions: [{
        id: 11,
        position: 0,
        title: "首要关注项",
        type: "single",
        required: true,
        options: ["安全", "价格"],
        category: "关注项",
      }],
    });
    mocks.listSurveyResponses.mockResolvedValue([{
      id: 91,
      submitted_at: new Date("2026-07-18T07:30:00.000Z"),
      answers: { "11": "安全" },
    }]);
    mocks.ensureSurveyReportCategoryPlan.mockResolvedValue({
      title: "并发报告测试",
      description: "",
      categories: [{
        id: "summary",
        name: "核心结论",
        description: "",
        requirement: "只使用聚合证据。",
        questionIds: [11],
        outputType: "text",
        inputModes: ["text"],
        prompt: "只使用聚合证据。",
        order: 1,
        isCustom: false,
      }],
    });
    mocks.readSurveyReportCategoryPlan.mockImplementation(
      (...args) => mocks.ensureSurveyReportCategoryPlan(...args)
    );
    mocks.ensureSurveyReportSourceSnapshot.mockImplementation(
      (snapshot) => Promise.resolve({ ...snapshot, createdAt: snapshot.generatedAt })
    );
    mocks.findReadySurveyReportArtifact.mockResolvedValue(undefined);
    mocks.findReadySurveyReportArtifactById.mockResolvedValue(undefined);
    mocks.findSurveyReportSourceSnapshot.mockResolvedValue({
      sourceData: { records: [] },
    });
    mocks.listReadySurveyReportArtifacts.mockResolvedValue([]);
    mocks.createSurveyAiSession
      .mockResolvedValueOnce({ id: "20000000-0000-4000-8000-000000000041" })
      .mockResolvedValueOnce({ id: "20000000-0000-4000-8000-000000000042" });
    mocks.claimSurveyReportGeneration
      .mockReset()
      .mockResolvedValueOnce({
        status: "claimed",
        sessionId: "20000000-0000-4000-8000-000000000041",
      })
      .mockResolvedValueOnce({
        status: "in_progress",
        sessionId: "20000000-0000-4000-8000-000000000041",
      });
    mocks.createVersionedSurveyReportArtifact.mockImplementation(
      (input) => Promise.resolve({ ...artifact, report: input.report })
    );
    mocks.createSurveyAiModelTrace.mockResolvedValue(undefined);
    mocks.updateSurveyAiSessionStatus.mockResolvedValue(undefined);
    mocks.completeSurveyReportGenerationClaim.mockResolvedValue(undefined);
    mocks.releaseSurveyReportGenerationClaim.mockResolvedValue(undefined);
  });

  it("lets one concurrent request call the model and returns 202 for the other", async () => {
    let releaseModel!: () => void;
    const modelHeld = new Promise<{ claims: [] }>((resolve) => {
      releaseModel = () => resolve({ claims: [] });
    });
    mocks.callQwenJson
      .mockImplementationOnce(() => modelHeld)
      .mockResolvedValueOnce({ claims: [] });

    const firstResponsePromise = POST(reportRequest(), params);
    await vi.waitFor(() => {
      expect(mocks.callQwenJson).toHaveBeenCalledTimes(1);
    });
    const secondResponse = await POST(reportRequest(), params);
    releaseModel();
    const firstResponse = await firstResponsePromise;
    expect(firstResponse).toBeDefined();
    expect(secondResponse).toBeDefined();
    if (!firstResponse || !secondResponse) {
      throw new Error("report route did not return a response");
    }

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(202);
    await expect(secondResponse.json()).resolves.toMatchObject({
      status: "in_progress",
      sessionId: "20000000-0000-4000-8000-000000000041",
    });
    expect(mocks.claimSurveyReportGeneration).toHaveBeenCalledTimes(2);
    expect(mocks.callQwenJson).toHaveBeenCalledTimes(1);
    expect(mocks.createSurveyAiSession).not.toHaveBeenCalled();
    expect(mocks.createVersionedSurveyReportArtifact).toHaveBeenCalledTimes(1);
  });

  it("redacts raw text records from a reused historical artifact", async () => {
    const canary = "F16_LEGACY_RAW_CANARY_fca1d641";
    const legacyArtifact = {
      ...artifact,
      report: {
        title: "历史报告",
        executiveSummary: {
          claims: [{ statement: `历史模型回显 ${canary}` }],
        },
        actions: [{ action: `继续跟进 ${canary}` }],
        chapters: [{
          questionId: 12,
          textResponses: [canary],
          claims: [{ statement: `章节回显 ${canary}` }],
        }],
      },
    };
    mocks.findReadySurveyReportArtifact.mockResolvedValue(legacyArtifact);
    mocks.listReadySurveyReportArtifacts.mockResolvedValue([legacyArtifact]);
    mocks.findSurveyReportSourceSnapshot.mockResolvedValue({
      sourceData: {
        records: [
          { type: "question", id: 12, questionType: "text" },
          { type: "response", answers: { "12": canary } },
        ],
      },
    });

    const response = await POST(reportRequest(), params);
    expect(response).toBeDefined();
    if (!response) {
      throw new Error("report route did not return a response");
    }
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.reused).toBe(true);
    expect(JSON.stringify(payload)).not.toContain(canary);
    expect(JSON.stringify(payload)).toContain("[开放题原文已脱敏]");
    expect(payload.report.chapters[0]).not.toHaveProperty("textResponses");
  });

  it("loads a complete artifact by id even when it is outside the summary page", async () => {
    const oldArtifact = {
      ...artifact,
      id: "10000000-0000-4000-8000-000000000099",
      report: {
        title: "第 51 个历史版本",
        executiveSummary: { claims: [] },
        chapters: [],
      },
      createdAt: "2026-07-01T08:00:00.000Z",
    };
    mocks.findReadySurveyReportArtifactById.mockImplementation(
      (_surveyId, artifactId) =>
        Promise.resolve(artifactId === oldArtifact.id ? oldArtifact : undefined)
    );
    mocks.listReadySurveyReportArtifacts.mockResolvedValue(
      Array.from({ length: 50 }, (_, index) => ({
        ...artifact,
        id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        report: {},
        createdAt: new Date(Date.UTC(2026, 6, 18, 8, 0, 0) - index * 1000)
          .toISOString(),
      }))
    );

    const response = await GET(
      new Request(
        `http://test.local/api/surveys/41/professional-report?artifactId=${oldArtifact.id}`
      ),
      params
    );
    expect(response).toBeDefined();
    if (!response) {
      throw new Error("report route did not return a response");
    }
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.selectedArtifactId).toBe(oldArtifact.id);
    expect(payload.report.title).toBe("第 51 个历史版本");
    expect(payload.historyPage).toHaveLength(50);
    expect(payload.historyPage[0]).not.toHaveProperty("report");
    expect(payload.nextHistoryCursor).toBeTruthy();
    expect(mocks.findReadySurveyReportArtifactById).toHaveBeenCalledWith(
      41,
      oldArtifact.id
    );
  });

  it("requests the next lightweight history page with its cursor", async () => {
    const before = {
      createdAt: "2026-07-10T08:00:00.000Z",
      id: "10000000-0000-4000-8000-000000000050",
    };
    const cursor = Buffer.from(JSON.stringify(before)).toString("base64url");

    const response = await GET(
      new Request(
        `http://test.local/api/surveys/41/professional-report?historyBefore=${encodeURIComponent(cursor)}`
      ),
      params
    );
    expect(response).toBeDefined();
    if (!response) {
      throw new Error("report route did not return a response");
    }

    expect(response.status).toBe(200);
    expect(mocks.listReadySurveyReportArtifacts).toHaveBeenLastCalledWith(41, {
      before,
    });
  });

  it("fails closed when a historical artifact has no source snapshot", async () => {
    mocks.findReadySurveyReportArtifact.mockResolvedValue(artifact);
    mocks.findSurveyReportSourceSnapshot.mockResolvedValue(undefined);

    const response = await GET(
      new Request("http://test.local/api/surveys/41/professional-report"),
      params
    );

    expect(response?.status).toBe(500);
    await expect(response?.json()).resolves.toEqual({
      error: "professional_report_load_failed",
    });
  });

  it("rejects a malformed artifact id without querying PostgreSQL", async () => {
    const response = await GET(
      new Request(
        "http://test.local/api/surveys/41/professional-report?artifactId=missing-artifact"
      ),
      params
    );

    expect(response?.status).toBe(404);
    await expect(response?.json()).resolves.toEqual({
      error: "report_version_not_found",
    });
    expect(mocks.findReadySurveyReportArtifactById).not.toHaveBeenCalled();
  });

  it("uses only the persisted plan hash even when a legacy instruction is sent", async () => {
    mocks.callQwenJson.mockResolvedValue({ claims: [] });

    const first = await POST(new Request(
      "http://test.local/api/surveys/41/professional-report",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instruction: "临时要求 A" }),
      }
    ), params);
    const second = await POST(new Request(
      "http://test.local/api/surveys/41/professional-report",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instruction: "临时要求 B" }),
      }
    ), params);

    expect(first?.status).toBe(200);
    expect(second?.status).toBe(202);
    const firstClaim = mocks.claimSurveyReportGeneration.mock.calls[0]?.[0];
    const secondClaim = mocks.claimSurveyReportGeneration.mock.calls[1]?.[0];
    expect(firstClaim?.requirementHash).toBeTruthy();
    expect(secondClaim?.requirementHash).toBe(firstClaim?.requirementHash);
  });

  it("returns a business error without claiming generation when there are no responses", async () => {
    mocks.listSurveyResponses.mockResolvedValue([]);

    const response = await POST(reportRequest(), params);

    expect(response?.status).toBe(422);
    await expect(response?.json()).resolves.toEqual({
      error: "report_requires_responses",
      minimumResponseCount: 1,
    });
    expect(mocks.claimSurveyReportGeneration).not.toHaveBeenCalled();
    expect(mocks.callQwenJson).not.toHaveBeenCalled();
    expect(mocks.createVersionedSurveyReportArtifact).not.toHaveBeenCalled();
  });

  it("never sends raw text responses to the model", async () => {
    const canary = "F16_ROUTE_MODEL_CANARY_72b15";
    mocks.getSurveyWithQuestions.mockResolvedValue({
      id: 41,
      title: "隐私测试",
      description: "",
      updated_at: "2026-07-18T07:00:00.000Z",
      team_id: 3,
      questions: [
        {
          id: 11,
          position: 0,
          title: "首要关注项",
          type: "single",
          required: true,
          options: ["安全", "价格"],
          category: "关注项",
        },
        {
          id: 12,
          position: 1,
          title: "补充建议",
          type: "text",
          required: false,
          options: [],
          category: "关注项",
        },
      ],
    });
    mocks.listSurveyResponses.mockResolvedValue([{
      id: 91,
      submitted_at: new Date("2026-07-18T07:30:00.000Z"),
      answers: { "11": "安全", "12": canary },
    }]);
    mocks.callQwenJson.mockResolvedValue({ claims: [] });

    const response = await POST(reportRequest(), params);

    expect(response?.status).toBe(200);
    const modelRequest = mocks.callQwenJson.mock.calls[0]?.[0];
    expect(JSON.stringify(modelRequest)).not.toContain(canary);
  });

  it("does not publish a partial version when a template chapter fails evidence validation", async () => {
    mocks.claimSurveyReportGeneration.mockReset().mockResolvedValue({
      status: "claimed",
      sessionId: "20000000-0000-4000-8000-000000000041",
    });
    mocks.callQwenJson.mockResolvedValue({
      headline: "无效结论",
      claims: [{
        statement: "没有来源的结论",
        evidenceId: "missing-evidence",
        value: 99,
        denominator: 100,
      }],
    });

    const response = await POST(reportRequest(), params);

    expect(response?.status).toBe(500);
    expect(mocks.createVersionedSurveyReportArtifact).not.toHaveBeenCalled();
    expect(mocks.completeSurveyReportGenerationClaim).not.toHaveBeenCalled();
    expect(mocks.releaseSurveyReportGenerationClaim).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "20000000-0000-4000-8000-000000000041",
        errorMessage: "report_text_evidence_invalid",
      })
    );
  });
});
