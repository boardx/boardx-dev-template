import { NextResponse } from "next/server";
import {
  legacyErrorResponse,
  readLegacyJson,
  runLegacyDigitize,
  type LegacyAvaDigitizeRequest,
} from "@/lib/ava-legacy-compat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const data = await readLegacyJson<LegacyAvaDigitizeRequest>(request);
    return NextResponse.json(await runLegacyDigitize(data));
  } catch (error) {
    console.error(error);
    return legacyErrorResponse("AVA digitize request failed");
  }
}
