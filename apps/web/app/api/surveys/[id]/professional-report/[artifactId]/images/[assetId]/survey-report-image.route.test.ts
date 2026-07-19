import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canViewSurvey: vi.fn(),
  currentUser: vi.fn(),
  findReadySurveyReportArtifactById: vi.fn(),
  presignGetUrl: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  currentTeamId: vi.fn(() => 3),
  currentUser: mocks.currentUser,
}));

vi.mock("@repo/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@repo/data")>();
  return {
    ...actual,
    canViewSurvey: mocks.canViewSurvey,
    findReadySurveyReportArtifactById:
      mocks.findReadySurveyReportArtifactById,
  };
});

vi.mock("@repo/storage", () => ({
  presignGetUrl: mocks.presignGetUrl,
}));

import { GET } from "./route";

const params = {
  params: {
    id: "41",
    artifactId: "10000000-0000-4000-8000-000000000041",
    assetId: "visual-summary",
  },
};

describe("GET professional report image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentUser.mockResolvedValue({ id: 7 });
    mocks.canViewSurvey.mockResolvedValue(true);
    mocks.findReadySurveyReportArtifactById.mockResolvedValue({
      id: params.params.artifactId,
      surveyId: 41,
      report: {
        schemaVersion: "template-driven-report-v1",
        chapters: [{
          chapterId: "visual-summary",
          outputType: "image",
          assetId: "visual-summary",
          assetKey:
            "survey-reports/3/41/10000000-0000-4000-8000-000000000041/visual-summary.png",
        }],
      },
    });
    mocks.presignGetUrl.mockResolvedValue(
      "https://storage.example/signed-image"
    );
  });

  it("redirects an authorized report image to a five-minute signed URL", async () => {
    const response = await GET(
      new Request("http://test.local/report-image"),
      params
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location"))
      .toBe("https://storage.example/signed-image");
    expect(mocks.presignGetUrl).toHaveBeenCalledWith(
      expect.stringContaining("/visual-summary.png"),
      300
    );
  });

  it("does not sign an object key for an asset outside the artifact", async () => {
    const response = await GET(
      new Request("http://test.local/report-image"),
      {
        params: {
          ...params.params,
          assetId: "unrelated-image",
        },
      }
    );

    expect(response.status).toBe(404);
    expect(mocks.presignGetUrl).not.toHaveBeenCalled();
  });
});
