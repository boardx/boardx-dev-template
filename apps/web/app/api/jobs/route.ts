import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createJob } from "@repo/data";
import { makeQueue, QUEUE_NAMES } from "@repo/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface JobData {
  id: string;
  payload: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { payload?: unknown };
    const payload = typeof body.payload === "string" ? body.payload : "";
    const id = randomUUID();

    // 先落库（queued），再入队，便于 GET 立即可查
    await createJob(id, payload);
    const queue = makeQueue<JobData>(QUEUE_NAMES.jobs);
    await queue.add("process", { id, payload });
    await queue.close();

    return NextResponse.json({ id, status: "queued" }, { status: 202 });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
