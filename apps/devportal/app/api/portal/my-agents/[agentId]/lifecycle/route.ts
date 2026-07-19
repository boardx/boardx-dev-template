// POST /api/portal/my-agents/:agentId/lifecycle {action:"pause"|"resume"} — 车队
// 管理台「暂停/恢复」按钮的真实落点（p30/F07）。不动 token——暂停只是身份面的
// 状态标注，恢复后原 token 仍然有效（比退役轻，退役才会把 token 一并吊销，
// 见 retire/route.ts）。
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { gatewayEnv, getDirectoryAgent, setAgentLifecycle, type LifecycleAction } from "@/lib/agents-gateway";

export const runtime = "edge";
export const dynamic = "force-dynamic";

function isPauseOrResume(v: unknown): v is Extract<LifecycleAction, "pause" | "resume"> {
  return v === "pause" || v === "resume";
}

export async function POST(req: Request, { params }: { params: { agentId: string } }) {
  const user = await getSessionUser(req.headers);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const gw = gatewayEnv();
  if (!gw) return NextResponse.json({ error: "gateway_not_configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { action?: unknown };
  if (!isPauseOrResume(body.action)) {
    return NextResponse.json({ error: "invalid_action" }, { status: 422 });
  }

  const agent = await getDirectoryAgent(gw, params.agentId);
  if (!agent) return NextResponse.json({ error: "agent_not_found" }, { status: 404 });
  if (agent.owner?.handle !== user.login) return NextResponse.json({ error: "not_your_agent" }, { status: 403 });

  const res = await setAgentLifecycle(gw, params.agentId, body.action);
  if (!res.ok) {
    const upstream = (await res.json().catch(() => ({}))) as { error?: string };
    return NextResponse.json({ error: upstream.error ?? "lifecycle_failed", upstream_status: res.status }, { status: 502 });
  }
  const { agent: updated } = (await res.json()) as { agent: { lifecycle: string } };
  return NextResponse.json({ lifecycle: updated.lifecycle }, { headers: { "Cache-Control": "no-store" } });
}
