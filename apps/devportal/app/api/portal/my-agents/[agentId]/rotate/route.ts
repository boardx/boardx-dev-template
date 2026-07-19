// POST /api/portal/my-agents/:agentId/rotate — 轮换 scoped token（p30/F07）。
// 吊销该 agent 名下全部在役 token（即时 401，F08 语义）后 mint 一枚新的；
// 不改 Directory 的身份/生命周期记录——轮换纯粹是 RepoHub token 面的事。
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { gatewayEnv, getDirectoryAgent, mintRepoToken, revokeAllActiveTokens } from "@/lib/agents-gateway";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { agentId: string } }) {
  const user = await getSessionUser(req.headers);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const gw = gatewayEnv();
  if (!gw) return NextResponse.json({ error: "gateway_not_configured" }, { status: 503 });

  const agent = await getDirectoryAgent(gw, params.agentId);
  if (!agent) return NextResponse.json({ error: "agent_not_found" }, { status: 404 });
  if (agent.owner?.handle !== user.login) return NextResponse.json({ error: "not_your_agent" }, { status: 403 });

  await revokeAllActiveTokens(gw, params.agentId);
  const minted = await mintRepoToken(gw, params.agentId, user.login);
  if ("error" in minted) {
    return NextResponse.json({ error: "mint_failed", upstream_status: minted.upstreamStatus }, { status: 502 });
  }

  return NextResponse.json({ token: minted.token }, { headers: { "Cache-Control": "no-store" } });
}
