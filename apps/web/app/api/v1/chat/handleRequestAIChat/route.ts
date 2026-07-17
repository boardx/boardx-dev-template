import {
  legacyErrorResponse,
  readLegacyJson,
  streamLegacyChatData,
  type LegacyAvaChatRequest,
} from "@/lib/ava-legacy-compat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const data = await readLegacyJson<LegacyAvaChatRequest>(request);
    return new Response(await streamLegacyChatData(data), {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
        "x-vercel-ai-data-stream": "v1",
      },
    });
  } catch (error) {
    console.error(error);
    return legacyErrorResponse("AVA chat request failed");
  }
}
