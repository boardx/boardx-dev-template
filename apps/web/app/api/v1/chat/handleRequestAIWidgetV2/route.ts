import { NextResponse } from "next/server";
import {
  legacyErrorResponse,
  readLegacyJson,
  runLegacyWidget,
  type LegacyAvaWidgetRequest,
} from "@/lib/ava-legacy-compat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const data = await readLegacyJson<LegacyAvaWidgetRequest>(request);
    return NextResponse.json({ result: await runLegacyWidget(data) });
  } catch (error) {
    console.error(error);
    return legacyErrorResponse("AVA widget request failed");
  }
}
