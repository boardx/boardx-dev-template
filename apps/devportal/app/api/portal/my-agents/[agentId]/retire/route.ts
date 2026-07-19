// POST /api/portal/my-agents/:agentId/retire — 退役（p30/F07）。
// 吊销全部在役 token（即时 401）+ Directory 生命周期置 retired（终态）；
// 身份记录本身保留（历史贡献与归因不删，数字分身页仍可见——D1/D6）。
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { gatewayEnv, getDirectoryAgent, isOwnAgent, revokeAllActiveTokens, setAgentLifecycle } from "@/lib/agents-gateway";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { agentId: string } }) {
  const user = await getSessionUser(req.headers);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const gw = gatewayEnv();
  if (!gw) return NextResponse.json({ error: "gateway_not_configured" }, { status: 503 });

  const agent = await getDirectoryAgent(gw, params.agentId);
  if (!agent) return NextResponse.json({ error: "agent_not_found" }, { status: 404 });
  if (!isOwnAgent(agent, user.login)) return NextResponse.json({ error: "not_your_agent" }, { status: 403 });

  const revokedCount = await revokeAllActiveTokens(gw, params.agentId);
  const lc = await setAgentLifecycle(gw, params.agentId, "retire");
  if (!lc.ok) {
    const body = (await lc.json().catch(() => ({}))) as { error?: string };
    return NextResponse.json({ error: body.error ?? "retire_failed", upstream_status: lc.status }, { status: 502 });
  }

  return NextResponse.json({ ok: true, revokedTokens: revokedCount }, { headers: { "Cache-Control": "no-store" } });
}
