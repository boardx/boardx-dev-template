import { NextResponse } from "next/server";
import { getLegacyAvaModel } from "@/lib/ava-legacy-compat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { user: string } }) {
  return new NextResponse(getLegacyAvaModel(params.user), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

