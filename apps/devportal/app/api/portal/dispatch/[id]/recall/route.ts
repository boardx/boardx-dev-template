// 撤回派工（#594 P3）：验派工资格 → broker 代调上游 POST /tasks/:id/recall
// （F10-pre 起上游为 coord-gateway admin 面，数据权威在 RepoHub DO）。
import { NextResponse } from "next/server";
import { accessUser } from "@/lib/access";
import { loadRegistry, canDispatch, dispatchBroker } from "@/lib/dispatch";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await accessUser(req.headers);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const agents = await loadRegistry();
  if (!agents) return NextResponse.json({ error: "registry_unavailable" }, { status: 502 });
  if (!canDispatch(agents, user.email)) return NextResponse.json({ error: "not_a_coordinator" }, { status: 403 });

  const broker = dispatchBroker();
  if (!broker) return NextResponse.json({ error: "broker_not_configured" }, { status: 503 });

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "invalid_task_id" }, { status: 400 });

  const res = await fetch(`${broker.baseUrl}/tasks/${id}/recall`, {
    method: "POST",
    headers: { Authorization: `Bearer ${broker.token}` },
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))) as { error?: string };
    return NextResponse.json({ error: "recall_failed", upstream: detail.error ?? res.status }, { status: 502 });
  }
  return NextResponse.json(await res.json());
}
