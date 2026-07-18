import {
  legacyErrorResponse,
  readLegacyJson,
  runLegacyWidget,
  type LegacyAvaWidgetRequest,
} from "@/lib/ava-legacy-compat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sse(event: string, payload: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(request: Request) {
  try {
    const data = await readLegacyJson<LegacyAvaWidgetRequest>(request);
    const result = await runLegacyWidget(data);
    return new Response(
      [sse("connected", { type: "connected" }), sse("result", { type: "result", data: result }), sse("done", { type: "done" })].join(""),
      {
        headers: {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache",
          connection: "keep-alive",
          "x-accel-buffering": "no",
        },
      }
    );
  } catch (error) {
    console.error(error);
    return legacyErrorResponse("AVA widget request failed");
  }
}
