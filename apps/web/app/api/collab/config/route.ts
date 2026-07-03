import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const host = url.hostname || "localhost";
  const port = process.env.COLLAB_WS_PORT ?? "3001";
  const protocol = url.protocol === "https:" ? "wss" : "ws";
  return NextResponse.json({ wsUrl: `${protocol}://${host}:${port}/api/collab/ws` });
}
