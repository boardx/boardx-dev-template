import { describe, expect, it, vi } from "vitest";
import { generateAndStoreSurveyReportImage } from "./wan-image";

describe("generateAndStoreSurveyReportImage", () => {
  it("downloads a Wan image and persists it without retaining the vendor URL", async () => {
    const vendorUrl = "https://temporary.example/report-image.png";
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        output: {
          choices: [{
            message: {
              content: [{ type: "image", image: vendorUrl }],
            },
          }],
        },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(png, {
        status: 200,
        headers: {
          "content-type": "image/png",
          "content-length": String(png.byteLength),
        },
      }));
    const ensureBucketImpl = vi.fn().mockResolvedValue(undefined);
    const putObjectImpl = vi.fn().mockResolvedValue(undefined);

    const result = await generateAndStoreSurveyReportImage({
      apiKey: "test-key",
      prompt: "专业的经营诊断信息图，不包含文字和数字。",
      teamId: 7,
      surveyId: 59,
      artifactId: "artifact-id",
      chapterId: "visual-summary",
      altText: "经营诊断核心场景信息图",
      caption: "根据匿名聚合洞察生成。",
    }, {
      fetchImpl,
      ensureBucketImpl,
      putObjectImpl,
    });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/services/aigc/multimodal-generation/generation"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer test-key",
          "content-type": "application/json",
        }),
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      vendorUrl,
      expect.objectContaining({ method: "GET" })
    );
    expect(ensureBucketImpl).toHaveBeenCalledTimes(1);
    expect(putObjectImpl).toHaveBeenCalledWith(
      "survey-reports/7/59/artifact-id/visual-summary.png",
      png,
      "image/png"
    );
    expect(result).toEqual({
      assetId: "visual-summary",
      objectKey: "survey-reports/7/59/artifact-id/visual-summary.png",
      altText: "经营诊断核心场景信息图",
      caption: "根据匿名聚合洞察生成。",
    });
    expect(JSON.stringify(result)).not.toContain(vendorUrl);
  });

  it("rejects non-image downloads and oversized image responses", async () => {
    const generated = () => new Response(JSON.stringify({
        output: {
          choices: [{
            message: {
              content: [{ type: "image", image: "https://temporary.example/file" }],
            },
          }],
        },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    const baseInput = {
      apiKey: "test-key",
      prompt: "专业信息图",
      teamId: 7,
      surveyId: 59,
      artifactId: "artifact-id",
      chapterId: "visual-summary",
      altText: "信息图",
      caption: "说明",
    };
    const dependencies = {
      ensureBucketImpl: vi.fn(),
      putObjectImpl: vi.fn(),
    };

    await expect(generateAndStoreSurveyReportImage(baseInput, {
      ...dependencies,
      fetchImpl: vi.fn()
        .mockResolvedValueOnce(generated())
        .mockResolvedValueOnce(new Response("not image", {
          status: 200,
          headers: { "content-type": "text/plain" },
        })),
    })).rejects.toThrow("wan_image_content_type_invalid");

    await expect(generateAndStoreSurveyReportImage(baseInput, {
      ...dependencies,
      fetchImpl: vi.fn()
        .mockResolvedValueOnce(generated())
        .mockResolvedValueOnce(new Response(Buffer.from([1]), {
          status: 200,
          headers: {
            "content-type": "image/png",
            "content-length": String(10 * 1024 * 1024 + 1),
          },
        })),
    })).rejects.toThrow("wan_image_too_large");
    expect(dependencies.putObjectImpl).not.toHaveBeenCalled();
  });
});
