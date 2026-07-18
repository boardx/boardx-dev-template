import {
  buildSurveyReportImageObjectKey,
  ensureBucket,
  putObject,
} from "@repo/storage";

const MAX_REPORT_IMAGE_BYTES = 10 * 1024 * 1024;

interface WanImageInput {
  apiKey?: string;
  prompt: string;
  teamId: string | number;
  surveyId: string | number;
  artifactId: string;
  chapterId: string;
  altText: string;
  caption: string;
}

interface WanImageDependencies {
  fetchImpl?: typeof fetch;
  ensureBucketImpl?: typeof ensureBucket;
  putObjectImpl?: typeof putObject;
}

export interface StoredSurveyReportImage {
  assetId: string;
  objectKey: string;
  altText: string;
  caption: string;
}

function wanImageUrl(payload: unknown, imageBaseUrl: string): string {
  if (!payload || typeof payload !== "object") {
    throw new Error("wan_image_response_invalid");
  }
  const output = (payload as { output?: unknown }).output;
  if (!output || typeof output !== "object") {
    throw new Error("wan_image_response_invalid");
  }
  const choices = (output as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) {
    throw new Error("wan_image_response_invalid");
  }
  for (const choice of choices) {
    if (!choice || typeof choice !== "object") continue;
    const message = (choice as { message?: unknown }).message;
    if (!message || typeof message !== "object") continue;
    const content = (message as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const item of content) {
      if (
        item
        && typeof item === "object"
        && (item as { type?: unknown }).type === "image"
      ) {
        const image = String((item as { image?: unknown }).image ?? "").trim();
        if (image.startsWith("https://")) return image;
        try {
          const candidate = new URL(image);
          const configured = new URL(imageBaseUrl);
          if (
            candidate.origin === configured.origin
            && ["127.0.0.1", "localhost"].includes(candidate.hostname)
          ) {
            return image;
          }
        } catch {
          continue;
        }
      }
    }
  }
  throw new Error("wan_image_response_invalid");
}

export async function generateAndStoreSurveyReportImage(
  input: WanImageInput,
  dependencies: WanImageDependencies = {}
): Promise<StoredSurveyReportImage> {
  const apiKey = input.apiKey
    ?? process.env.DASHSCOPE_API_KEY
    ?? process.env.QWEN_API_KEY;
  if (!apiKey) throw new Error("wan_image_api_key_missing");

  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const imageBaseUrl = (
    process.env.DASHSCOPE_IMAGE_BASE_URL
    ?? "https://dashscope.aliyuncs.com/api/v1"
  ).replace(/\/$/, "");
  const generationResponse = await fetchImpl(
    `${imageBaseUrl}/services/aigc/multimodal-generation/generation`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.WAN_IMAGE_MODEL ?? "wan2.6-t2i",
        input: {
          messages: [{
            role: "user",
            content: [{ text: input.prompt }],
          }],
        },
        parameters: {
          prompt_extend: true,
          watermark: false,
          n: 1,
          negative_prompt: "文字水印，虚构统计数字，品牌标志，人物肖像",
          size: "1280*1280",
        },
      }),
      signal: AbortSignal.timeout(120_000),
    }
  );
  if (!generationResponse.ok) {
    throw new Error(`wan_image_generation_failed:${generationResponse.status}`);
  }

  const temporaryUrl = wanImageUrl(
    await generationResponse.json(),
    imageBaseUrl
  );
  const imageResponse = await fetchImpl(temporaryUrl, {
    method: "GET",
    signal: AbortSignal.timeout(30_000),
  });
  if (!imageResponse.ok) {
    throw new Error(`wan_image_download_failed:${imageResponse.status}`);
  }
  const contentType = (
    imageResponse.headers.get("content-type")?.split(";")[0] ?? ""
  ).trim().toLowerCase();
  if (contentType !== "image/png") {
    throw new Error("wan_image_content_type_invalid");
  }
  const declaredLength = Number(
    imageResponse.headers.get("content-length") ?? "0"
  );
  if (
    Number.isFinite(declaredLength)
    && declaredLength > MAX_REPORT_IMAGE_BYTES
  ) {
    throw new Error("wan_image_too_large");
  }
  const bytes = Buffer.from(await imageResponse.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_REPORT_IMAGE_BYTES) {
    throw new Error("wan_image_too_large");
  }

  const objectKey = buildSurveyReportImageObjectKey(input);
  await (dependencies.ensureBucketImpl ?? ensureBucket)();
  await (dependencies.putObjectImpl ?? putObject)(
    objectKey,
    bytes,
    "image/png"
  );
  return {
    assetId: input.chapterId.replace(/[/\\]/g, "_"),
    objectKey,
    altText: input.altText,
    caption: input.caption,
  };
}
