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
  getSurveyWithQuestions: vi.fn(),
  listReadySurveyReportArtifacts: vi.fn(),
  listSurveyResponses: vi.fn(),
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
    getSurveyWithQuestions: mocks.getSurveyWithQuestions,
    listReadySurveyReportArtifacts: mocks.listReadySurveyReportArtifacts,
    listSurveyResponses: mocks.listSurveyResponses,
    releaseSurveyReportGenerationClaim:
      mocks.releaseSurveyReportGenerationClaim,
    updateSurveyAiSessionStatus: mocks.updateSurveyAiSessionStatus,
  };
});

import { POST } from "./route";

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
    mocks.ensureSurveyReportSourceSnapshot.mockImplementation(
      (snapshot) => Promise.resolve({ ...snapshot, createdAt: snapshot.generatedAt })
    );
    mocks.findReadySurveyReportArtifact.mockResolvedValue(undefined);
    mocks.listReadySurveyReportArtifacts.mockResolvedValue([]);
    mocks.createSurveyAiSession
      .mockResolvedValueOnce({ id: "20000000-0000-4000-8000-000000000041" })
      .mockResolvedValueOnce({ id: "20000000-0000-4000-8000-000000000042" });
    mocks.claimSurveyReportGeneration
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
        chapters: [{ questionId: 12, textResponses: [canary] }],
      },
    };
    mocks.findReadySurveyReportArtifact.mockResolvedValue(legacyArtifact);
    mocks.listReadySurveyReportArtifacts.mockResolvedValue([legacyArtifact]);

    const response = await POST(reportRequest(), params);
    expect(response).toBeDefined();
    if (!response) {
      throw new Error("report route did not return a response");
    }
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.reused).toBe(true);
    expect(JSON.stringify(payload)).not.toContain(canary);
    expect(payload.report.chapters[0]).not.toHaveProperty("textResponses");
  });
});
